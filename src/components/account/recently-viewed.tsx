"use client";

import { useEffect, useState } from "react";
import { readRecentlyViewed } from "@/components/site/car-detail-client";
import { CarCard } from "@/components/site/car-card";
import type { VehicleCardData } from "@/lib/queries/vehicles";

/** Recently viewed is a per-browser convenience (localStorage); cards are resolved server-side. */
export function RecentlyViewed({ all }: { all: VehicleCardData[] }) {
  const [ids, setIds] = useState<string[] | null>(null);
  useEffect(() => setIds(readRecentlyViewed()), []);
  if (!ids) return null;
  const cars = ids.map((id) => all.find((c) => c.id === id)).filter(Boolean).slice(0, 4) as VehicleCardData[];
  if (!cars.length) return <p className="text-[14px] text-muted">Cars you view will show up here.</p>;
  return (
    <div className="grid gap-6 sm:grid-cols-2 2xl:grid-cols-4">
      {cars.map((c) => (
        <CarCard key={c.id} car={c} />
      ))}
    </div>
  );
}
