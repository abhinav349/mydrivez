import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { CalendarX2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { BookingRow, bookingRowInclude } from "@/components/account/booking-row";
import { EmptyState } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My bookings" };

const TABS = {
  upcoming: { label: "Upcoming", title: "My bookings", where: (now: Date): Prisma.BookingWhereInput => ({ status: { in: ["AWAITING_PAYMENT", "PENDING", "PAYMENT_COMPLETED", "CONFIRMED"] }, endAt: { gt: now } }) },
  active: { label: "Active", title: "Active rentals", where: (): Prisma.BookingWhereInput => ({ status: "ACTIVE" }) },
  history: { label: "History", title: "Booking history", where: (): Prisma.BookingWhereInput => ({ status: { in: ["COMPLETED", "CANCELLED", "REFUNDED"] } }) },
  all: { label: "All", title: "All bookings", where: (): Prisma.BookingWhereInput => ({}) },
} as const;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab: raw } = await searchParams;
  const tab = (raw && raw in TABS ? raw : "upcoming") as keyof typeof TABS;
  const user = await requireCustomerPage();
  const now = new Date();
  const [bookings, counts] = await Promise.all([
    db.booking.findMany({
      where: { userId: user.id, ...TABS[tab].where(now) },
      orderBy: { startAt: tab === "upcoming" ? "asc" : "desc" },
      include: bookingRowInclude,
      take: 50,
    }),
    Promise.all((Object.keys(TABS) as (keyof typeof TABS)[]).map((k) => db.booking.count({ where: { userId: user.id, ...TABS[k].where(now) } }))),
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">{TABS[tab].title}</h1>
          <p className="mt-1 text-[14px] text-muted">Manage trips, download invoices and leave reviews.</p>
        </div>
        <LinkButton href="/cars" variant="secondary" size="sm">
          New booking
        </LinkButton>
      </div>
      <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl border border-line bg-white p-1 scrollbar-none sm:inline-flex">
        {(Object.keys(TABS) as (keyof typeof TABS)[]).map((k, i) => (
          <Link
            key={k}
            href={`/dashboard/bookings?tab=${k}`}
            className={cn("flex items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-colors", k === tab ? "bg-ink text-white" : "text-muted hover:text-ink")}
          >
            {TABS[k].label}
            <span className={cn("rounded-full px-1.5 text-[11px]", k === tab ? "bg-lime text-ink" : "bg-paper")}>{counts[i]}</span>
          </Link>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {bookings.length ? (
          bookings.map((b) => <BookingRow key={b.id} b={b} />)
        ) : (
          <EmptyState icon={CalendarX2} title={`No ${TABS[tab].label.toLowerCase()} bookings`} body="When you book a car, it'll show up here." action={<LinkButton href="/cars">Explore cars</LinkButton>} />
        )}
      </div>
    </div>
  );
}
