import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Minimal Razorpay REST client (no SDK needed). Amounts in rupees in, paise on the wire. */

const API = "https://api.razorpay.com/v1";

function authHeader() {
  return "Basic " + Buffer.from(`${env.razorpay.keyId}:${env.razorpay.keySecret}`).toString("base64");
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: authHeader(), "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as { error?: { description?: string } }).error?.description ?? `Razorpay error ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string; status: string };

export function createOrder(amountRupees: number, receipt: string, notes: Record<string, string>) {
  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: "INR", receipt, notes, payment_capture: 1 }),
  });
}

export function fetchPayment(paymentId: string) {
  return call<{ id: string; order_id: string; amount: number; status: string; method: string }>(`/payments/${paymentId}`);
}

export function refundPayment(paymentId: string, amountRupees: number, notes: Record<string, string>) {
  return call<{ id: string; status: string }>(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), notes, speed: "normal" }),
  });
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Checkout callback signature: HMAC_SHA256(order_id|payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const expected = createHmac("sha256", env.razorpay.keySecret!).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw body, webhook secret). */
export function verifyWebhookSignature(rawBody: string, signature: string) {
  if (!env.razorpay.webhookSecret) return false;
  const expected = createHmac("sha256", env.razorpay.webhookSecret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
