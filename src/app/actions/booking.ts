"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { AuthError, requireCustomer } from "@/lib/auth/session";
import { BookingError, createBooking } from "@/lib/booking/service";
import { cancelBooking } from "@/lib/booking/lifecycle";
import { completeDemoPayment, startCheckout, verifyRazorpayCheckout, type CheckoutSession } from "@/lib/payments/service";
import { rateLimit } from "@/lib/rate-limit";
import { notifyAdmins } from "@/lib/notify";
import { bookingSchema } from "@/lib/validators";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function guard<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof BookingError || e instanceof AuthError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

export async function createBookingAction(input: unknown): Promise<Result<{ bookingId: string; code: string }>> {
  return guard(async () => {
    const user = await requireCustomer();
    if (!(await rateLimit(`book:${user.id}`, 10, 600))) throw new BookingError("Too many booking attempts. Please wait a few minutes.");
    const parsed = bookingSchema.safeParse(input);
    if (!parsed.success) throw new BookingError(parsed.error.issues[0]?.message ?? "Invalid booking details.");
    // Reuse an unpaid hold for the same car & window instead of stacking duplicates.
    const existing = await db.booking.findFirst({
      where: {
        userId: user.id,
        vehicleId: parsed.data.vehicleId,
        status: "AWAITING_PAYMENT",
        startAt: parsed.data.start,
        endAt: parsed.data.end,
        holdExpiresAt: { gt: new Date() },
      },
    });
    if (existing) {
      await db.booking.update({ where: { id: existing.id }, data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Superseded by a new checkout", cancelledBy: "system" } });
    }
    const b = await createBooking(user.id, parsed.data);
    return { bookingId: b.id, code: b.code };
  });
}

export async function startPaymentAction(bookingId: string): Promise<Result<CheckoutSession>> {
  return guard(async () => {
    const user = await requireCustomer();
    return startCheckout(bookingId, user.id);
  });
}

export async function verifyRazorpayAction(args: { orderId: string; paymentId: string; signature: string }): Promise<Result<{ bookingId: string }>> {
  return guard(async () => {
    const user = await requireCustomer();
    const bookingId = await verifyRazorpayCheckout(user.id, args.orderId, args.paymentId, args.signature);
    revalidatePath("/dashboard");
    return { bookingId };
  });
}

export async function demoPaymentAction(paymentId: string, outcome: "success" | "failure"): Promise<Result<{ bookingId: string }>> {
  return guard(async () => {
    const user = await requireCustomer();
    const bookingId = await completeDemoPayment(user.id, paymentId, outcome);
    revalidatePath("/dashboard");
    return { bookingId };
  });
}

export async function markPaymentFailedAction(paymentId: string, reason: string): Promise<Result<null>> {
  return guard(async () => {
    const user = await requireCustomer();
    await db.payment.updateMany({ where: { id: paymentId, userId: user.id, status: "CREATED" }, data: { status: "FAILED", failureReason: reason.slice(0, 200) } });
    return null;
  });
}

export async function cancelBookingAction(bookingId: string, reason: string): Promise<Result<{ refundAmount: number }>> {
  return guard(async () => {
    const user = await requireCustomer();
    if (!reason.trim()) throw new BookingError("Please tell us why you're cancelling.");
    const res = await cancelBooking(bookingId, { id: user.id, role: "CUSTOMER" }, reason.trim());
    revalidatePath("/dashboard/bookings");
    revalidatePath(`/dashboard/bookings/${bookingId}`);
    return { refundAmount: res.refundAmount };
  });
}

export async function submitReviewAction(input: { bookingId: string; rating: number; title?: string; comment: string }): Promise<Result<null>> {
  return guard(async () => {
    const user = await requireCustomer();
    const rating = Math.round(Number(input.rating));
    if (!(rating >= 1 && rating <= 5)) throw new BookingError("Choose a rating from 1 to 5 stars.");
    const comment = String(input.comment ?? "").trim();
    if (comment.length < 10) throw new BookingError("Please write at least 10 characters.");
    const booking = await db.booking.findUnique({ where: { id: input.bookingId }, include: { review: true, vehicle: true } });
    // Only the renter of a completed trip may review, once.
    if (!booking || booking.userId !== user.id) throw new BookingError("Booking not found.");
    if (booking.status !== "COMPLETED") throw new BookingError("You can review a car after your trip is completed.");
    if (booking.review) throw new BookingError("You've already reviewed this trip.");
    await db.review.create({
      data: {
        bookingId: booking.id,
        userId: user.id,
        vehicleId: booking.vehicleId,
        rating,
        title: input.title?.trim().slice(0, 80) || null,
        comment: comment.slice(0, 1500),
        photoUrls: [],
      },
    });
    await db.$transaction([
      db.loyaltyTransaction.create({ data: { userId: user.id, points: 50, reason: "Review bonus", bookingId: booking.id } }),
      db.user.update({ where: { id: user.id }, data: { loyaltyPoints: { increment: 50 } } }),
    ]);
    await notifyAdmins({ type: "REVIEW_SUBMITTED", title: "New review to moderate", body: `${user.name} rated the ${booking.vehicle.brand} ${booking.vehicle.model} ${rating}★`, link: "/admin/reviews" });
    revalidatePath(`/dashboard/bookings/${booking.id}`);
    return null;
  });
}
