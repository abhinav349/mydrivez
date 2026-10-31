import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type RangeKey = "7d" | "30d" | "90d" | "12m";
export const RANGES: Record<RangeKey, { label: string; days: number }> = {
  "7d": { label: "7 days", days: 7 },
  "30d": { label: "30 days", days: 30 },
  "90d": { label: "90 days", days: 90 },
  "12m": { label: "12 months", days: 365 },
};

export function parseRange(v?: string): RangeKey {
  return v && v in RANGES ? (v as RangeKey) : "30d";
}

const PAID = ["PAYMENT_COMPLETED", "CONFIRMED", "ACTIVE", "COMPLETED"] as const;
const IST = 5.5 * 3600_000;
const dayKey = (d: Date) => new Date(d.getTime() + IST).toISOString().slice(0, 10);

function bucketKey(d: Date, g: "day" | "week" | "month") {
  const ist = new Date(d.getTime() + IST);
  if (g === "month") return ist.toISOString().slice(0, 7);
  if (g === "week") {
    const dow = (ist.getUTCDay() + 6) % 7; // Monday start
    ist.setUTCDate(ist.getUTCDate() - dow);
  }
  return ist.toISOString().slice(0, 10);
}

function buckets(from: Date, to: Date, g: "day" | "week" | "month") {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (let t = from.getTime(); t <= to.getTime(); t += 86_400_000) {
    const k = bucketKey(new Date(t), g);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  return keys;
}

export function labelFor(key: string, g: "day" | "week" | "month") {
  const d = new Date(g === "month" ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`);
  return g === "month"
    ? d.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Revenue recognised from a booking: rental total + post-trip charges for live/completed bookings,
 *  or the retained (non-refunded, non-deposit) amount for cancellations. */
function revenueOf(b: {
  status: string;
  pricing: { rentalTotal: number; securityDeposit: number; extraKmCharges: number; lateReturnCharges: number; damageCharges: number; fuelCharges: number } | null;
  payments: { amount: number; status: string }[];
  refunds: { amount: number; status: string; type: string }[];
}) {
  if (!b.pricing) return 0;
  const paid = b.payments.filter((p) => p.status !== "FAILED" && p.status !== "CREATED").reduce((s, p) => s + p.amount, 0);
  if (!paid) return 0;
  if ((PAID as readonly string[]).includes(b.status)) {
    const p = b.pricing;
    return p.rentalTotal + p.extraKmCharges + p.lateReturnCharges + p.damageCharges + p.fuelCharges;
  }
  const refunded = b.refunds.filter((r) => r.status !== "FAILED").reduce((s, r) => s + r.amount, 0);
  return Math.max(0, paid - refunded - b.pricing.securityDeposit);
}

export async function getAnalytics(range: RangeKey, includeDemo: boolean) {
  const to = new Date();
  const from = new Date(to.getTime() - RANGES[range].days * 86_400_000);
  const prevFrom = new Date(from.getTime() - RANGES[range].days * 86_400_000);
  const demo: Prisma.BookingWhereInput = includeDemo ? {} : { isDemo: false };
  const g: "day" | "week" | "month" = range === "12m" ? "month" : range === "90d" ? "week" : "day";

  const rows = await db.booking.findMany({
    where: { ...demo, createdAt: { gte: prevFrom } },
    select: {
      id: true,
      status: true,
      createdAt: true,
      startAt: true,
      endAt: true,
      vehicleId: true,
      userId: true,
      pricing: { select: { rentalTotal: true, securityDeposit: true, extraKmCharges: true, lateReturnCharges: true, damageCharges: true, fuelCharges: true } },
      payments: { select: { amount: true, status: true } },
      refunds: { select: { amount: true, status: true, type: true } },
      vehicle: { select: { brand: true, model: true, category: true } },
    },
  });
  const cur = rows.filter((r) => r.createdAt >= from);
  const prev = rows.filter((r) => r.createdAt < from);

  const revenue = cur.reduce((s, b) => s + revenueOf(b), 0);
  const prevRevenue = prev.reduce((s, b) => s + revenueOf(b), 0);
  const cancelled = cur.filter((b) => b.status === "CANCELLED" || b.status === "REFUNDED").length;
  const decided = cur.filter((b) => b.status !== "AWAITING_PAYMENT").length;

  // Time series
  const keys = buckets(from, to, g);
  const series = new Map(keys.map((k) => [k, { revenue: 0, completed: 0, cancelled: 0, other: 0 }]));
  for (const b of cur) {
    const s = series.get(bucketKey(b.createdAt, g));
    if (!s) continue;
    s.revenue += revenueOf(b);
    if (b.status === "CANCELLED" || b.status === "REFUNDED") s.cancelled++;
    else if (b.status !== "AWAITING_PAYMENT") s.completed++;
  }
  const timeline = keys.map((k) => ({ key: k, label: labelFor(k, g), ...series.get(k)! }));

  // Per-vehicle
  const byVehicle = new Map<string, { name: string; trips: number; revenue: number; hours: number }>();
  for (const b of cur) {
    const v = byVehicle.get(b.vehicleId) ?? { name: `${b.vehicle.brand} ${b.vehicle.model}`, trips: 0, revenue: 0, hours: 0 };
    if ((PAID as readonly string[]).includes(b.status)) {
      v.trips++;
      // hours of the rental that fall inside the window
      const s = Math.max(b.startAt.getTime(), from.getTime());
      const e = Math.min(b.endAt.getTime(), to.getTime());
      if (e > s) v.hours += (e - s) / 3_600_000;
    }
    v.revenue += revenueOf(b);
    byVehicle.set(b.vehicleId, v);
  }
  const vehicles = await db.vehicle.findMany({ where: { status: { not: "INACTIVE" } }, select: { id: true, brand: true, model: true, category: true } });
  const windowHours = RANGES[range].days * 24;
  const utilization = vehicles
    .map((v) => ({ name: `${v.brand} ${v.model}`, pct: Math.round(((byVehicle.get(v.id)?.hours ?? 0) / windowHours) * 100) }))
    .sort((a, b) => b.pct - a.pct);
  const fleetUtil = utilization.length ? Math.round(utilization.reduce((s, u) => s + u.pct, 0) / utilization.length) : 0;

  const vehicleRows = [...byVehicle.values()];
  const mostRented = [...vehicleRows].sort((a, b) => b.trips - a.trips).slice(0, 6);
  const mostProfitable = [...vehicleRows].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const byCategory = new Map<string, number>();
  for (const b of cur) byCategory.set(b.vehicle.category, (byCategory.get(b.vehicle.category) ?? 0) + revenueOf(b));

  // Customer growth (cumulative)
  const customers = await db.user.findMany({ where: { role: "CUSTOMER", ...(includeDemo ? {} : { isDemo: false }) }, select: { createdAt: true } });
  const before = customers.filter((c) => c.createdAt < from).length;
  const growthMap = new Map(keys.map((k) => [k, 0]));
  for (const c of customers) {
    if (c.createdAt < from) continue;
    const k = bucketKey(c.createdAt, g);
    if (growthMap.has(k)) growthMap.set(k, growthMap.get(k)! + 1);
  }
  let acc = before;
  const growth = keys.map((k) => {
    acc += growthMap.get(k)!;
    return { label: labelFor(k, g), customers: acc, new: growthMap.get(k)! };
  });

  return {
    from,
    to,
    granularity: g,
    revenue,
    revenueDelta: prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null,
    bookings: cur.length,
    bookingsDelta: prev.length ? Math.round(((cur.length - prev.length) / prev.length) * 100) : null,
    cancelled,
    cancellationRate: decided ? Math.round((cancelled / decided) * 1000) / 10 : 0,
    avgBookingValue: cur.filter((b) => revenueOf(b) > 0).length ? Math.round(revenue / cur.filter((b) => revenueOf(b) > 0).length) : 0,
    timeline,
    mostRented,
    mostProfitable,
    utilization,
    fleetUtil,
    byCategory: [...byCategory.entries()].map(([category, revenue]) => ({ category, revenue })).sort((a, b) => b.revenue - a.revenue),
    growth,
    newCustomers: customers.length - before,
  };
}

export async function getOverviewCounts(includeDemo: boolean) {
  const demo = includeDemo ? {} : { isDemo: false };
  const now = new Date();
  const [active, available, customers, pending, verifications, cancelled, awaitingReview] = await Promise.all([
    db.booking.count({ where: { ...demo, status: "ACTIVE" } }),
    db.vehicle.count({ where: { status: "AVAILABLE" } }),
    db.user.count({ where: { role: "CUSTOMER", ...demo } }),
    db.booking.count({ where: { ...demo, status: { in: ["PENDING", "PAYMENT_COMPLETED", "AWAITING_PAYMENT"] }, OR: [{ holdExpiresAt: null }, { holdExpiresAt: { gt: now } }] } }),
    db.customerDocument.count({ where: { status: "PENDING" } }),
    db.booking.count({ where: { ...demo, status: { in: ["CANCELLED", "REFUNDED"] } } }),
    db.booking.count({ where: { ...demo, status: "PAYMENT_COMPLETED" } }),
  ]);
  return { active, available, customers, pending, verifications, cancelled, awaitingReview };
}

export { dayKey };
