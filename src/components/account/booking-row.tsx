import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, MapPin } from "lucide-react";
import type { Booking, BookingPricing, Vehicle, VehicleImage, VehicleLocation } from "@prisma/client";
import { BOOKING_STATUS } from "@/lib/constants";
import { formatDateTime, formatINR } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/misc";

export type BookingRowData = Booking & {
  vehicle: Vehicle & { images: VehicleImage[] };
  pickupLocation: VehicleLocation;
  pricing: BookingPricing | null;
};

export function BookingRow({ b }: { b: BookingRowData }) {
  const upcoming = b.status === "CONFIRMED" && b.startAt > new Date() ? "Upcoming" : null;
  return (
    <Link href={`/dashboard/bookings/${b.id}`} className="group flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 transition-all hover:border-ink/15 hover:shadow-card sm:flex-row sm:items-center">
      <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl bg-paper sm:w-40">
        {b.vehicle.images[0] && <Image src={b.vehicle.images[0].url} alt="" fill sizes="160px" className="object-cover transition-transform duration-500 group-hover:scale-105" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[16px] font-semibold text-ink">
            {b.vehicle.brand} {b.vehicle.model}
          </p>
          <StatusBadge map={BOOKING_STATUS} value={b.status} override={upcoming} />
        </div>
        <p className="mt-0.5 font-mono text-[12px] text-muted">{b.code}</p>
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-graphite/80">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5 text-muted" /> {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-muted" /> {b.deliveryType === "DOORSTEP" ? "Doorstep delivery" : b.pickupLocation.name}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
        <p className="font-display text-lg font-semibold text-ink">{formatINR(b.pricing?.rentalTotal ?? 0)}</p>
        <span className="flex items-center gap-1 text-[13px] font-semibold text-ink opacity-70 group-hover:opacity-100">
          Details <ArrowUpRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
}

export const bookingRowInclude = {
  vehicle: { include: { images: { orderBy: { sortOrder: "asc" as const }, take: 1 } } },
  pickupLocation: true,
  pricing: true,
};
