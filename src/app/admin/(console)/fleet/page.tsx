import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { Prisma, VehicleCategory, VehicleStatus } from "@prisma/client";
import { Plus, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { CATEGORY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL, VEHICLE_STATUS } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { PageHeader, Panel, tableCls, td, th, theadCls } from "@/components/admin/ui";
import { DemoBadge, StatusBadge } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = { title: "Fleet" };

export default async function FleetPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireStaffPage();
  const where: Prisma.VehicleWhereInput = {
    ...(sp.status ? { status: sp.status as VehicleStatus } : {}),
    ...(sp.category ? { category: sp.category as VehicleCategory } : {}),
    ...(sp.q ? { OR: [{ brand: { contains: sp.q, mode: "insensitive" } }, { model: { contains: sp.q, mode: "insensitive" } }, { registrationNumber: { contains: sp.q, mode: "insensitive" } }] } : {}),
  };
  const now = new Date();
  const [vehicles, counts] = await Promise.all([
    db.vehicle.findMany({
      where,
      orderBy: [{ status: "asc" }, { brand: "asc" }],
      include: {
        images: { orderBy: { sortOrder: "asc" }, take: 1 },
        location: { include: { city: true } },
        bookings: { where: { status: "CONFIRMED", startAt: { gt: now } }, orderBy: { startAt: "asc" }, take: 1, select: { startAt: true } },
        _count: { select: { bookings: true } },
      },
    }),
    db.vehicle.groupBy({ by: ["status"], _count: true }),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.status, x._count]));

  return (
    <div>
      <PageHeader
        title="Fleet"
        description={`${vehicles.length} vehicles`}
        actions={
          <LinkButton href="/admin/fleet/new" size="sm">
            <Plus className="h-4 w-4" /> Add car
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {[["", "All"], ...Object.entries(VEHICLE_STATUS).map(([k, v]) => [k, v.label])].map(([k, l]) => (
          <Link key={k} href={`/admin/fleet${k ? `?status=${k}` : ""}`} className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${(sp.status ?? "") === k ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:text-ink"}`}>
            {l} {k && <span className={(sp.status ?? "") === k ? "text-lime" : ""}>{c[k] ?? 0}</span>}
          </Link>
        ))}
      </div>
      <Panel>
        <form className="flex flex-wrap gap-2 border-b border-line p-4" action="/admin/fleet">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <input name="q" defaultValue={sp.q} placeholder="Search brand, model, registration…" className="h-10 min-w-[220px] flex-1 rounded-xl border border-line bg-paper px-3 text-[13px] outline-none" />
          <select name="category" defaultValue={sp.category ?? ""} className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px]">
            <option value="">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <button className="h-10 rounded-xl bg-ink px-4 text-[13px] font-semibold text-white">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Vehicle</th>
                <th className={th}>Specs</th>
                <th className={th}>Hub</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Daily</th>
                <th className={`${th} text-right`}>Rating</th>
                <th className={`${th} text-right`}>Trips</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {vehicles.map((v) => {
                const nextBooked = v.status === "AVAILABLE" && v.bookings[0] && v.bookings[0].startAt.getTime() - now.getTime() < 2 * 86_400_000;
                return (
                  <tr key={v.id} className="hover:bg-paper/60">
                    <td className={td}>
                      <Link href={`/admin/fleet/${v.id}`} className="flex items-center gap-3">
                        <span className="relative h-12 w-[72px] shrink-0 overflow-hidden rounded-lg bg-paper">{v.images[0] && <Image src={v.images[0].url} alt="" fill sizes="72px" className="object-cover" />}</span>
                        <span>
                          <span className="flex items-center gap-1.5 font-semibold text-ink hover:underline">
                            {v.brand} {v.model} {v.isDemo && <DemoBadge />}
                          </span>
                          <span className="font-mono text-[11.5px] text-muted">{v.registrationNumber}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={`${td} text-[12.5px] text-muted`}>
                      {CATEGORY_LABEL[v.category]} · {TRANSMISSION_LABEL[v.transmission]} · {FUEL_LABEL[v.fuelType]} · {v.seats}s
                    </td>
                    <td className={`${td} text-[12.5px]`}>
                      {v.location.name}
                      <p className="text-muted">{v.location.city.name}</p>
                    </td>
                    <td className={td}>
                      <StatusBadge map={VEHICLE_STATUS} value={nextBooked ? "BOOKED" : v.status} />
                    </td>
                    <td className={`${td} text-right font-semibold`}>{formatINR(v.dailyRate)}</td>
                    <td className={`${td} text-right`}>
                      {v.ratingCount ? (
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> {v.ratingAvg.toFixed(1)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={`${td} text-right`}>{v.tripCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
