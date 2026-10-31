import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { paymentMode } from "@/lib/payments/service";
import { formatDateTime, formatINR } from "@/lib/utils";
import { PaymentPanel } from "@/components/booking/payment-panel";

export const metadata: Metadata = { title: "Complete payment", robots: { index: false } };

export default async function ResumePaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCustomerPage();
  const b = await db.booking.findFirst({ where: { id, userId: user.id }, include: { vehicle: true, pricing: true } });
  if (!b) notFound();
  if (b.status !== "AWAITING_PAYMENT") redirect(`/dashboard/bookings/${b.id}`);
  const expired = !!b.holdExpiresAt && b.holdExpiresAt < new Date();
  const pm = paymentMode();

  return (
    <div className="container max-w-xl py-12">
      <h1 className="text-3xl font-semibold tracking-[-0.035em]">Complete your payment</h1>
      <p className="mt-2 text-[15px] text-muted">
        {b.vehicle.brand} {b.vehicle.model} · {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
      </p>
      <div className="card mt-8 space-y-5 p-6">
        <div className="flex justify-between text-[15px]">
          <span className="text-muted">Amount due ({b.code})</span>
          <span className="font-semibold text-ink">{formatINR(b.pricing!.totalPayable)}</span>
        </div>
        {expired ? (
          <p className="rounded-xl bg-warning-soft px-4 py-3 text-[14px] text-warning">
            Your reservation hold expired. Please{" "}
            <a href={`/cars/${b.vehicle.slug}`} className="font-semibold underline">
              start a new booking
            </a>{" "}
            to re-check availability.
          </p>
        ) : (
          <PaymentPanel
            bookingId={b.id}
            amount={b.pricing!.totalPayable}
            mode={pm.mode}
            testMode={pm.test}
            prefill={{ name: user.name, email: user.email, contact: user.phone ?? "" }}
            description={`${b.vehicle.brand} ${b.vehicle.model} · ${b.code}`}
          />
        )}
      </div>
    </div>
  );
}
