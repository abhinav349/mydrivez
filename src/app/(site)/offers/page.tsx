import type { Metadata } from "next";
import { BadgePercent } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate, formatINR } from "@/lib/utils";
import { PageHero } from "@/components/site/page-hero";
import { LinkButton } from "@/components/ui/button";
import { CopyButton } from "@/components/account/copy-button";

export const metadata: Metadata = { title: "Offers & deals", description: "Weekend deals, long-term rental discounts and first-booking offers on self-drive cars." };

export default async function OffersPage() {
  const now = new Date();
  const coupons = await db.coupon.findMany({ where: { isActive: true, isPublic: true, validFrom: { lte: now }, validUntil: { gt: now } }, orderBy: { validUntil: "asc" } });
  return (
    <>
      <PageHero eyebrow="Offers" title={<>Deals worth <span className="text-lime">hitting the road</span> for.</>} body="Apply any code at checkout — we'll validate it and show your savings before you pay." image="/photos/cat-ev.jpg" />
      <section className="py-20">
        <div className="container grid gap-5 md:grid-cols-2">
          {coupons.map((c) => (
            <div key={c.id} className="flex overflow-hidden rounded-3xl border border-line bg-white">
              <div className="flex w-36 shrink-0 flex-col items-center justify-center bg-ink p-5 text-center text-lime">
                <BadgePercent className="h-7 w-7" />
                <p className="mt-3 font-display text-2xl font-semibold">{c.discountType === "PERCENT" ? `${c.value}%` : formatINR(c.value)}</p>
                <p className="text-[11px] text-white/60">OFF</p>
              </div>
              <div className="flex-1 border-l-2 border-dashed border-line p-6">
                <h2 className="text-lg font-semibold">{c.title}</h2>
                <p className="mt-1 text-[14px] text-muted">{c.description}</p>
                <p className="mt-3 text-[12.5px] text-muted">
                  {c.minBookingAmount > 0 && `Min. booking ${formatINR(c.minBookingAmount)} · `}
                  {c.firstBookingOnly && "First booking only · "}Valid till {formatDate(c.validUntil)}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="rounded-lg border border-dashed border-ink/30 px-3 py-1.5 font-mono text-[14px] font-bold">{c.code}</span>
                  <CopyButton value={c.code} className="bg-paper text-ink hover:bg-lime-100" />
                </div>
              </div>
            </div>
          ))}
          {!coupons.length && <p className="text-muted">No offers running right now — check back soon.</p>}
        </div>
        <div className="container mt-12 text-center">
          <LinkButton href="/cars" size="lg">
            Browse cars
          </LinkButton>
        </div>
      </section>
    </>
  );
}
