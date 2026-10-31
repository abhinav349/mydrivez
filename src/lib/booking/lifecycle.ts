import "server-only";
import type { DamageSeverity } from "@prisma/client";
import { db } from "@/lib/db";
import { cancellationRefund, computeReturnCharges } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { notify, notifyAdmins } from "@/lib/notify";
import { processRefund } from "@/lib/payments/service";
import { BookingError } from "./service";

const CANCELLABLE = ["PENDING", "AWAITING_PAYMENT", "PAYMENT_COMPLETED", "CONFIRMED"] as const;

export async function cancelBooking(bookingId: string, actor: { id: string; role: string }, reason: string, opts: { fullRefund?: boolean } = {}) {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { pricing: true, payments: true } });
  if (!booking) throw new BookingError("Booking not found.");
  if (actor.role === "CUSTOMER" && booking.userId !== actor.id) throw new BookingError("Booking not found.");
  if (!(CANCELLABLE as readonly string[]).includes(booking.status)) throw new BookingError("This booking can no longer be cancelled.");

  const paid = booking.payments.find((p) => p.status === "CAPTURED");
  const policy = cancellationRefund({
    rentalTotal: booking.pricing!.rentalTotal,
    deposit: booking.pricing!.securityDeposit,
    startAt: booking.startAt,
  });
  const refundAmount = paid ? (opts.fullRefund ? paid.amount : Math.min(policy.total, paid.amount)) : 0;

  await db.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason.slice(0, 300), cancelledBy: actor.role === "CUSTOMER" ? "customer" : "admin" },
  });

  if (paid && refundAmount > 0) {
    const refund = await db.refund.create({
      data: {
        bookingId,
        paymentId: paid.id,
        type: "CANCELLATION",
        amount: refundAmount,
        reason: opts.fullRefund ? "Full refund issued by admin" : policy.rule,
      },
    });
    const done = await processRefund(refund.id);
    if (done?.status === "PROCESSED" && refundAmount >= paid.amount) {
      await db.booking.update({ where: { id: bookingId }, data: { status: "REFUNDED" } });
    }
  }

  await notify({
    userId: booking.userId,
    type: "BOOKING_CANCELLED",
    title: "Booking cancelled",
    body: `Booking ${booking.code} has been cancelled.${refundAmount ? ` A refund of ₹${refundAmount.toLocaleString("en-IN")} has been initiated.` : ""}`,
    link: `/dashboard/bookings/${bookingId}`,
    channels: ["email"],
  });
  if (actor.role === "CUSTOMER") {
    await notifyAdmins({ type: "CANCELLATION", title: `Booking ${booking.code} cancelled`, body: `Customer cancelled: ${reason}`, link: `/admin/bookings/${bookingId}` });
  }
  return { refundAmount, policy };
}

