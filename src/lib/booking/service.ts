import "server-only";
import { Prisma, type Booking, type BookingStatus, type Coupon } from "@prisma/client";
import { db } from "@/lib/db";
import { BLOCKING_STATUSES } from "@/lib/constants";
import { computeQuote, PricingError, type Quote, type SurgeRule } from "@/lib/pricing";
import { getSettings, type AppSettings } from "@/lib/settings";
import { randomCode } from "@/lib/auth/tokens";
import { notify, notifyAdmins } from "@/lib/notify";
import { formatDateTime } from "@/lib/utils";

export class BookingError extends Error {}

const PAID_STATUSES: BookingStatus[] = ["PAYMENT_COMPLETED", "CONFIRMED", "ACTIVE", "COMPLETED"];

/** Release payment holds that timed out so their slots become bookable again. */
export async function expireStaleHolds(vehicleId?: string) {
  const stale = await db.booking.findMany({
    where: { status: "AWAITING_PAYMENT", holdExpiresAt: { lt: new Date() }, ...(vehicleId ? { vehicleId } : {}) },
    select: { id: true },
  });
  if (!stale.length) return 0;
  const { count } = await db.booking.updateMany({
    where: { id: { in: stale.map((s) => s.id) }, status: "AWAITING_PAYMENT" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Payment window expired", cancelledBy: "system" },
  });
  return count;
}

export function validateWindow(start: Date, end: Date, settings: AppSettings) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BookingError("Please choose valid dates.");
  if (end <= start) throw new BookingError("Return time must be after pickup time.");
  if (start.getTime() < Date.now() + settings.minLeadMinutes * 60_000 - 5 * 60_000)
    throw new BookingError(`Pickup must be at least ${settings.minLeadMinutes} minutes from now.`);
  if (end.getTime() - start.getTime() > settings.maxRentalDays * 86_400_000)
    throw new BookingError(`Rentals can be at most ${settings.maxRentalDays} days.`);
}

