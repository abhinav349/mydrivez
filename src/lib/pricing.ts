/**
 * Pricing engine — pure, deterministic, and shared by the quote API, the booking service
 * and the client-side estimator. The server always recomputes; client numbers are display-only.
 *
 * Tiering: whole days are billed at the daily rate, or the weekly/monthly effective day rate
 * once the trip reaches 7/30 days. Leftover hours are billed hourly, capped at one day.
 * Surge rules (weekend / seasonal / holiday) apply per hour that falls inside them, using the
 * highest matching adjustment for that hour (rules never stack).
 */

export type RateCard = {
  hourlyRate: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  securityDeposit: number;
  includedKmPerDay: number;
  extraKmCharge: number;
  category: string;
  id?: string;
};

export type SurgeRule = {
  id: string;
  name: string;
  type: "WEEKEND" | "SEASONAL" | "HOLIDAY";
  adjustmentPct: number;
  daysOfWeek: number[];
  startDate: Date | null;
  endDate: Date | null;
  category: string | null;
  vehicleId: string | null;
  isActive: boolean;
};

export type CouponInput = {
  code: string;
  discountType: "PERCENT" | "FIXED";
  value: number;
  maxDiscount: number | null;
  minBookingAmount: number;
};

export type PricingSettings = {
  taxRatePct: number;
  doorstepFee: number;
  lateFeeMultiplier: number;
  minHours: number;
};

export type LineItem = { label: string; amount: number; kind: "charge" | "discount" | "tax" | "deposit" | "info" };

export type Quote = {
  durationHours: number;
  billedDays: number;
  billedHours: number;
  rateTier: "hourly" | "daily" | "weekly" | "monthly";
  baseAmount: number;
  surgeAmount: number;
  surgeLabel: string | null;
  deliveryFee: number;
  discountAmount: number;
  couponCode: string | null;
  couponError: string | null;
  taxRate: number;
  taxAmount: number;
  rentalTotal: number;
  securityDeposit: number;
  totalPayable: number;
  includedKm: number;
  extraKmRate: number;
  lateFeePerHour: number;
  lineItems: LineItem[];
};

export class PricingError extends Error {}

const HOUR = 3_600_000;
const IST_OFFSET = 5.5 * HOUR;

export function rentalHours(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / HOUR);
}

/** Weekday (0=Sun) and YYYY-MM-DD of an instant, in India Standard Time. */
function istParts(t: number) {
  const d = new Date(t + IST_OFFSET);
  return { dow: d.getUTCDay(), ymd: d.toISOString().slice(0, 10) };
}

function ruleMatches(rule: SurgeRule, rate: RateCard, t: number) {
  if (!rule.isActive) return false;
  if (rule.vehicleId && rule.vehicleId !== rate.id) return false;
  if (rule.category && rule.category !== rate.category) return false;
  const { dow, ymd } = istParts(t);
  if (rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dow)) return false;
  if (rule.startDate && ymd < istParts(rule.startDate.getTime()).ymd) return false;
  if (rule.endDate && ymd > istParts(rule.endDate.getTime()).ymd) return false;
  return true;
}

export function computeBase(rate: RateCard, hours: number) {
  const days = Math.floor(hours / 24);
  const rem = hours % 24;
  const remainderCost = Math.min(rem * rate.hourlyRate, rate.dailyRate);

  if (days === 0) {
    return { base: remainderCost, tier: (remainderCost === rate.dailyRate ? "daily" : "hourly") as Quote["rateTier"], days, rem };
  }
  let perDay = rate.dailyRate;
  let tier: Quote["rateTier"] = "daily";
  if (days >= 30) {
    perDay = rate.monthlyRate / 30;
    tier = "monthly";
  } else if (days >= 7) {
    perDay = rate.weeklyRate / 7;
    tier = "weekly";
  }
  return { base: Math.round(days * perDay + remainderCost), tier, days, rem };
}

