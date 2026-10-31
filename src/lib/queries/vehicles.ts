import "server-only";
import type { Prisma, VehicleCategory } from "@prisma/client";
import { db } from "@/lib/db";
import { BLOCKING_STATUSES } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export type VehicleCardData = {
  id: string;
  slug: string;
  brand: string;
  model: string;
  variant: string | null;
  category: VehicleCategory;
  fuelType: string;
  transmission: string;
  seats: number;
  hourlyRate: number;
  dailyRate: number;
  ratingAvg: number;
  ratingCount: number;
  tripCount: number;
  image: string | null;
  location: string;
  city: string;
  isFeatured: boolean;
  available: boolean;
};

const cardSelect = {
  id: true,
  slug: true,
  brand: true,
  model: true,
  variant: true,
  category: true,
  fuelType: true,
  transmission: true,
  seats: true,
  hourlyRate: true,
  dailyRate: true,
  ratingAvg: true,
  ratingCount: true,
  tripCount: true,
  isFeatured: true,
  status: true,
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
  location: { select: { name: true, city: { select: { name: true } } } },
} satisfies Prisma.VehicleSelect;

type CardRow = Prisma.VehicleGetPayload<{ select: typeof cardSelect }>;

function toCard(v: CardRow, available = true): VehicleCardData {
  return {
    id: v.id,
    slug: v.slug,
    brand: v.brand,
    model: v.model,
    variant: v.variant,
    category: v.category,
    fuelType: v.fuelType,
    transmission: v.transmission,
    seats: v.seats,
    hourlyRate: v.hourlyRate,
    dailyRate: v.dailyRate,
    ratingAvg: v.ratingAvg,
    ratingCount: v.ratingCount,
    tripCount: v.tripCount,
    image: v.images[0]?.url ?? null,
    location: v.location.name,
    city: v.location.city.name,
    isFeatured: v.isFeatured,
    available: available && v.status !== "MAINTENANCE",
  };
}

const PUBLIC_STATUSES = ["AVAILABLE", "BOOKED", "RENTED"] as const;

export async function getFeaturedVehicles(limit = 8) {
  const rows = await db.vehicle.findMany({
    where: { status: { in: [...PUBLIC_STATUSES] } },
    orderBy: [{ isFeatured: "desc" }, { ratingAvg: "desc" }],
    take: limit,
    select: cardSelect,
  });
  return rows.map((r) => toCard(r));
}

export type SearchFilters = {
  city?: string;
  start?: Date;
  end?: Date;
  categories?: string[];
  brands?: string[];
  fuels?: string[];
  transmission?: string;
  seats?: number;
  priceMin?: number;
  priceMax?: number;
  rating?: number;
  availableOnly?: boolean;
  q?: string;
  sort?: "recommended" | "price_asc" | "price_desc" | "popular" | "rating";
};