export async function findConflicts(vehicleId: string, start: Date, end: Date, settings: AppSettings, excludeBookingId?: string) {
  const blockedUntil = new Date(end.getTime() + settings.turnaroundMinutes * 60_000);
  return db.booking.findMany({
    where: {
      vehicleId,
      status: { in: BLOCKING_STATUSES },
      startAt: { lt: blockedUntil },
      blockedUntil: { gt: start },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { id: true, startAt: true, endAt: true },
  });
}

export async function isAvailable(vehicleId: string, start: Date, end: Date) {
  const settings = await getSettings();
  await expireStaleHolds(vehicleId);
  return (await findConflicts(vehicleId, start, end, settings)).length === 0;
}

export async function activeRules(): Promise<SurgeRule[]> {
  const rules = await db.pricingRule.findMany({ where: { isActive: true } });
  return rules.map((r) => ({ ...r, category: r.category ?? null }));
}

/** Validate a coupon for this user. Returns the coupon or a human-readable error. */
export async function resolveCoupon(code: string | undefined | null, userId: string | null) {
  if (!code) return { coupon: null as Coupon | null, error: null as string | null };
  const coupon = await db.coupon.findUnique({ where: { code: code.trim().toUpperCase() } });
  const now = new Date();
  if (!coupon || !coupon.isActive) return { coupon: null, error: "This coupon code isn't valid." };
  if (coupon.validFrom > now) return { coupon: null, error: "This coupon isn't active yet." };
  if (coupon.validUntil < now) return { coupon: null, error: "This coupon has expired." };
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return { coupon: null, error: "This coupon has been fully redeemed." };
  if (userId) {
    if (coupon.firstBookingOnly) {
      const prior = await db.booking.count({ where: { userId, status: { in: PAID_STATUSES } } });
      if (prior > 0) return { coupon: null, error: "This coupon is only valid on your first booking." };
    }
    const used = await db.booking.count({ where: { userId, couponId: coupon.id, status: { in: PAID_STATUSES } } });
    if (used >= coupon.perUserLimit) return { coupon: null, error: "You've already used this coupon." };
  }
  return { coupon, error: null };
}

export async function quoteVehicle(args: {
  vehicleId: string;
  start: Date;
  end: Date;
  doorstep: boolean;
  couponCode?: string | null;
  userId: string | null;
}) {
  const [vehicle, rules, settings] = await Promise.all([
    db.vehicle.findUnique({ where: { id: args.vehicleId } }),
    activeRules(),
    getSettings(),
  ]);
  if (!vehicle) throw new BookingError("Vehicle not found.");
  const { coupon, error } = await resolveCoupon(args.couponCode, args.userId);
  try {
    const quote = computeQuote({
      rate: vehicle,
      start: args.start,
      end: args.end,
      rules,
      settings,
      doorstep: args.doorstep,
      coupon: coupon ? { ...coupon } : null,
      couponError: error,
    });
    return { quote, vehicle, coupon: quote.couponCode ? coupon : null, settings };
  } catch (e) {
    if (e instanceof PricingError) throw new BookingError(e.message);
    throw e;
  }
}

function isOverlapViolation(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("booking_no_overlap") || msg.includes("23P01") || msg.toLowerCase().includes("conflicting key value violates exclusion");
}

export type CreateBookingInput = {
  vehicleId: string;
  start: Date;
  end: Date;
  pickupLocationId: string;
  dropoffLocationId?: string | null;
  doorstep: boolean;
  deliveryAddress?: string | null;
  couponCode?: string | null;
  customerNote?: string | null;
};

export async function createBooking(userId: string, input: CreateBookingInput) {
  const settings = await getSettings();
  validateWindow(input.start, input.end, settings);
  if (input.doorstep && !input.deliveryAddress?.trim()) throw new BookingError("Please add a delivery address for doorstep delivery.");

  const { quote, vehicle, coupon } = await quoteVehicle({
    vehicleId: input.vehicleId,
    start: input.start,
    end: input.end,
    doorstep: input.doorstep,
    couponCode: input.couponCode,
    userId,
  });
  if (vehicle.status === "MAINTENANCE" || vehicle.status === "INACTIVE")
    throw new BookingError("This vehicle isn't accepting bookings right now.");
  if (input.couponCode && quote.couponError) throw new BookingError(quote.couponError);

  const [pickup, dropoff] = await Promise.all([
    db.vehicleLocation.findFirst({ where: { id: input.pickupLocationId, isActive: true } }),
    input.dropoffLocationId ? db.vehicleLocation.findFirst({ where: { id: input.dropoffLocationId, isActive: true } }) : null,
  ]);
  if (!pickup) throw new BookingError("Please choose a valid pickup location.");
  if (input.dropoffLocationId && !dropoff) throw new BookingError("Please choose a valid drop-off location.");

  await expireStaleHolds(vehicle.id);
  if ((await findConflicts(vehicle.id, input.start, input.end, settings)).length)
    throw new BookingError("This car is already booked for part of that period. Try different dates or another car.");

  const blockedUntil = new Date(input.end.getTime() + settings.turnaroundMinutes * 60_000);

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.booking.create({
        data: {
          code: randomCode("MDZ"),
          userId,
          vehicleId: vehicle.id,
          pickupLocationId: pickup.id,
          dropoffLocationId: dropoff?.id ?? null,
          startAt: input.start,
          endAt: input.end,
          blockedUntil,
          status: "AWAITING_PAYMENT",
          holdExpiresAt: new Date(Date.now() + settings.holdMinutes * 60_000),
          deliveryType: input.doorstep ? "DOORSTEP" : "SELF_PICKUP",
          deliveryAddress: input.doorstep ? input.deliveryAddress!.trim() : null,
          couponId: coupon?.id ?? null,
          customerNote: input.customerNote?.trim() || null,
          pricing: { create: pricingData(quote) },
        },
        include: { pricing: true },
      });
    } catch (e) {
      if (isOverlapViolation(e)) throw new BookingError("Someone just booked this car for an overlapping time. Please pick different dates.");
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // booking code collision, retry
      throw e;
    }
  }
  throw new BookingError("Could not create booking. Please try again.");
}

export function pricingData(q: Quote) {
  return {
    durationHours: q.durationHours,
    billedDays: q.billedDays,
    billedHours: q.billedHours,
    rateTier: q.rateTier,
    baseAmount: q.baseAmount,
    surgeAmount: q.surgeAmount,
    deliveryFee: q.deliveryFee,
    discountAmount: q.discountAmount,
    couponCode: q.couponCode,
    taxRate: q.taxRate,
    taxAmount: q.taxAmount,
    rentalTotal: q.rentalTotal,
    securityDeposit: q.securityDeposit,
    totalPayable: q.totalPayable,
    includedKm: q.includedKm,
    extraKmRate: q.extraKmRate,
    lateFeePerHour: q.lateFeePerHour,
    lineItems: q.lineItems as unknown as Prisma.InputJsonValue,
  };
}