export function computeQuote(args: {
  rate: RateCard;
  start: Date;
  end: Date;
  rules: SurgeRule[];
  settings: PricingSettings;
  doorstep: boolean;
  coupon?: CouponInput | null;
  couponError?: string | null;
}): Quote {
  const { rate, start, end, rules, settings } = args;
  if (!(end.getTime() > start.getTime())) throw new PricingError("Return time must be after pickup time.");
  const hours = Math.max(rentalHours(start, end), settings.minHours);

  const { base, tier, days, rem } = computeBase(rate, hours);

  // Per-hour surge allocation
  let surge = 0;
  const applied = new Map<string, number>();
  const perHour = base / hours;
  for (let i = 0; i < hours; i++) {
    const t = start.getTime() + i * HOUR + 1;
    let best: SurgeRule | null = null;
    for (const r of rules) {
      if (ruleMatches(r, rate, t) && (!best || r.adjustmentPct > best.adjustmentPct)) best = r;
    }
    if (best) {
      const amt = (perHour * best.adjustmentPct) / 100;
      surge += amt;
      applied.set(best.name, (applied.get(best.name) ?? 0) + amt);
    }
  }
  surge = Math.round(surge);

  const deliveryFee = args.doorstep ? settings.doorstepFee : 0;
  const subtotal = base + surge;

  let discount = 0;
  let couponError = args.couponError ?? null;
  let couponCode: string | null = null;
  if (args.coupon) {
    const c = args.coupon;
    if (subtotal < c.minBookingAmount) {
      couponError = `Minimum booking value for ${c.code} is ₹${c.minBookingAmount.toLocaleString("en-IN")}.`;
    } else {
      discount = c.discountType === "PERCENT" ? Math.round((subtotal * c.value) / 100) : c.value;
      if (c.maxDiscount != null) discount = Math.min(discount, c.maxDiscount);
      discount = Math.min(discount, subtotal);
      couponCode = c.code;
    }
  }

  const taxable = subtotal + deliveryFee - discount;
  const taxAmount = Math.round((taxable * settings.taxRatePct) / 100);
  const rentalTotal = taxable + taxAmount;
  const totalPayable = rentalTotal + rate.securityDeposit;
  const chargeableDays = Math.max(1, Math.ceil(hours / 24));

  const tierLabel =
    tier === "monthly" ? "Monthly rate" : tier === "weekly" ? "Weekly rate" : tier === "daily" ? "Daily rate" : "Hourly rate";
  const lineItems: LineItem[] = [
    {
      label: `${tierLabel} · ${days > 0 ? `${days} day${days > 1 ? "s" : ""}` : ""}${days > 0 && rem > 0 ? " + " : ""}${rem > 0 ? `${rem} hr${rem > 1 ? "s" : ""}` : ""}`,
      amount: base,
      kind: "charge",
    },
  ];
  for (const [name, amt] of applied) {
    if (Math.round(amt) !== 0) lineItems.push({ label: name, amount: Math.round(amt), kind: amt >= 0 ? "charge" : "discount" });
  }
  if (deliveryFee) lineItems.push({ label: "Doorstep delivery & pickup", amount: deliveryFee, kind: "charge" });
  if (discount) lineItems.push({ label: `Coupon ${couponCode}`, amount: -discount, kind: "discount" });
  lineItems.push({ label: `GST (${settings.taxRatePct}%)`, amount: taxAmount, kind: "tax" });
  lineItems.push({ label: "Refundable security deposit", amount: rate.securityDeposit, kind: "deposit" });

  return {
    durationHours: hours,
    billedDays: days,
    billedHours: rem,
    rateTier: tier,
    baseAmount: base,
    surgeAmount: surge,
    surgeLabel: applied.size ? [...applied.keys()].join(", ") : null,
    deliveryFee,
    discountAmount: discount,
    couponCode,
    couponError,
    taxRate: settings.taxRatePct,
    taxAmount,
    rentalTotal,
    securityDeposit: rate.securityDeposit,
    totalPayable,
    includedKm: rate.includedKmPerDay * chargeableDays,
    extraKmRate: rate.extraKmCharge,
    lateFeePerHour: Math.round(rate.hourlyRate * settings.lateFeeMultiplier),
    lineItems,
  };
}

/** Post-trip charges assessed at vehicle return. */
export function computeReturnCharges(args: {
  scheduledEnd: Date;
  actualReturn: Date;
  graceMinutes: number;
  lateFeePerHour: number;
  odometerStart: number;
  odometerEnd: number;
  includedKm: number;
  extraKmRate: number;
  fuelStart: number;
  fuelEnd: number;
  fuelChargePerPct: number;
  damageCharges: number;
}) {
  const lateMinutes = Math.max(0, Math.round((args.actualReturn.getTime() - args.scheduledEnd.getTime()) / 60000));
  const billableLateHours = lateMinutes > args.graceMinutes ? Math.ceil(lateMinutes / 60) : 0;
  const lateReturnCharges = billableLateHours * args.lateFeePerHour;
  const driven = Math.max(0, args.odometerEnd - args.odometerStart);
  const extraKm = Math.max(0, driven - args.includedKm);
  const extraKmCharges = extraKm * args.extraKmRate;
  const fuelDeficit = Math.max(0, args.fuelStart - args.fuelEnd);
  const fuelCharges = fuelDeficit * args.fuelChargePerPct;
  const total = lateReturnCharges + extraKmCharges + fuelCharges + Math.max(0, args.damageCharges);
  return { lateMinutes, lateReturnCharges, driven, extraKm, extraKmCharges, fuelCharges, damageCharges: args.damageCharges, total };
}

/** Cancellation refund policy, based on time remaining before pickup. */
export function cancellationRefund(args: { rentalTotal: number; deposit: number; startAt: Date; now?: Date }) {
  const now = args.now ?? new Date();
  const hoursLeft = (args.startAt.getTime() - now.getTime()) / HOUR;
  let pct = 0;
  let rule = "No refund on rental once the trip has started";
  if (hoursLeft >= 24) {
    pct = 100;
    rule = "Full refund — cancelled 24+ hours before pickup";
  } else if (hoursLeft >= 6) {
    pct = 50;
    rule = "50% refund — cancelled 6–24 hours before pickup";
  } else if (hoursLeft > 0) {
    pct = 0;
    rule = "No rental refund — cancelled within 6 hours of pickup";
  }
  const rentalRefund = Math.round((args.rentalTotal * pct) / 100);
  return { pct, rule, rentalRefund, depositRefund: args.deposit, total: rentalRefund + args.deposit };
}
