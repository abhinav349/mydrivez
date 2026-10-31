import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarRange, Car, FileCheck2, IndianRupee, KeyRound, Users, XCircle, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { getAnalytics, getOverviewCounts, parseRange, RANGES } from "@/lib/queries/admin";
import { BOOKING_STATUS } from "@/lib/constants";
import { formatCompactINR, formatDateTime, formatINR, relativeTime } from "@/lib/utils";
import { BookingTrendChart, RevenueChart } from "@/components/admin/charts";
import { Kpi, PageHeader, Panel, Segmented, tableCls, td, th, theadCls } from "@/components/admin/ui";
import { DemoBadge, StatusBadge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Admin dashboard" };

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireStaffPage();
  const range = parseRange(sp.range);
  const includeDemo = sp.data !== "live";
  const [a, c, recent, handovers] = await Promise.all([
    getAnalytics(range, includeDemo),
    getOverviewCounts(includeDemo),
    db.booking.findMany({
      where: includeDemo ? {} : { isDemo: false },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { user: { select: { name: true } }, vehicle: { select: { brand: true, model: true } }, pricing: { select: { rentalTotal: true } } },
    }),
    db.booking.findMany({
      where: {
        OR: [
          { status: "CONFIRMED", startAt: { lt: new Date(Date.now() + 2 * 86_400_000) } },
          { status: "ACTIVE", endAt: { lt: new Date(Date.now() + 2 * 86_400_000) } },
        ],
      },
      orderBy: { startAt: "asc" },
      take: 6,
      include: { user: { select: { name: true } }, vehicle: { select: { brand: true, model: true, registrationNumber: true } } },
    }),
  ]);
  const params = { range, data: sp.data };

  return (
    <div className="space-y-6">
      {sp.denied && (
        <p className="flex items-center gap-2 rounded-xl bg-warning-soft px-4 py-3 text-[13.5px] font-medium text-warning">
          <AlertTriangle className="h-4 w-4" /> You don&apos;t have permission for that section. Ask an administrator for access.
        </p>
      )}
      <PageHeader
        title={`Welcome back, ${user.name.split(" ")[0]}`}
        description={`Here's how MyDrivez is performing over the last ${RANGES[range].label}.`}
        actions={
          <>
            <Segmented basePath="/admin" param="data" value={includeDemo ? "all" : "live"} params={params} options={[{ value: "all", label: "Incl. demo" }, { value: "live", label: "Live only" }]} />
            <Segmented basePath="/admin" param="range" value={range} params={params} options={Object.entries(RANGES).map(([k, v]) => ({ value: k, label: v.label }))} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Total revenue" value={formatCompactINR(a.revenue)} delta={a.revenueDelta} sub="vs previous period" icon={IndianRupee} href="/admin/analytics" />
        <Kpi label="Total bookings" value={a.bookings} delta={a.bookingsDelta} sub={`avg ${formatINR(a.avgBookingValue)}`} icon={CalendarRange} href="/admin/bookings" />
        <Kpi label="Active rentals" value={c.active} sub="on the road now" icon={KeyRound} href="/admin/bookings?status=ACTIVE" />
        <Kpi label="Available cars" value={c.available} sub={`${a.fleetUtil}% fleet utilisation`} icon={Car} href="/admin/fleet" />
        <Kpi label="Total customers" value={c.customers} sub={`+${a.newCustomers} this period`} icon={Users} href="/admin/customers" />
        <Kpi label="Pending bookings" value={c.pending} sub={`${c.awaitingReview} need review`} icon={Clock} href="/admin/bookings?status=PAYMENT_COMPLETED" />
        <Kpi label="Pending verifications" value={c.verifications} sub="documents to review" icon={FileCheck2} href="/admin/verifications" />
        <Kpi label="Cancelled bookings" value={a.cancelled} sub={`${a.cancellationRate}% cancellation rate`} icon={XCircle} href="/admin/bookings?status=CANCELLED" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Revenue" action={<span className="text-[12px] text-muted">by {a.granularity}</span>}>
          <div className="p-4 pt-5">
            <RevenueChart data={a.timeline} />
          </div>
        </Panel>
        <Panel title="Booking trend" action={<span className="text-[12px] text-muted">by {a.granularity}</span>}>
          <div className="p-4 pt-5">
            <BookingTrendChart data={a.timeline} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Recent bookings"
          action={
            <Link href="/admin/bookings" className="text-[12.5px] font-semibold text-muted hover:text-ink">
              View all
            </Link>
          }
        >
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={th}>Booking</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Vehicle</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recent.map((b) => (
                  <tr key={b.id} className="hover:bg-paper/60">
                    <td className={td}>
                      <Link href={`/admin/bookings/${b.id}`} className="font-mono text-[12.5px] font-semibold text-ink hover:underline">
                        {b.code}
                      </Link>
                      <p className="flex items-center gap-1.5 text-[11.5px] text-muted">
                        {relativeTime(b.createdAt)} {b.isDemo && <DemoBadge />}
                      </p>
                    </td>
                    <td className={td}>{b.user.name}</td>
                    <td className={td}>
                      {b.vehicle.brand} {b.vehicle.model}
                    </td>
                    <td className={td}>
                      <StatusBadge map={BOOKING_STATUS} value={b.status} />
                    </td>
                    <td className={`${td} text-right font-semibold`}>{formatINR(b.pricing?.rentalTotal ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Handovers in the next 48h"
          action={
            <Link href="/admin/handovers" className="text-[12.5px] font-semibold text-muted hover:text-ink">
              Open
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {handovers.map((b) => {
              const isReturn = b.status === "ACTIVE";
              const when = isReturn ? b.endAt : b.startAt;
              const overdue = when < new Date();
              return (
                <li key={b.id}>
                  <Link href={`/admin/bookings/${b.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-paper/60">
                    <span className={`rounded-lg px-2 py-1 text-[11px] font-bold uppercase ${isReturn ? "bg-info-soft text-info" : "bg-lime-100 text-lime-600"}`}>{isReturn ? "Return" : "Pickup"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-ink">
                        {b.vehicle.brand} {b.vehicle.model} · {b.user.name}
                      </p>
                      <p className={`text-[12px] ${overdue ? "font-semibold text-danger" : "text-muted"}`}>
                        {overdue ? "Overdue · " : ""}
                        {formatDateTime(when)}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
            {!handovers.length && <li className="px-5 py-8 text-center text-[13.5px] text-muted">Nothing scheduled.</li>}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