async function hasVerifiedDocuments(userId: string) {
  const docs = await db.customerDocument.findMany({ where: { userId, status: "VERIFIED" }, select: { type: true } });
  const types = new Set(docs.map((d) => d.type));
  return types.has("DRIVING_LICENSE") && types.has("GOVERNMENT_ID");
}

/**
 * Called only after the gateway has verified the payment (signature or webhook) or, in demo
 * mode, after the explicit sandbox action. Idempotent.
 */
export async function onBookingPaid(bookingId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true, user: true } });
  if (!booking) return null;
  if (PAID_STATUSES.includes(booking.status)) return booking;

  const settings = await getSettings();
  const docsOk = await hasVerifiedDocuments(booking.userId);
  const needsReview = settings.manualApproval || (settings.requireVerifiedDocs && !docsOk);
  const next: BookingStatus = needsReview ? "PAYMENT_COMPLETED" : "CONFIRMED";

  let updated: Booking;
  try {
    updated = await db.booking.update({
      where: { id: bookingId },
      data: { status: next, holdExpiresAt: null, confirmedAt: next === "CONFIRMED" ? new Date() : null, cancelledAt: null, cancelReason: null, cancelledBy: null },
    });
  } catch (e) {
    // Hold expired and the slot was taken in the meantime → refund in full.
    if (isOverlapViolation(e)) {
      await flagLatePaymentForRefund(booking.id);
      return null;
    }
    throw e;
  }

  if (booking.couponId) {
    await db.$executeRaw`UPDATE "Coupon" SET "usedCount" = "usedCount" + 1 WHERE "id" = ${booking.couponId}`;
  }

  const when = formatDateTime(booking.startAt);
  await notify({
    userId: booking.userId,
    type: "PAYMENT_CONFIRMED",
    title: "Payment received",
    body: `We've received your payment for booking ${booking.code}.`,
    link: `/dashboard/bookings/${booking.id}`,
  });
  await notify({
    userId: booking.userId,
    type: next === "CONFIRMED" ? "BOOKING_CONFIRMED" : "BOOKING_UNDER_REVIEW",
    title: next === "CONFIRMED" ? "Booking confirmed 🎉" : "Booking under review",
    body:
      next === "CONFIRMED"
        ? `Your ${booking.vehicle.brand} ${booking.vehicle.model} is reserved for ${when}.`
        : `Your booking ${booking.code} is paid. Our team will confirm it shortly${!docsOk ? " once your documents are verified" : ""}.`,
    link: `/dashboard/bookings/${booking.id}`,
    channels: ["email"],
  });
  await notifyAdmins({
    type: "NEW_BOOKING",
    title: `New booking ${booking.code}`,
    body: `${booking.user.name} booked ${booking.vehicle.brand} ${booking.vehicle.model} from ${when}.${needsReview ? " Needs review." : ""}`,
    link: `/admin/bookings/${booking.id}`,
  });
  return updated;
}

async function flagLatePaymentForRefund(bookingId: string) {
  const payment = await db.payment.findFirst({ where: { bookingId, status: "CAPTURED" }, orderBy: { createdAt: "desc" } });
  if (!payment) return;
  await db.refund.create({
    data: { bookingId, paymentId: payment.id, type: "CANCELLATION", amount: payment.amount, reason: "Payment arrived after the hold expired and the slot was taken" },
  });
  await notifyAdmins({
    type: "REFUND_REQUIRED",
    title: "Late payment needs refund",
    body: `Payment ${payment.providerPaymentId ?? payment.id} arrived after the hold expired. A full refund was queued.`,
    link: `/admin/bookings/${bookingId}`,
  });
}

/** Display status: CONFIRMED bookings in the future read as "Upcoming". */
export function displayStatus(b: Pick<Booking, "status" | "startAt">) {
  if (b.status === "CONFIRMED" && b.startAt > new Date()) return "Upcoming";
  return null;
}
