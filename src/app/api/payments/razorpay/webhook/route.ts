import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/payments/razorpay";
import { handleRazorpayWebhook } from "@/lib/payments/service";

/**
 * POST /api/payments/razorpay/webhook
 * Configure in Razorpay Dashboard → Webhooks with events: payment.captured, payment.failed, refund.processed.
 * The raw body is verified against RAZORPAY_WEBHOOK_SECRET before anything is trusted.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!sig || !verifyWebhookSignature(raw, sig)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  try {
    await handleRazorpayWebhook(JSON.parse(raw));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[razorpay webhook]", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
