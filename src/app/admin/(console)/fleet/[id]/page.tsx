import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { getBookedRanges } from "@/lib/queries/vehicles";
import { BOOKING_STATUS, VEHICLE_STATUS } from "@/lib/constants";
import { formatDate, formatDateTime, formatINR, titleCase } from "@/lib/utils";
import { PageHeader, Panel } from "@/components/admin/ui";
import { Badge, StatusBadge } from "@/components/ui/misc";
import { VehicleForm } from "@/components/admin/vehicle-form";
import { DocumentRow, ImageManager, MaintenanceStatus, StatusControls } from "@/components/admin/fleet-controls";
import { AvailabilityCalendar } from "@/components/site/car-detail-client";

export const metadata: Metadata = { title: "Vehicle" };

const DOC_TYPES = ["INSURANCE", "PUC", "REGISTRATION", "FITNESS", "PERMIT"] as const;

export default async function VehicleAdminPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  await requireStaffPage();
  const v = await db.vehicle.findUnique({
    where: { id },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      features: true,
      documents: true,
      maintenance: { orderBy: { scheduledFor: "desc" }, take: 10 },
      location: { include: { city: true } },
      bookings: { orderBy: { startAt: "desc" }, take: 15, include: { user: { select: { name: true } }, pricing: { select: { rentalTotal: true } } } },
    },
  });
  if (!v) notFound();
  const [locs, ranges, revenue] = await Promise.all([
    db.vehicleLocation.findMany({ where: { isActive: true }, include: { city: true }, orderBy: { name: "asc" } }),
    getBookedRanges(v.id, 90),
    db.bookingPricing.aggregate({ where: { booking: { vehicleId: v.id, status: "COMPLETED" } }, _sum: { rentalTotal: true } }),
  ]);

  return (
    <div className="space-y-6">
      <Link href="/admin/fleet" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Fleet
      </Link>
      {sp.created && <p className="rounded-xl bg-success-soft px-4 py-3 text-[13.5px] font-medium text-success">Vehicle added. It&apos;s live on the website if its status is Available.</p>}
      <PageHeader
        title={`${v.brand} ${v.model}`}
        description={`${v.registrationNumber} · ${v.location.name}, ${v.location.city.name} · ${v.tripCount} trips · ${formatINR(revenue._sum.rentalTotal ?? 0)} lifetime revenue`}
        actions={
          <>
            <StatusBadge map={VEHICLE_STATUS} value={v.status} />
            <Link href={`/cars/${v.slug}`} target="_blank" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-[12.5px] font-semibold">
              <ExternalLink className="h-4 w-4" /> Public page
            </Link>
            <StatusControls id={v.id} status={v.status} />
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title="Photos">
          <div className="p-5">
            <ImageManager images={v.images} />
          </div>
        </Panel>
        <Panel title="Availability (next 90 days)">
          <div className="p-4">
            <AvailabilityCalendar ranges={ranges} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Compliance documents">
          <div className="space-y-3 p-5">
            {DOC_TYPES.map((t) => {
              const d = v.documents.find((x) => x.type === t);
              return <DocumentRow key={t} vehicleId={v.id} type={t} number={d?.number ?? ""} expiresAt={d ? d.expiresAt.toISOString().slice(0, 10) : ""} />;
            })}
          </div>
        </Panel>
        <Panel title="Maintenance" action={<Link href={`/admin/maintenance?vehicle=${v.id}`} className="text-[12.5px] font-semibold text-muted hover:text-ink">Schedule</Link>}>
          <ul className="divide-y divide-line text-[13px]">
            {v.maintenance.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-ink">{m.title}</p>
                  <p className="text-muted">
                    {formatDate(m.scheduledFor)} · {titleCase(m.status)} {m.cost ? `· ${formatINR(m.cost)}` : ""}
                  </p>
                </div>
                <MaintenanceStatus id={m.id} status={m.status} />
              </li>
            ))}
            {!v.maintenance.length && <li className="px-5 py-6 text-muted">No maintenance records.</li>}
          </ul>
        </Panel>
      </div>

      <Panel title="Booking history">
        <ul className="divide-y divide-line text-[13px]">
          {v.bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-paper/60">
                <span>
                  <span className="font-mono font-semibold text-ink">{b.code}</span> <span className="text-muted">· {b.user.name}</span>
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
                  <StatusBadge map={BOOKING_STATUS} value={b.status} />
                  <span className="w-20 text-right font-semibold text-ink">{formatINR(b.pricing?.rentalTotal ?? 0)}</span>
                </span>
              </Link>
            </li>
          ))}
          {!v.bookings.length && <li className="px-5 py-6 text-muted">No bookings yet.</li>}
        </ul>
      </Panel>

      <div>
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
          Edit details <Badge>changes go live instantly</Badge>
        </h2>
        <VehicleForm
          locations={locs.map((l) => ({ id: l.id, label: `${l.name}, ${l.city.name}` }))}
          data={{
            id: v.id,
            brand: v.brand,
            model: v.model,
            variant: v.variant ?? "",
            registrationNumber: v.registrationNumber,
            year: v.year,
            category: v.category,
            fuelType: v.fuelType,
            transmission: v.transmission,
            seats: v.seats,
            engine: v.engine ?? "",
            mileage: v.mileage ?? "",
            color: v.color ?? "",
            description: v.description,
            features: v.features.map((f) => f.name).join("\n"),
            hourlyRate: v.hourlyRate,
            dailyRate: v.dailyRate,
            weeklyRate: v.weeklyRate,
            monthlyRate: v.monthlyRate,
            securityDeposit: v.securityDeposit,
            includedKmPerDay: v.includedKmPerDay,
            extraKmCharge: v.extraKmCharge,
            fuelPolicy: v.fuelPolicy,
            locationId: v.locationId,
            status: v.status,
            isFeatured: v.isFeatured,
          }}
        />
      </div>
    </div>
  );
}
