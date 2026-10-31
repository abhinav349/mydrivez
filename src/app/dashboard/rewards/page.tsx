import type { Metadata } from "next";
import { Gift, Sparkles, Users } from "lucide-react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { requireCustomerPage } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { formatDate, formatINR } from "@/lib/utils";
import { StatTile } from "@/components/ui/misc";
import { CopyButton } from "@/components/account/copy-button";

export const metadata: Metadata = { title: "Rewards & referrals" };

const TIERS = [
  { name: "Explorer", min: 0 },
  { name: "Voyager", min: 500 },
  { name: "Trailblazer", min: 1500 },
  { name: "Legend", min: 4000 },
];

export default async function RewardsPage() {
  const user = await requireCustomerPage();
  const [me, tx, referrals, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { loyaltyPoints: true, referralCode: true } }),
    db.loyaltyTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    db.user.findMany({ where: { referredById: user.id }, select: { name: true, createdAt: true, _count: { select: { bookings: { where: { status: "COMPLETED" } } } } } }),
    getSettings(),
  ]);
  const lifetime = tx.filter((t) => t.points > 0).reduce((s, t) => s + t.points, 0);
  const tierIdx = TIERS.findLastIndex((t) => lifetime >= t.min);
  const tier = TIERS[tierIdx]!;
  const nextTier = TIERS[tierIdx + 1];
  const link = `${env.appUrl}/register?ref=${me.referralCode}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Rewards & referrals</h1>
        <p className="mt-1 text-[14px] text-muted">
          Earn {settings.loyaltyPointsPer100} point per ₹100 spent, 50 points per review, and {settings.referralBonusPoints} points for every friend who completes a trip.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Points balance" value={me.loyaltyPoints.toLocaleString("en-IN")} sub={`1 point = ₹1 · worth ${formatINR(me.loyaltyPoints)}`} icon={Gift} tone="accent" />
        <StatTile label="Tier" value={tier.name} sub={nextTier ? `${nextTier.min - lifetime} points to ${nextTier.name}` : "Top tier unlocked"} icon={Sparkles} />
        <StatTile label="Friends referred" value={referrals.length} sub={`${referrals.filter((r) => r._count.bookings > 0).length} completed a trip`} icon={Users} />
      </div>

      <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-lime/20 blur-3xl" />
        <p className="eyebrow !text-lime">Refer & earn</p>
        <h2 className="mt-2 max-w-md text-2xl font-semibold tracking-[-0.03em] text-white">Give friends a ride, get {settings.referralBonusPoints} points</h2>
        <p className="mt-2 max-w-lg text-[14px] text-white/60">Share your code. When they complete their first trip, you both win — they get ₹500 off with FIRSTDRIVE.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="rounded-xl border border-dashed border-lime/50 px-4 py-2.5 font-mono text-lg font-bold tracking-widest text-lime">{me.referralCode}</span>
          <CopyButton value={me.referralCode} label="Copy code" className="bg-white/10 text-white hover:bg-white/20" />
          <CopyButton value={link} label="Copy invite link" className="bg-lime text-ink hover:bg-lime-400" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-6 py-4 text-[16px] font-semibold">Points activity</h2>
          <ul className="divide-y divide-line">
            {tx.length ? (
              tx.map((t) => (
                <li key={t.id} className="flex items-center justify-between px-6 py-3 text-[13.5px]">
                  <div>
                    <p className="font-medium text-ink">{t.reason}</p>
                    <p className="text-[12px] text-muted">{formatDate(t.createdAt)}</p>
                  </div>
                  <span className={t.points > 0 ? "font-semibold text-success" : "font-semibold text-danger"}>
                    {t.points > 0 ? "+" : ""}
                    {t.points}
                  </span>
                </li>
              ))
            ) : (
              <li className="px-6 py-8 text-[14px] text-muted">Complete a trip to start earning.</li>
            )}
          </ul>
        </section>
        <section className="card overflow-hidden">
          <h2 className="border-b border-line px-6 py-4 text-[16px] font-semibold">Your referrals</h2>
          <ul className="divide-y divide-line">
            {referrals.length ? (
              referrals.map((r) => (
                <li key={r.name + r.createdAt.toISOString()} className="flex items-center justify-between px-6 py-3 text-[13.5px]">
                  <div>
                    <p className="font-medium text-ink">{r.name}</p>
                    <p className="text-[12px] text-muted">Joined {formatDate(r.createdAt)}</p>
                  </div>
                  <span className={r._count.bookings ? "text-[12.5px] font-semibold text-success" : "text-[12.5px] text-muted"}>{r._count.bookings ? "Trip completed ✓" : "Awaiting first trip"}</span>
                </li>
              ))
            ) : (
              <li className="px-6 py-8 text-[14px] text-muted">No referrals yet — share your code above.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
