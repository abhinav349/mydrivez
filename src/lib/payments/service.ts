import "server-only";
import { db } from "@/lib/db";
import { env, razorpayEnabled, demoPaymentsEnabled } from "@/lib/env";
import { onBookingPaid, BookingError } from "@/lib/booking/service";
import { notify } from "@/lib/notify";
import { createOrder, fetchPayment, refundPayment, verifyCheckoutSignature } from "./razorpay";

export type CheckoutSession =
  | { provider: "RAZORPAY"; keyId: string; orderId: string; amount: number; paymentId: string }
  | { provider: "DEMO"; paymentId: string; amount: number };

export function paymentMode() {
  if (razorpayEnabled) return { mode: "RAZORPAY" as const, test: env.razorpay.keyId!.startsWith("rzp_test_") };
  if (demoPaymentsEnabled) return { mode: "DEMO" as const, test: true };
  return { mode: "NONE" as const, test: true };
}

/** Create a gateway order for the server-computed amount on the booking. */
export async function startCheckout(bookingId: string, userId: string): Promise<CheckoutSession> {
  const booking = await db.booking.findUnique({ where: { id: bookingId }, include: { pricing: true } });
  if (!booking || booking.userId !== userId) throw new BookingError("Booking not found.");
  if (booking.status !== "AWAITING_PAYMENT") throw new BookingError("This booking is not awaiting payment.");
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date())
    throw new BookingError("Your reservation hold expired. Please start a new booking.");
  const amount = booking.pricing!.totalPayable;
  const { mode, test } = paymentMode();

  if (mode === "RAZORPAY") {
    const order = await createOrder(amount, booking.code, { bookingId: booking.id, bookingCode: booking.code });
    const payment = await db.payment.create({
      data: { bookingId, userId, provider: "RAZORPAY", amount, providerOrderId: order.id, isTest: test },
    });
    return { provider: "RAZORPAY", keyId: env.razorpay.keyId!, orderId: order.id, amount, paymentId: payment.id };
  }
  if (mode === "DEMO") {
    const payment = await db.payment.create({
      data: { bookingId, userId, provider: "DEMO", amount, isTest: true, providerOrderId: `demo_order_${booking.code}_${Date.now()}` },
    });
    return { provider: "DEMO", paymentId: payment.id, amount };
  }
  throw new BookingError("Online payments are not configured yet. Please contact support.");
}

async function capture(paymentId: string, providerPaymentId: string, method: string | null, raw: object) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return null;
  if (payment.status !== "CAPTURED") {
    await db.payment.update({
      where: { id: paymentId },
      data: { status: "CAPTURED", providerPaymentId, method, paidAt: new Date(), raw: raw as object },
    });
  }
  return onBookingPaid(payment.bookingId);
}

/** Razorpay checkout handler callback → verify signature → confirm with the API → mark paid. */
export async function verifyRazorpayCheckout(userId: string, orderId: string, rzpPaymentId: string, signature: string) {
  const payment = await db.payment.findUnique({ where: { providerOrderId: orderId } });
  if (!payment || payment.userId !== userId) throw new BookingError("Payment not found.");
  if (!verifyCheckoutSignature(orderId, rzpPaymentId, signature)) {
    await db.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: "Signature mismatch" } });
    throw new BookingError("Payment verification failed.");
  }
  const remote = await fetchPayment(rzpPaymentId);
  if (remote.order_id !== orderId || remote.amount !== payment.amount * 100 || !["captured", "authorized"].includes(remote.status))
    throw new BookingError("Payment could not be confirmed with the gateway.");
  await capture(payment.id, rzpPaymentId, remote.method, remote);
  return payment.bookingId;
}

export async function handleRazorpayWebhook(event: { event: string; payload: Record<string, { entity: Record<string, unknown> }> }) {
  if (event.event === "payment.captured") {
    const p = event.payload.payment!.entity as { id: string; order_id: string; method: string; amount: number };
    const payment = await db.payment.findUnique({ where: { providerOrderId: p.order_id } });
    if (payment && payment.amount * 100 === p.amount) await capture(payment.id, p.id, p.method, p);
  } else if (event.event === "payment.failed") {
    const p = event.payload.payment!.entity as { order_id: string; error_description?: string };
    await db.payment.updateMany({
      where: { providerOrderId: p.order_id, status: "CREATED" },
      data: { status: "FAILED", failureReason: p.error_description ?? "Payment failed" },
    });
  } else if (event.event === "refund.processed") {
    const r = event.payload.refund!.entity as { id: string };
    await db.refund.updateMany({ where: { providerRefundId: r.id }, data: { status: "PROCESSED", processedAt: new Date() } });
  }
}

/** Demo sandbox — only reachable when no real gateway is configured and DEMO_MODE=true. */
export async function completeDemoPayment(userId: string, paymentId: string, outcome: "success" | "failure") {
  if (!demoPaymentsEnabled) throw new BookingError("Demo payments are disabled.");
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.userId !== userId || payment.provider !== "DEMO") throw new BookingError("Payment not found.");
  if (outcome === "failure") {
    await db.payment.update({ where: { id: paymentId }, data: { status: "FAILED", failureReason: "Simulated failure (demo sandbox)" } });
    return payment.bookingId;
  }
  await capture(paymentId, `demo_pay_${paymentId.slice(-10)}`, "demo", { simulated: true });
  return payment.bookingId;
}

/** Execute a pending refund against the original payment's provider. */
export async function processRefund(refundId: string) {
  const refund = await db.refund.findUnique({ where: { id: refundId }, include: { payment: true, booking: true } });
  if (!refund || refund.status !== "PENDING") return refund;
  if (refund.amount <= 0) {
    return db.refund.update({ where: { id: refundId }, data: { status: "PROCESSED", processedAt: new Date() } });
  }
  const p = refund.payment;
  try {
    if (p?.provider === "RAZORPAY" && p.providerPaymentId && razorpayEnabled) {
      const r = await refundPayment(p.providerPaymentId, refund.amount, { bookingCode: refund.booking.code, type: refund.type });
      await db.refund.update({
        where: { id: refundId },
        data: { providerRefundId: r.id, status: r.status === "processed" ? "PROCESSED" : "PENDING", processedAt: r.status === "processed" ? new Date() : null },
      });
    } else if (p?.provider === "DEMO" || !p) {
      await db.refund.update({ where: { id: refundId }, data: { status: "PROCESSED", processedAt: new Date(), providerRefundId: `demo_rfnd_${refundId.slice(-10)}` } });
    } else {
      return refund; // leave PENDING for manual processing
    }
    if (p) {
      const refunded = await db.refund.aggregate({ where: { paymentId: p.id, status: "PROCESSED" }, _sum: { amount: true } });
      const total = refunded._sum.amount ?? 0;
      await db.payment.update({ where: { id: p.id }, data: { status: total >= p.amount ? "REFUNDED" : total > 0 ? "PARTIALLY_REFUNDED" : p.status } });
    }
    await notify({
      userId: refund.booking.userId,
      type: "REFUND_UPDATE",
      title: "Refund initiated",
      body: `₹${refund.amount.toLocaleString("en-IN")} is on its way back to your original payment method for booking ${refund.booking.code}. It usually takes 5–7 business days.`,
      link: `/dashboard/payments`,
      channels: ["email"],
    });
  } catch (e) {
    await db.refund.update({ where: { id: refundId }, data: { status: "FAILED", reason: `${refund.reason ?? ""} — ${(e as Error).message}`.slice(0, 500) } });
  }
  return db.refund.findUnique({ where: { id: refundId } });
}