export async function searchVehicles(f: SearchFilters) {
  const where: Prisma.VehicleWhereInput = {
    status: { in: [...PUBLIC_STATUSES] },
    ...(f.city ? { location: { city: { slug: f.city } } } : {}),
    ...(f.categories?.length ? { category: { in: f.categories as VehicleCategory[] } } : {}),
    ...(f.brands?.length ? { brand: { in: f.brands } } : {}),
    ...(f.fuels?.length ? { fuelType: { in: f.fuels as Prisma.EnumFuelTypeFilter["in"] } } : {}),
    ...(f.transmission ? { transmission: f.transmission as "MANUAL" | "AUTOMATIC" } : {}),
    ...(f.seats ? { seats: { gte: f.seats } } : {}),
    ...(f.rating ? { ratingAvg: { gte: f.rating } } : {}),
    ...(f.priceMin || f.priceMax ? { dailyRate: { ...(f.priceMin ? { gte: f.priceMin } : {}), ...(f.priceMax ? { lte: f.priceMax } : {}) } } : {}),
    ...(f.q
      ? {
          OR: [
            { brand: { contains: f.q, mode: "insensitive" } },
            { model: { contains: f.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.VehicleOrderByWithRelationInput[] =
    f.sort === "price_asc"
      ? [{ dailyRate: "asc" }]
      : f.sort === "price_desc"
        ? [{ dailyRate: "desc" }]
        : f.sort === "popular"
          ? [{ tripCount: "desc" }]
          : f.sort === "rating"
            ? [{ ratingAvg: "desc" }, { ratingCount: "desc" }]
            : [{ isFeatured: "desc" }, { ratingAvg: "desc" }, { tripCount: "desc" }];

  const rows = await db.vehicle.findMany({ where, orderBy, select: cardSelect });

  let busy = new Set<string>();
  if (f.start && f.end && f.end > f.start) {
    const settings = await getSettings();
    const blockedUntil = new Date(f.end.getTime() + settings.turnaroundMinutes * 60_000);
    const conflicts = await db.booking.findMany({
      where: {
        vehicleId: { in: rows.map((r) => r.id) },
        status: { in: BLOCKING_STATUSES },
        startAt: { lt: blockedUntil },
        blockedUntil: { gt: f.start },
        NOT: { status: "AWAITING_PAYMENT", holdExpiresAt: { lt: new Date() } },
      },
      select: { vehicleId: true },
    });
    busy = new Set(conflicts.map((c) => c.vehicleId));
  }
  let cards = rows.map((r) => toCard(r, !busy.has(r.id)));
  if (f.availableOnly) cards = cards.filter((c) => c.available);
  // Available cars first while preserving the chosen sort.
  cards.sort((a, b) => Number(b.available) - Number(a.available));
  return cards;
}

export async function getFilterFacets() {
  const [brands, cities, priceAgg] = await Promise.all([
    db.vehicle.findMany({ where: { status: { not: "INACTIVE" } }, distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } }),
    db.city.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { name: true, slug: true } }),
    db.vehicle.aggregate({ where: { status: { not: "INACTIVE" } }, _min: { dailyRate: true }, _max: { dailyRate: true } }),
  ]);
  return {
    brands: brands.map((b) => b.brand),
    cities,
    minPrice: priceAgg._min.dailyRate ?? 0,
    maxPrice: priceAgg._max.dailyRate ?? 20000,
  };
}

export async function getVehicleBySlug(slug: string) {
  return db.vehicle.findFirst({
    where: { slug, status: { not: "INACTIVE" } },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      features: { orderBy: { name: "asc" } },
      location: { include: { city: true } },
      reviews: {
        where: { status: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 12,
        include: { user: { select: { name: true, avatarUrl: true } } },
      },
    },
  });
}

/** Booked ranges for the next N days (for the public availability calendar — no customer data). */
export async function getBookedRanges(vehicleId: string, days = 75) {
  const now = new Date();
  const until = new Date(now.getTime() + days * 86_400_000);
  const rows = await db.booking.findMany({
    where: {
      vehicleId,
      status: { in: BLOCKING_STATUSES },
      blockedUntil: { gt: now },
      startAt: { lt: until },
      NOT: { status: "AWAITING_PAYMENT", holdExpiresAt: { lt: now } },
    },
    select: { startAt: true, blockedUntil: true },
    orderBy: { startAt: "asc" },
  });
  return rows.map((r) => ({ start: r.startAt.toISOString(), end: r.blockedUntil.toISOString() }));
}

export async function getSimilarVehicles(vehicleId: string, category: VehicleCategory, limit = 4) {
  const rows = await db.vehicle.findMany({
    where: { id: { not: vehicleId }, category, status: { in: [...PUBLIC_STATUSES] } },
    take: limit,
    orderBy: { ratingAvg: "desc" },
    select: cardSelect,
  });
  if (rows.length < limit) {
    const more = await db.vehicle.findMany({
      where: { id: { notIn: [vehicleId, ...rows.map((r) => r.id)] }, status: { in: [...PUBLIC_STATUSES] } },
      take: limit - rows.length,
      orderBy: { ratingAvg: "desc" },
      select: cardSelect,
    });
    rows.push(...more);
  }
  return rows.map((r) => toCard(r));
}

export async function getCardsByIds(ids: string[]) {
  if (!ids.length) return [];
  const rows = await db.vehicle.findMany({ where: { id: { in: ids }, status: { not: "INACTIVE" } }, select: cardSelect });
  const byId = new Map(rows.map((r) => [r.id, toCard(r)]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as VehicleCardData[];
}

export async function getLocations() {
  return db.vehicleLocation.findMany({
    where: { isActive: true, city: { isActive: true } },
    include: { city: { select: { name: true, slug: true } } },
    orderBy: [{ city: { name: "asc" } }, { name: "asc" }],
  });
}

export async function getCategoryCounts() {
  const rows = await db.vehicle.groupBy({ by: ["category"], where: { status: { in: [...PUBLIC_STATUSES] } }, _count: true, _min: { dailyRate: true } });
  return Object.fromEntries(rows.map((r) => [r.category, { count: r._count, from: r._min.dailyRate ?? 0 }])) as Partial<
    Record<VehicleCategory, { count: number; from: number }>
  >;
}
