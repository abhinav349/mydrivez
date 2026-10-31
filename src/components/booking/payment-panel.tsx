"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, FlaskConical, Landmark, Lock, ShieldCheck, Smartphone, XCircle } from "lucide-react";
import { toast } from "sonner";
import { demoPaymentAction, markPaymentFailedAction, startPaymentAction, verifyRazorpayAction } from "@/app/actions/booking";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: (r: { error: { description: string } }) => void) => void };
  }
}

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export function PaymentPanel({
  bookingId,
  amount,
  mode,
  testMode,
  prefill,
  description,
}: {
  bookingId: string;
  amount: number;
  mode: "RAZORPAY" | "DEMO" | "NONE";
  testMode: boolean;
  prefill: { name: string; email: string; contact: string };
  description: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState<{ paymentId: string } | null>(null);

  const done = (id: string) => router.push(`/book/confirmation/${id}`);

  const pay = async () => {
    setBusy(true);
    const res = await startPaymentAction(bookingId);
    if (!res.ok) {
      toast.error(res.error);
      setBusy(false);
      return;
    }
    const s = res.data;
    if (s.provider === "DEMO") {
      setDemo({ paymentId: s.paymentId });
      setBusy(false);
      return;
    }
    if (!(await loadRazorpay()) || !window.Razorpay) {
      toast.error("Couldn't load the payment gateway. Check your connection and retry.");
      setBusy(false);
      return;
    }
    const rzp = new window.Razorpay({
      key: s.keyId,
      order_id: s.orderId,
      amount: s.amount * 100,
      currency: "INR",
      name: "MyDrivez",
      description,
      prefill,
      theme: { color: "#101820" },
      handler: async (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        const v = await verifyRazorpayAction({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
        if (v.ok) done(v.data.bookingId);
        else {
          toast.error(v.error);
          setBusy(false);
        }
      },
      modal: { ondismiss: () => setBusy(false) },
    });
    rzp.on("payment.failed", async (r) => {
      await markPaymentFailedAction(s.paymentId, r.error.description);
      toast.error(`Payment failed: ${r.error.description}`);
      setBusy(false);
    });
    rzp.open();
  };

  const simulate = async (outcome: "success" | "failure") => {
    if (!demo) return;
    setBusy(true);
    const r = await demoPaymentAction(demo.paymentId, outcome);
    if (!r.ok) {
      toast.error(r.error);
      setBusy(false);
      return;
    }
    if (outcome === "success") done(r.data.bookingId);
    else {
      toast.error("Simulated payment failed. Your booking is still held — try again.");
      setDemo(null);
      setBusy(false);
    }
  };

  if (mode === "NONE")
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning-soft p-5 text-[14px] text-warning">
        Online payments aren&apos;t configured yet. Add Razorpay keys (or enable DEMO_MODE) to accept bookings.
      </div>
    );

  return (
    <div className="space-y-4">
      {mode === "DEMO" && (
        <div className="flex gap-3 rounded-2xl border border-dashed border-warning/50 bg-warning-soft/60 p-4 text-[13px] text-graphite">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p>
            <span className="font-semibold text-warning">Demo payment sandbox.</span> No payment gateway is configured, so this checkout is simulated and no money
            moves. Payments are recorded as <span className="font-mono">DEMO</span> and clearly flagged. Add Razorpay keys to switch to real (test or live) payments.
          </p>
        </div>
      )}
      {mode === "RAZORPAY" && testMode && (
        <p className="rounded-xl bg-info-soft px-4 py-3 text-[13px] text-info">
          Razorpay <b>test mode</b> — use test card 4111 1111 1111 1111 or UPI <span className="font-mono">success@razorpay</span>.
        </p>
      )}

      {!demo ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-[12px] font-medium text-graphite">
            {[
              [Smartphone, "UPI"],
              [CreditCard, "Cards"],
              [Landmark, "Net banking"],
            ].map(([I, l]) => {
              const Icon = I as React.ElementType;
              return (
                <div key={l as string} className="rounded-xl border border-line bg-white py-3">
                  <Icon className="mx-auto mb-1 h-5 w-5 text-ink" />
                  {l as string}
                </div>
              );
            })}
          </div>
          <Button size="lg" className="w-full" loading={busy} onClick={pay}>
            <Lock className="h-4 w-4 text-lime" /> Pay {formatINR(amount)} securely
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-[12px] text-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> Payments are verified server-side with the gateway. We never store card details.
          </p>
        </>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-5">
          <p className="text-[14px] font-semibold text-ink">Simulate the gateway response</p>
          <p className="mt-1 text-[13px] text-muted">Choose an outcome to test the full booking flow.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button variant="primary" loading={busy} onClick={() => simulate("success")}>
              <CheckCircle2 className="h-4 w-4 text-lime" /> Succeed
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => simulate("failure")}>
              <XCircle className="h-4 w-4 text-danger" /> Fail
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
