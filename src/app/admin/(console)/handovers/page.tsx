import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, KeyRound, MapPin, Undo2 } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge, DemoBadge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Handovers" };

export default async function HandoversPage() {
  await requireStaffPage("handover:write");
  const now = new Date();
  const week = new Date(now.getTime() + 7 * 86_400_000);
  const [pickups, returns, recent] = await Promise.all([
    db.booking.findMany({ where: { status: "CONFIRMED", startAt: { lt: week } }, orderBy: { startAt: "asc" }, include: { user: true, vehicle: true, pickupLocation: true } }),
    db.booking.findMany({ where: { status: "ACTIVE" }, orderBy: { endAt: "asc" }, include: { user: true, vehicle: true, pickupLocation: true } }),
    db.handoverRecord.findMany({ orderBy: { recordedAt: "desc" }, take: 10, include: { booking: { include: { vehicle: true, user: true } }, recordedBy: { select: { name: true } } } }),
  ]);

  const Card = ({ b, kind }: { b: (typeof pickups)[number]; kind: "pickup" | "return" }) => {
    const when = kind === "pickup" ? b.startAt : b.endAt;
    const overdue = when < now;
    return (
      <Link href={`/admin/bookings/${b.id}`} className="group flex items-center gap-4 px-5 py-4 hover:bg-paper/60">
        <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-center ${overdue ? "bg-danger-soft text-danger" : "bg-paper text-ink"}`}>
          <span className="text-[10px] font-bold uppercase">{when.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" })}</span>
          <span className="text-lg font-bold leading-none">{when.toLocaleDateString("en-IN", { day: "numeric", timeZone: "Asia/Kolkata" })}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-semibold text-ink">
            {b.vehicle.brand} {b.vehicle.model} <span className="font-mono text-[11.5px] font-normal text-muted">{b.vehicle.registrationNumber}</span> {b.isDemo && <DemoBadge />}
          </p>
          <p className="text-[12.5px] text-muted">
            {b.user.name} · {b.user.phone} · <span className="font-mono">{b.code}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted">
            <MapPin className="h-3 w-3" /> {b.deliveryType === "DOORSTEP" ? `Doorstep: ${b.deliveryAddress}` : b.pickupLocation.name}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-[13px] font-semibold ${overdue ? "text-danger" : "text-ink"}`}>{formatDateTime(when)}</p>
          <p className={`text-[12px] ${overdue ? "text-danger" : "text-muted"}`}>{overdue ? `overdue ${relativeTime(when).replace(" ago", "")}` : relativeTime(when)}</p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-muted group-hover:text-ink" />
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Vehicle handovers" description="Upcoming pickups in the next 7 days and every car currently on a trip." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={<span className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Pickups ({pickups.length})</span>}>
          <div className="divide-y divide-line">{pickups.length ? pickups.map((b) => <Card key={b.id} b={b} kind="pickup" />) : <p className="px-5 py-10 text-center text-[13.5px] text-muted">No pickups this week.</p>}</div>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Undo2 className="h-4 w-4" /> Returns due ({returns.length})</span>}>
          <div className="divide-y divide-line">{returns.length ? returns.map((b) => <Card key={b.id} b={b} kind="return" />) : <p className="px-5 py-10 text-center text-[13.5px] text-muted">No cars on the road.</p>}</div>
        </Panel>
      </div>
      <Panel title="Recent handover records">
        <ul className="divide-y divide-line text-[13.5px]">
          {recent.map((h) => (
            <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <span className="flex items-center gap-2">
                <Badge tone={h.type === "PICKUP" ? "accent" : "info"}>{h.type === "PICKUP" ? "Pickup" : "Return"}</Badge>
                <Link href={`/admin/bookings/${h.bookingId}`} className="font-medium text-ink hover:underline">
                  {h.booking.vehicle.brand} {h.booking.vehicle.model}
                </Link>
                <span className="text-muted">· {h.booking.user.name}</span>
              </span>
              <span className="text-muted">
                {h.odometer.toLocaleString("en-IN")} km · {h.fuelLevel}% · by {h.recordedBy.name} · {relativeTime(h.recordedAt)}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
