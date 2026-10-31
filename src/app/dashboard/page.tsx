import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Bell, CalendarCheck, Car, FileCheck2, Gift, KeyRound, Route, TicketPercent } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { formatDateTime, formatINR, relativeTime } from "@/lib/utils";
import { BookingRow, bookingRowInclude } from "@/components/account/booking-row";
import { EmptyState, StatTile } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardHome() {
  const user = await requireCustomerPage();
  const now = new Date();
  const [profile, docs, upcoming, active, pastCount, completedCount, notifications, coupons, me, awaiting] = await Promise.all([
    db.customerProfile.findUnique({ where: { userId: user.id } }),
    db.customerDocument.findMany({ where: { userId: user.id } }),
    db.booking.findMany({ where: { userId: user.id, status: { in: ["CONFIRMED", "PAYMENT_COMPLETED", "PENDING"] }, startAt: { gt: now } }, orderBy: { startAt: "asc" }, take: 3, include: bookingRowInclude }),
    db.booking.findMany({ where: { userId: user.id, status: "ACTIVE" }, include: bookingRowInclude }),
    db.booking.count({ where: { userId: user.id, status: { in: ["COMPLETED", "CANCELLED", "REFUNDED"] } } }),
    db.booking.count({ where: { userId: user.id, status: "COMPLETED" } }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.coupon.count({ where: { isActive: true, isPublic: true, validUntil: { gt: now } } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { loyaltyPoints: true } }),
    db.booking.findMany({ where: { userId: user.id, status: "AWAITING_PAYMENT", holdExpiresAt: { gt: now } }, include: { vehicle: true } }),
  ]);

  const checks = [
    ["Verify email", user.emailVerified, "/verify-email"],
    ["Add mobile number", !!user.phone, "/dashboard/profile"],
    ["Profile photo", !!user.avatarUrl, "/dashboard/profile"],
    ["Date of birth", !!profile?.dateOfBirth, "/dashboard/profile"],
    ["Address", !!profile?.addressLine1, "/dashboard/profile"],
    ["Licence details", !!profile?.licenseNumber, "/dashboard/profile"],
    ["Emergency contact", !!profile?.emergencyName, "/dashboard/profile"],
    ["Upload driving licence", docs.some((d) => d.type === "DRIVING_LICENSE" && d.status !== "REJECTED"), "/dashboard/documents"],
    ["Upload government ID", docs.some((d) => d.type === "GOVERNMENT_ID" && d.status !== "REJECTED"), "/dashboard/documents"],
  ] as const;
  const done = checks.filter((c) => c[1]).length;
  const pct = Math.round((done / checks.length) * 100);
  const nextStep = checks.find((c) => !c[1]);
  const hour = Number(new Date().toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white sm:p-8">
        <Image src="/photos/road.jpg" alt="" fill sizes="100vw" className="object-cover opacity-25" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-ink/40" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[14px] text-white/60">{greet},</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] text-white sm:text-4xl">{user.name.split(" ")[0]} 👋</h1>
            <p className="mt-2 max-w-md text-[14.5px] text-white/60">
              {active.length ? "Enjoy the drive — your trip is in progress." : upcoming.length ? `Your next trip starts ${relativeTime(upcoming[0]!.startAt)}.` : "Where to next? Your perfect ride is a few taps away."}
            </p>
          </div>
          <div className="w-full max-w-xs rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-white/70">Profile completion</span>
              <span className="font-semibold text-lime">{pct}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${pct}%` }} />
            </div>
            {nextStep && (
              <Link href={nextStep[2]} className="mt-3 flex items-center justify-between text-[13px] font-medium text-white hover:text-lime">
                Next: {nextStep[0]} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {awaiting.map((b) => (
        <div key={b.id} className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-warning/30 bg-warning-soft p-4 sm:flex-row sm:items-center">
          <p className="text-[14px] text-graphite">
            <span className="font-semibold text-warning">Payment pending:</span> {b.vehicle.brand} {b.vehicle.model} ({b.code}) is held until {formatDateTime(b.holdExpiresAt!)}.
          </p>
          <LinkButton href={`/book/pay/${b.id}`} size="sm">
            Complete payment
          </LinkButton>
        </div>
      ))}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile label="Upcoming trips" value={upcoming.length} icon={CalendarCheck} tone="accent" />
        <StatTile label="Active rentals" value={active.length} icon={KeyRound} />
        <StatTile label="Total trips" value={completedCount} sub={`${pastCount} past bookings`} icon={Route} />
        <StatTile label="Loyalty points" value={me.loyaltyPoints} sub={`Worth ${formatINR(me.loyaltyPoints)}`} icon={Gift} />
      </section>

      {active.length > 0 && (
        <section>
          <SectionTitle title="Active rental" href="/dashboard/bookings?tab=active" />
          <div className="space-y-3">
            {active.map((b) => (
              <BookingRow key={b.id} b={b} />
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 xl:grid-cols-[1.6fr_1fr]">
        <section>
          <SectionTitle title="Upcoming bookings" href="/dashboard/bookings" />
          {upcoming.length ? (
            <div className="space-y-3">
              {upcoming.map((b) => (
                <BookingRow key={b.id} b={b} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Car} title="No upcoming trips" body="Find a car for your next weekend getaway or work trip." action={<LinkButton href="/cars">Explore cars</LinkButton>} />
          )}
        </section>

        <div className="space-y-6">
          <section className="card p-5">
            <SectionTitle title="Notifications" href="/dashboard/notifications" small />
            {notifications.length ? (
              <ul className="space-y-1">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <Link href={n.link ?? "/dashboard/notifications"} className="flex gap-3 rounded-xl p-2.5 hover:bg-paper">
                      <span className="relative mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-paper">
                        <Bell className="h-4 w-4 text-ink" />
                        {!n.readAt && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-danger" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-ink">{n.title}</span>
                        <span className="block text-[12px] text-muted">{relativeTime(n.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-muted">You&apos;re all caught up.</p>
            )}
          </section>
          <div className="grid grid-cols-2 gap-4">
            <QuickLink href="/dashboard/offers" icon={TicketPercent} title={`${coupons} offers`} body="Available coupons" />
            <QuickLink href="/dashboard/documents" icon={FileCheck2} title="Documents" body={docs.every((d) => d.status === "VERIFIED") && docs.length >= 2 ? "All verified" : "Action needed"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, href, small }: { title: string; href: string; small?: boolean }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className={small ? "text-[15px] font-semibold" : "text-lg font-semibold tracking-[-0.02em]"}>{title}</h2>
      <Link href={href} className="text-[13px] font-semibold text-muted hover:text-ink">
        View all
      </Link>
    </div>
  );
}

function QuickLink({ href, icon: Icon, title, body }: { href: string; icon: React.ElementType; title: string; body: string }) {
  return (
    <Link href={href} className="card group p-4 transition-all hover:shadow-lift">
      <Icon className="h-5 w-5 text-ink" />
      <p className="mt-3 text-[14px] font-semibold text-ink">{title}</p>
      <p className="text-[12px] text-muted">{body}</p>
    </Link>
  );
}
