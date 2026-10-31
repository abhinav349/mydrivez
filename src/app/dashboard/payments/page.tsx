import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ReceiptText, ShieldCheck, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { PAYMENT_STATUS } from "@/lib/constants";
import { formatDate, formatINR, titleCase } from "@/lib/utils";
import { Badge, DemoBadge, EmptyState, StatTile, StatusBadge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Payments & invoices" };

export default async function PaymentsPage() {
  const user = await requireCustomerPage();
  const [payments, refunds, held] = await Promise.all([
    db.payment.findMany({ where: { userId: user.id, status: { not: "CREATED" } }, orderBy: { createdAt: "desc" }, include: { booking: { include: { vehicle: true } } } }),
    db.refund.findMany({ where: { booking: { userId: user.id } }, orderBy: { createdAt: "desc" }, include: { booking: true } }),
    db.bookingPricing.aggregate({ where: { booking: { userId: user.id, status: { in: ["CONFIRMED", "ACTIVE", "PAYMENT_COMPLETED"] } } }, _sum: { securityDeposit: true } }),
  ]);
  const spent = payments.filter((p) => p.status !== "FAILED").reduce((s, p) => s + p.amount, 0) - refunds.filter((r) => r.status === "PROCESSED").reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Payments & invoices</h1>
        <p className="mt-1 text-[14px] text-muted">Every transaction, refund and deposit — in one place.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total spent (net)" value={formatINR(spent)} icon={Wallet} tone="accent" />
        <StatTile label="Deposits currently held" value={formatINR(held._sum.securityDeposit ?? 0)} icon={ShieldCheck} />
        <StatTile label="Refunds in progress" value={refunds.filter((r) => r.status === "PENDING").length} icon={ReceiptText} />
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line px-6 py-4 text-[16px] font-semibold">Payment history</h2>
        {payments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13.5px]">
              <thead className="bg-paper text-left text-[12px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-6 py-3 font-semibold">Date</th>
                  <th className="px-6 py-3 font-semibold">Booking</th>
                  <th className="px-6 py-3 font-semibold">Transaction</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 text-right font-semibold">Amount</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-6 py-3.5 text-muted">{formatDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-6 py-3.5">
                      <Link href={`/dashboard/bookings/${p.bookingId}`} className="font-medium text-ink hover:underline">
                        {p.booking.vehicle.brand} {p.booking.vehicle.model}
                      </Link>
                      <p className="font-mono text-[11.5px] text-muted">{p.booking.code}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <p className="flex items-center gap-1.5 font-mono text-[12px] text-graphite">
                        {p.providerPaymentId ?? "—"} {p.provider === "DEMO" && <DemoBadge />}
                      </p>
                      <p className="text-[12px] text-muted">{p.method?.toUpperCase()}</p>
                    </td>
                    <td className="px-6 py-3.5">
                      <StatusBadge map={PAYMENT_STATUS} value={p.status} />
                    </td>
                    <td className="px-6 py-3.5 text-right font-semibold text-ink">{formatINR(p.amount)}</td>
                    <td className="px-6 py-3.5 text-right">
                      {p.status !== "FAILED" && (
                        <a href={`/api/bookings/${p.bookingId}/pdf?type=invoice`} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink hover:underline">
                          <FileText className="h-3.5 w-3.5" /> Invoice
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6">
            <EmptyState icon={ReceiptText} title="No payments yet" />
          </div>
        )}
      </section>

      {refunds.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-6 py-4 text-[16px] font-semibold">Refunds & deposit returns</h2>
          <ul className="divide-y divide-line">
            {refunds.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-[13.5px]">
                <div>
                  <p className="font-medium text-ink">
                    {titleCase(r.type)} refund · <span className="font-mono text-[12px] text-muted">{r.booking.code}</span>
                  </p>
                  <p className="text-[12.5px] text-muted">{r.reason}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge tone={r.status === "PROCESSED" ? "success" : r.status === "FAILED" ? "danger" : "warning"}>{titleCase(r.status)}</Badge>
                  <span className="font-semibold text-success">+{formatINR(r.amount)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
