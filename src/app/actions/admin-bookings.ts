"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthError, requireStaff } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { BookingError } from "@/lib/booking/service";
import { cancelBooking, confirmBooking, previewReturn, recordPickup, recordReturn } from "@/lib/booking/lifecycle";
import { processRefund } from "@/lib/payments/service";
import { storeFile, UploadError } from "@/lib/storage";

type R<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<R<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof BookingError || e instanceof AuthError || e instanceof UploadError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong." };
  }
}

function refresh(id: string) {
  revalidatePath(`/admin/bookings/${id}`);
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/handovers");
  revalidatePath("/admin");
}

export async function adminConfirmBooking(id: string) {
  return run(async () => {
    const u = await requireStaff("bookings:write");
    await confirmBooking(id);
    const b = await db.booking.findUnique({ where: { id }, select: { code: true } });
    await audit(u.id, "booking.confirm", "Booking", id, `Confirmed booking ${b?.code}`);
    refresh(id);
    return null;
  });
}

export async function adminCancelBooking(id: string, reason: string, fullRefund: boolean) {
  return run(async () => {
    const u = await requireStaff("bookings:write");
    if (reason.trim().length < 3) throw new BookingError("Add a cancellation reason.");
    const res = await cancelBooking(id, { id: u.id, role: u.role }, reason, { fullRefund });
    const b = await db.booking.findUnique({ where: { id }, select: { code: true } });
    await audit(u.id, "booking.cancel", "Booking", id, `Cancelled ${b?.code}${fullRefund ? " with full refund" : ""}: ${reason}`, { refund: res.refundAmount });
    refresh(id);
    return { refund: res.refundAmount };
  });
}

export async function adminRetryRefund(refundId: string) {
  return run(async () => {
    const u = await requireStaff("bookings:write");
    const r = await db.refund.findUniqueOrThrow({ where: { id: refundId } });
    if (r.status === "FAILED") await db.refund.update({ where: { id: refundId }, data: { status: "PENDING" } });
    const done = await processRefund(refundId);
    await audit(u.id, "refund.process", "Refund", refundId, `Processed refund of ₹${r.amount} (${done?.status})`);
    refresh(r.bookingId);
    return { status: done?.status ?? "PENDING" };
  });
}

export async function uploadInspectionPhoto(form: FormData) {
  return run(async () => {
    const u = await requireStaff("handover:write");
    const f = await storeFile(form.get("file") as File, { ownerId: u.id, kind: "INSPECTION" });
    return { url: f.url };
  });
}

const damage = z.object({ area: z.string().trim().min(2).max(60), severity: z.enum(["MINOR", "MODERATE", "MAJOR"]), note: z.string().trim().max(200).optional() });
const handover = z.object({
  bookingId: z.string(),
  odometer: z.coerce.number().int().min(0).max(2_000_000),
  fuelLevel: z.coerce.number().int().min(0).max(100),
  notes: z.string().trim().max(1000).optional(),
  photoUrls: z.array(z.string().max(300)).max(12),
  damages: z.array(damage).max(20),
  customerConfirmed: z.boolean(),
  customerSignature: z.string().trim().max(80).optional(),
  damageCharges: z.coerce.number().int().min(0).max(1_000_000).default(0),
});

export async function adminRecordPickup(input: unknown) {
  return run(async () => {
    const u = await requireStaff("handover:write");
    const d = handover.parse(input);
    await recordPickup(d.bookingId, u.id, d);
    await audit(u.id, "handover.pickup", "Booking", d.bookingId, `Recorded pickup (odo ${d.odometer} km, fuel ${d.fuelLevel}%)`);
    refresh(d.bookingId);
    return null;
  });
}

export async function adminPreviewReturn(input: { bookingId: string; odometer: number; fuelLevel: number; damageCharges: number }) {
  return run(async () => {
    await requireStaff("handover:write");
    const { charges } = await previewReturn(input.bookingId, input);
    return charges;
  });
}

export async function adminRecordReturn(input: unknown) {
  return run(async () => {
    const u = await requireStaff("handover:write");
    const d = handover.parse(input);
    const res = await recordReturn(d.bookingId, u.id, d);
    await audit(u.id, "handover.return", "Booking", d.bookingId, `Recorded return, charges ₹${res.charges.total}, deposit refund ₹${res.depositRefund}`);
    refresh(d.bookingId);
    return res;
  });
}

export async function adminUpdateNote(bookingId: string, note: string) {
  return run(async () => {
    const u = await requireStaff("bookings:write");
    await db.booking.update({ where: { id: bookingId }, data: { customerNote: note.slice(0, 500) } });
    await audit(u.id, "booking.note", "Booking", bookingId, "Updated booking note");
    refresh(bookingId);
    return null;
  });
}
