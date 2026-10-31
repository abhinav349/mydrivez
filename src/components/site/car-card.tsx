"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowUpRight, Fuel, Heart, MapPin, Settings2, Star, Users } from "lucide-react";
import { toast } from "sonner";
import { toggleWishlist } from "@/app/actions/public";
import { CATEGORY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/constants";
import type { VehicleCardData } from "@/lib/queries/vehicles";
import { cn, formatINR } from "@/lib/utils";
import { buttonClass } from "@/components/ui/button";

export function CarCard({
  car,
  saved = false,
  query = "",
  priority = false,
}: {
  car: VehicleCardData;
  saved?: boolean;
  query?: string;
  priority?: boolean;
}) {
  const router = useRouter();
  const [isSaved, setSaved] = useState(saved);
  const [pending, start] = useTransition();
  const href = `/cars/${car.slug}${query}`;

  const onSave = (e: React.MouseEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await toggleWishlist(car.id);
      if (!res.ok) {
        if (res.error === "login") {
          toast("Sign in to save cars", { action: { label: "Sign in", onClick: () => router.push(`/login?next=/cars/${car.slug}`) } });
        } else toast.error(res.error);
        return;
      }
      setSaved(Boolean(res.saved));
      toast.success(res.saved ? "Saved to your wishlist" : "Removed from wishlist");
    });
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-all duration-300 hover:-translate-y-1 hover:border-ink/15 hover:shadow-lift",
        !car.available && "opacity-75",
      )}
    >
      <Link href={href} className="relative block aspect-[16/10] overflow-hidden bg-paper" aria-label={`${car.brand} ${car.model}`}>
        {car.image && (
          <Image
            src={car.image}
            alt={`${car.brand} ${car.model}`}
            fill
            priority={priority}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink/50 via-transparent to-transparent opacity-80" />
        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-ink backdrop-blur">{CATEGORY_LABEL[car.category]}</span>
          {car.fuelType === "ELECTRIC" && <span className="rounded-full bg-lime px-2.5 py-1 text-[11px] font-semibold text-ink">EV</span>}
        </div>
        <span
          className={cn(
            "absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur",
            car.available ? "bg-ink/70 text-lime" : "bg-white/90 text-danger",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", car.available ? "bg-lime" : "bg-danger")} />
          {car.available ? "Available" : "Booked for these dates"}
        </span>
      </Link>
      <button
        onClick={onSave}
        disabled={pending}
        aria-label={isSaved ? "Remove from wishlist" : "Save to wishlist"}
        className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 backdrop-blur transition-transform hover:scale-110 active:scale-95"
      >
        <Heart className={cn("h-4 w-4 transition-colors", isSaved ? "fill-danger text-danger" : "text-ink")} />
      </button>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-muted">{car.brand}</p>
            <h3 className="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.025em]">
              <Link href={href} className="after:absolute after:inset-0 after:content-[''] focus:outline-none">
                {car.model}
              </Link>
            </h3>
          </div>
          {car.ratingCount > 0 ? (
            <span className="flex shrink-0 items-center gap-1 rounded-lg bg-paper px-2 py-1 text-[12.5px] font-semibold text-ink">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {car.ratingAvg.toFixed(1)}
              <span className="font-normal text-muted">({car.ratingCount})</span>
            </span>
          ) : (
            <span className="shrink-0 rounded-lg bg-lime-100 px-2 py-1 text-[11.5px] font-semibold text-lime-600">New</span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[12.5px] text-graphite/80">
          <Spec icon={Settings2}>{TRANSMISSION_LABEL[car.transmission as "MANUAL"]}</Spec>
          <Spec icon={Fuel}>{FUEL_LABEL[car.fuelType as "PETROL"]}</Spec>
          <Spec icon={Users}>{car.seats} seats</Spec>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-muted">
          <MapPin className="h-3.5 w-3.5" /> {car.location}, {car.city}
        </p>

        <div className="flex-1" />
        <div className="mt-5 flex items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <p className="font-display text-[22px] font-semibold leading-none tracking-[-0.03em] text-ink">
              {formatINR(car.dailyRate)}
              <span className="text-[13px] font-medium tracking-normal text-muted">/day</span>
            </p>
            <p className="mt-1 text-[12px] text-muted">{formatINR(car.hourlyRate)}/hr</p>
          </div>
          <div className="relative z-10 flex gap-1.5">
            <Link href={href} className={buttonClass("secondary", "sm", "hidden sm:inline-flex")}>
              Details
            </Link>
            <Link href={car.available ? `/book/${car.slug}${query}` : href} className={buttonClass("primary", "sm", "group/btn")}>
              Book now <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/btn:-translate-y-0.5 group-hover/btn:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function Spec({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-paper px-2 py-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted" />
      {children}
    </span>
  );
}

export function CarCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="aspect-[16/10] animate-pulse bg-ink/[.06]" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-16 animate-pulse rounded bg-ink/[.06]" />
        <div className="h-5 w-40 animate-pulse rounded bg-ink/[.06]" />
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 animate-pulse rounded-lg bg-ink/[.06]" />
          ))}
        </div>
        <div className="h-10 animate-pulse rounded-xl bg-ink/[.06]" />
      </div>
    </div>
  );
}
