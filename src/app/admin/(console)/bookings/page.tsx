import type { Metadata } from "next";
import Link from "next/link";
import type { BookingStatus, Prisma } from "@prisma/client";
import { Download, Filter } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { BOOKING_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { formatDateTime, formatINR, fromLocalInput } from "@/lib/utils";
import { PageHeader, Pagination, Panel, SortHeader, tableCls, td, th, theadCls } from "@/components/admin/ui";
import { DemoBadge, StatusBadge } from "@/components/ui/misc";
import { BookingQuickView } from "@/components/admin/booking-quickview";

export const metadata: Metadata = { title: "Bookings" };

const PAGE = 15;

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireStaffPage();
  const page = Math.max(1, Number(sp.page) || 1);
  const sort = ["createdAt", "startAt", "endAt", "total"].includes(sp.sort ?? "") ? sp.sort! : "createdAt";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const q = sp.q?.trim();

  const where: Prisma.BookingWhereInput = {
    ...(sp.status ? { status: sp.status as BookingStatus } : {}),
    ...(sp.vehicle ? { vehicleId: sp.vehicle } : {}),
    ...(sp.customer ? { userId: sp.customer } : {}),
    ...(sp.payment ? { payments: { some: { status: sp.payment as "CAPTURED" } } } : {}),
    ...(sp.from || sp.to
      ? { startAt: { ...(sp.from ? { gte: fromLocalInput(`${sp.from}T00:00`) } : {}), ...(sp.to ? { lte: fromLocalInput(`${sp.to}T23:59`) } : {}) } }
      : {}),
    ...(sp.late === "1" ? { status: "ACTIVE", endAt: { lt: new Date() } } : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { phone: { contains: q } } },
            { vehicle: { registrationNumber: { contains: q.replace(/\s/g, ""), mode: "insensitive" } } },
            { vehicle: { model: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const orderBy: Prisma.BookingOrderByWithRelationInput = sort === "total" ? { pricing: { rentalTotal: dir } } : { [sort]: dir };

  const [rows, total, vehicles, statusCounts] = await Promise.all([
    db.booking.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { user: true, vehicle: true, pickupLocation: true, pricing: true, payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    db.booking.count({ where }),
    db.vehicle.findMany({ select: { id: true, brand: true, model: true, registrationNumber: true }, orderBy: { brand: "asc" } }),
    db.booking.groupBy({ by: ["status"], _count: true }),
  ]);
  const counts = Object.fromEntries(statusCounts.map((s) => [s.status, s._count]));
  const params = { q: sp.q, status: sp.status, vehicle: sp.vehicle, customer: sp.customer, payment: sp.payment, from: sp.from, to: sp.to, sort, dir, late: sp.late };
  const exportQs = new URLSearchParams(Object.entries({ status: sp.status, from: sp.from, to: sp.to }).filter(([, v]) => v) as [string, string][]);

  return (
    <div>
      <PageHeader
        title="Bookings"
        description="Every reservation across the fleet."
        actions={
          <a href={`/api/admin/export/bookings?${exportQs}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-[12.5px] font-semibold text-ink hover:border-ink/25">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        }
      />

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {[["", "All"], ["PAYMENT_COMPLETED", "Needs review"], ["CONFIRMED", "Confirmed"], ["ACTIVE", "Active"], ["COMPLETED", "Completed"], ["AWAITING_PAYMENT", "Awaiting payment"], ["CANCELLED", "Cancelled"], ["REFUNDED", "Refunded"]].map(([v, l]) => {
          const qs = new URLSearchParams(Object.entries({ ...params, status: v || undefined, page: undefined, late: undefined }).filter(([, x]) => x) as [string, string][]);
          const active = (sp.status ?? "") === v && !sp.late;
          return (
            <Link key={v} href={`/admin/bookings?${qs}`} className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${active ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:text-ink"}`}>
              {l}
              {v && <span className={active ? "text-lime" : ""}>{counts[v] ?? 0}</span>}
            </Link>
          );
        })}
        <Link href="/admin/bookings?late=1" className={`shrink-0 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${sp.late ? "border-danger bg-danger text-white" : "border-line bg-white text-danger"}`}>
          Late returns
        </Link>
      </div>

      <Panel>
        <form className="grid gap-2 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_.8fr_.8fr_auto]" action="/admin/bookings">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q} placeholder="Booking ID, customer, email, phone, reg…" className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px] outline-none focus:border-ink/30 focus:bg-white" />
          <select name="vehicle" defaultValue={sp.vehicle ?? ""} className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px]">
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} · {v.registrationNumber}
              </option>
            ))}
          </select>
          <select name="payment" defaultValue={sp.payment ?? ""} className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px]">
            <option value="">Any payment status</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
          <input type="date" name="from" defaultValue={sp.from} aria-label="Pickup from" className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px]" />
          <input type="date" name="to" defaultValue={sp.to} aria-label="Pickup to" className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px]" />
          <button className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-ink px-4 text-[13px] font-semibold text-white">
            <Filter className="h-4 w-4" /> Apply
          </button>
        </form>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <SortHeader label="Booking" field="createdAt" sort={sort} dir={dir} params={params} basePath="/admin/bookings" />
                <th className={th}>Customer</th>
                <th className={th}>Vehicle</th>
                <SortHeader label="Pickup" field="startAt" sort={sort} dir={dir} params={params} basePath="/admin/bookings" />
                <SortHeader label="Return" field="endAt" sort={sort} dir={dir} params={params} basePath="/admin/bookings" />
                <th className={th}>Status</th>
                <th className={th}>Payment</th>
                <SortHeader label="Total" field="total" sort={sort} dir={dir} params={params} basePath="/admin/bookings" className="text-right" />
                <th className={th} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((b) => {
                const pay = b.payments[0];
                const late = b.status === "ACTIVE" && b.endAt < new Date();
                return (
                  <tr key={b.id} className="hover:bg-paper/60">
                    <td className={td}>
                      <Link href={`/admin/bookings/${b.id}`} className="font-mono text-[12.5px] font-semibold text-ink hover:underline">
                        {b.code}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-1.5">{b.isDemo && <DemoBadge />}</div>
                    </td>
                    <td className={td}>
                      <Link href={`/admin/customers/${b.userId}`} className="font-medium text-ink hover:underline">
                        {b.user.name}
                      </Link>
                      <p className="text-[12px] text-muted">{b.user.phone}</p>
                    </td>
                    <td className={td}>
                      <p className="font-medium text-ink">
                        {b.vehicle.brand} {b.vehicle.model}
                      </p>
                      <p className="font-mono text-[11.5px] text-muted">{b.vehicle.registrationNumber}</p>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{formatDateTime(b.startAt)}</td>
                    <td className={`${td} whitespace-nowrap ${late ? "font-semibold text-danger" : ""}`}>
                      {formatDateTime(b.endAt)}
                      {late && <p className="text-[11px]">Overdue</p>}
                    </td>
                    <td className={td}>
                      <StatusBadge map={BOOKING_STATUS} value={b.status} />
                    </td>
                    <td className={td}>{pay ? <StatusBadge map={PAYMENT_STATUS} value={pay.status} /> : <span className="text-muted">—</span>}</td>
                    <td className={`${td} text-right font-semibold`}>{formatINR(b.pricing?.rentalTotal ?? 0)}</td>
                    <td className={td}>
                      <BookingQuickView
                        b={{
                          id: b.id,
                          code: b.code,
                          status: b.status,
                          statusLabel: BOOKING_STATUS[b.status].label,
                          customer: b.user.name,
                          email: b.user.email,
                          phone: b.user.phone ?? "—",
                          vehicle: `${b.vehicle.brand} ${b.vehicle.model}`,
                          reg: b.vehicle.registrationNumber,
                          hub: b.pickupLocation.name,
                          start: formatDateTime(b.startAt),
                          end: formatDateTime(b.endAt),
                          total: formatINR(b.pricing?.rentalTotal ?? 0),
                          deposit: formatINR(b.pricing?.securityDeposit ?? 0),
                          payment: pay ? `${PAYMENT_STATUS[pay.status].label} · ${pay.provider}` : "None",
                          coupon: b.pricing?.couponCode ?? null,
                          note: b.customerNote,
                          doorstep: b.deliveryType === "DOORSTEP" ? b.deliveryAddress : null,
                          isDemo: b.isDemo,
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="px-4 py-14 text-center text-muted">
                    No bookings match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE} total={total} params={params} basePath="/admin/bookings" />
      </Panel>
    </div>
  );
}
