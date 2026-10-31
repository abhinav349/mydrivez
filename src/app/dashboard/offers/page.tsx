import type { Metadata } from "next";
import { BadgePercent, TicketPercent } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { formatDate, formatINR } from "@/lib/utils";
import { EmptyState } from "@/components/ui/misc";
import { CopyButton } from "@/components/account/copy-button";

export const metadata: Metadata = { title: "Offers & coupons" };

export default async function OffersPage() {
  const user = await requireCustomerPage();
  const now = new Date();
  const [coupons, paidCount, used] = await Promise.all([
    db.coupon.findMany({ where: { isActive: true, isPublic: true, validUntil: { gt: now }, validFrom: { lte: now } }, orderBy: { validUntil: "asc" } }),
    db.booking.count({ where: { userId: user.id, status: { in: ["PAYMENT_COMPLETED", "CONFIRMED", "ACTIVE", "COMPLETED"] } } }),
    db.booking.groupBy({ by: ["couponId"], where: { userId: user.id, couponId: { not: null }, status: { in: ["PAYMENT_COMPLETED", "CONFIRMED", "ACTIVE", "COMPLETED"] } }, _count: true }),
  ]);
  const usedMap = new Map(used.map((u) => [u.couponId, u._count]));

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Offers & coupons</h1>
      <p className="mb-6 mt-1 text-[14px] text-muted">Apply these at checkout. The best price is always calculated for you.</p>
      {coupons.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {coupons.map((c) => {
            const exhausted = (usedMap.get(c.id) ?? 0) >= c.perUserLimit || (c.firstBookingOnly && paidCount > 0);
            return (
              <div key={c.id} className={`relative flex overflow-hidden rounded-2xl border border-line bg-white ${exhausted ? "opacity-60" : ""}`}>
                <div className="flex w-28 shrink-0 flex-col items-center justify-center bg-ink p-4 text-center text-lime">
                  <BadgePercent className="h-6 w-6" />
                  <p className="mt-2 font-display text-xl font-semibold leading-tight">{c.discountType === "PERCENT" ? `${c.value}%` : formatINR(c.value)}</p>
                  <p className="text-[11px] text-white/60">OFF</p>
                </div>
                <div className="flex-1 border-l-2 border-dashed border-line p-5">
                  <p className="font-semibold text-ink">{c.title}</p>
                  <p className="mt-1 text-[13px] text-muted">{c.description}</p>
                  <p className="mt-2 text-[12px] text-muted">
                    {c.minBookingAmount > 0 && `Min. booking ${formatINR(c.minBookingAmount)} · `}
                    {c.maxDiscount && `Max ${formatINR(c.maxDiscount)} · `}Valid till {formatDate(c.validUntil)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-lg border border-dashed border-ink/30 px-2.5 py-1 font-mono text-[13px] font-bold text-ink">{c.code}</span>
                    {exhausted ? <span className="text-[12px] font-medium text-muted">Already used</span> : <CopyButton value={c.code} className="bg-paper text-ink hover:bg-lime-100" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState icon={TicketPercent} title="No active offers right now" body="Check back soon — we drop new deals every week." />
      )}
    </div>
  );
}