export async function confirmBooking(bookingId: string) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true } });
  if (!b) throw new BookingError("Booking not found.");
  if (!["PENDING", "PAYMENT_COMPLETED"].includes(b.status)) throw new BookingError("Only paid bookings awaiting review can be confirmed.");
  await db.booking.update({ where: { id: bookingId }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  await notify({
    userId: b.userId,
    type: "BOOKING_CONFIRMED",
    title: "Booking confirmed 🎉",
    body: `Your ${b.vehicle.brand} ${b.vehicle.model} (${b.code}) is confirmed. See you at pickup!`,
    link: `/dashboard/bookings/${bookingId}`,
    channels: ["email"],
  });
}

export type DamageInput = { area: string; severity: DamageSeverity; note?: string; photoUrl?: string };

export async function recordPickup(
  bookingId: string,
  staffId: string,
  data: { odometer: number; fuelLevel: number; notes?: string; photoUrls: string[]; damages: DamageInput[]; customerConfirmed: boolean; customerSignature?: string },
) {
  const b = await db.booking.findUnique({ where: { id: bookingId } });
  if (!b) throw new BookingError("Booking not found.");
  if (b.status !== "CONFIRMED") throw new BookingError("Only confirmed bookings can be handed over.");
  if (!data.customerConfirmed) throw new BookingError("The customer must confirm the vehicle condition before pickup.");

  await db.$transaction([
    db.handoverRecord.create({
      data: {
        bookingId,
        type: "PICKUP",
        odometer: data.odometer,
        fuelLevel: data.fuelLevel,
        notes: data.notes,
        photoUrls: data.photoUrls,
        customerConfirmed: true,
        customerSignature: data.customerSignature,
        recordedById: staffId,
        inspections: { create: data.damages.map((d) => ({ ...d, preExisting: true })) },
      },
    }),
    db.booking.update({ where: { id: bookingId }, data: { status: "ACTIVE", actualPickupAt: new Date() } }),
    db.vehicle.update({ where: { id: b.vehicleId }, data: { status: "RENTED" } }),
  ]);
  await notify({ userId: b.userId, type: "TRIP_STARTED", title: "Trip started — drive safe!", body: `Booking ${b.code} is now active. Return by the scheduled time to avoid late fees.`, link: `/dashboard/bookings/${bookingId}` });
}

export async function previewReturn(bookingId: string, input: { odometer: number; fuelLevel: number; damageCharges: number; returnedAt?: Date }) {
  const b = await db.booking.findUnique({ where: { id: bookingId }, include: { pricing: true, handovers: true } });
  if (!b) throw new BookingError("Booking not found.");
  const pickup = b.handovers.find((h) => h.type === "PICKUP");
  if (!pickup) throw new BookingError("No pickup record found for this booking.");
  const settings = await getSettings();
  return {
    booking: b,
    pickup,
    charges: computeReturnCharges({
      scheduledEnd: b.endAt,
      actualReturn: input.returnedAt ?? new Date(),
      graceMinutes: settings.lateGraceMinutes,
      lateFeePerHour: b.pricing!.lateFeePerHour,
      odometerStart: pickup.odometer,
      odometerEnd: input.odometer,
      includedKm: b.pricing!.includedKm,
      extraKmRate: b.pricing!.extraKmRate,
      fuelStart: pickup.fuelLevel,
      fuelEnd: input.fuelLevel,
      fuelChargePerPct: settings.fuelChargePerPct,
      damageCharges: input.damageCharges,
    }),
  };
}

export async function recordReturn(
  bookingId: string,
  staffId: string,
  data: { odometer: number; fuelLevel: number; notes?: string; photoUrls: string[]; damages: DamageInput[]; damageCharges: number; customerConfirmed: boolean; customerSignature?: string },
) {
  const { booking: b, pickup, charges } = await previewReturn(bookingId, data);
  if (b.status !== "ACTIVE") throw new BookingError("Only active rentals can be returned.");
  if (data.odometer < pickup.odometer) throw new BookingError("Return odometer can't be lower than the pickup reading.");

  const deposit = b.pricing!.securityDeposit;
  const depositRefund = Math.max(0, deposit - charges.total);
  const outstanding = Math.max(0, charges.total - deposit);
  const settings = await getSettings();

  await db.$transaction([
    db.handoverRecord.create({
      data: {
        bookingId,
        type: "RETURN",
        odometer: data.odometer,
        fuelLevel: data.fuelLevel,
        notes: data.notes,
        photoUrls: data.photoUrls,
        customerConfirmed: data.customerConfirmed,
        customerSignature: data.customerSignature,
        lateMinutes: charges.lateMinutes,
        extraKm: charges.extraKm,
        chargesAssessed: charges.total,
        recordedById: staffId,
        inspections: { create: data.damages.map((d) => ({ ...d, preExisting: false })) },
      },
    }),
    db.bookingPricing.update({
      where: { bookingId },
      data: {
        extraKmCharges: charges.extraKmCharges,
        lateReturnCharges: charges.lateReturnCharges,
        damageCharges: charges.damageCharges,
        fuelCharges: charges.fuelCharges,
      },
    }),
    db.booking.update({ where: { id: bookingId }, data: { status: "COMPLETED", actualReturnAt: new Date() } }),
    db.vehicle.update({ where: { id: b.vehicleId }, data: { status: "AVAILABLE", tripCount: { increment: 1 } } }),
  ]);

  const paid = await db.payment.findFirst({ where: { bookingId, status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] } } });
  if (depositRefund > 0) {
    const refund = await db.refund.create({
      data: {
        bookingId,
        paymentId: paid?.id,
        type: "DEPOSIT",
        amount: depositRefund,
        reason: charges.total ? `Deposit ₹${deposit} less trip charges ₹${charges.total}` : "Full security deposit",
      },
    });
    await processRefund(refund.id);
  }

  await awardTripLoyalty(b.userId, bookingId, b.pricing!.rentalTotal, settings.loyaltyPointsPer100, settings.referralBonusPoints);

  await notify({
    userId: b.userId,
    type: "TRIP_COMPLETED",
    title: "Trip completed — thanks for driving with us",
    body: charges.total
      ? `Trip charges of ₹${charges.total.toLocaleString("en-IN")} were assessed${outstanding ? `; ₹${outstanding.toLocaleString("en-IN")} is outstanding` : " and adjusted against your deposit"}. Rate your car to earn bonus points!`
      : `Your full deposit is being refunded. Rate your car to earn bonus points!`,
    link: `/dashboard/bookings/${bookingId}`,
    channels: ["email"],
  });
  return { charges, depositRefund, outstanding };
}

async function awardTripLoyalty(userId: string, bookingId: string, rentalTotal: number, per100: number, referralBonus: number) {
  const points = Math.floor((rentalTotal / 100) * per100);
  if (points > 0) {
    await db.$transaction([
      db.loyaltyTransaction.create({ data: { userId, points, reason: "Trip completed", bookingId } }),
      db.user.update({ where: { id: userId }, data: { loyaltyPoints: { increment: points } } }),
    ]);
  }
  // Referral bonus on the referred customer's first completed trip.
  const user = await db.user.findUnique({ where: { id: userId }, select: { referredById: true, name: true } });
  if (user?.referredById) {
    const completed = await db.booking.count({ where: { userId, status: "COMPLETED" } });
    if (completed === 1) {
      await db.$transaction([
        db.loyaltyTransaction.create({ data: { userId: user.referredById, points: referralBonus, reason: `Referral: ${user.name} completed their first trip` } }),
        db.user.update({ where: { id: user.referredById }, data: { loyaltyPoints: { increment: referralBonus } } }),
      ]);
      await notify({ userId: user.referredById, type: "REFERRAL_REWARD", title: "You earned referral points", body: `${user.name} completed their first trip. ${referralBonus} points added to your wallet.`, link: "/dashboard/rewards" });
    }
  }
}
