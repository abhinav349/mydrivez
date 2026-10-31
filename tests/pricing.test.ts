import { test } from "node:test";
import assert from "node:assert/strict";
import { cancellationRefund, computeBase, computeQuote, computeReturnCharges, type RateCard, type SurgeRule } from "../src/lib/pricing";

const rate: RateCard = {
  id: "car1",
  category: "SUV",
  hourlyRate: 200,
  dailyRate: 2400,
  weeklyRate: 14000,
  monthlyRate: 48000,
  securityDeposit: 5000,
  includedKmPerDay: 250,
  extraKmCharge: 12,
};
const settings = { taxRatePct: 18, doorstepFee: 499, lateFeeMultiplier: 1.5, minHours: 4 };
const H = 3_600_000;
// Tuesday 10:00 IST
const tue = new Date("2026-11-10T10:00:00+05:30");

test("hourly pricing caps at the daily rate", () => {
  assert.equal(computeBase(rate, 5).base, 1000);
  assert.equal(computeBase(rate, 20).base, 2400);
});

test("daily + remainder hours", () => {
  const b = computeBase(rate, 2 * 24 + 3);
  assert.equal(b.tier, "daily");
  assert.equal(b.base, 2 * 2400 + 3 * 200);
});

test("weekly and monthly tiers kick in", () => {
  assert.equal(computeBase(rate, 7 * 24).tier, "weekly");
  assert.equal(computeBase(rate, 7 * 24).base, 14000);
  assert.equal(computeBase(rate, 30 * 24).tier, "monthly");
  assert.equal(computeBase(rate, 30 * 24).base, 48000);
});

test("minimum hours are enforced", () => {
  const q = computeQuote({ rate, start: tue, end: new Date(tue.getTime() + 2 * H), rules: [], settings, doorstep: false });
  assert.equal(q.durationHours, 4);
  assert.equal(q.baseAmount, 800);
});

test("GST, deposit and totals add up", () => {
  const q = computeQuote({ rate, start: tue, end: new Date(tue.getTime() + 24 * H), rules: [], settings, doorstep: true });
  assert.equal(q.baseAmount, 2400);
  assert.equal(q.deliveryFee, 499);
  assert.equal(q.taxAmount, Math.round((2400 + 499) * 0.18));
  assert.equal(q.rentalTotal, 2400 + 499 + q.taxAmount);
  assert.equal(q.totalPayable, q.rentalTotal + 5000);
  assert.equal(q.includedKm, 250);
});

const weekend: SurgeRule = { id: "w", name: "Weekend", type: "WEEKEND", adjustmentPct: 20, daysOfWeek: [0, 6], startDate: null, endDate: null, category: null, vehicleId: null, isActive: true };

test("weekend surge applies only to weekend hours (IST)", () => {
  // Fri 10:00 → Sun 10:00 IST = 48h, of which Sat 00:00–Sun 10:00 = 34h are weekend
  const start = new Date("2026-11-13T10:00:00+05:30");
  const q = computeQuote({ rate, start, end: new Date(start.getTime() + 48 * H), rules: [weekend], settings, doorstep: false });
  assert.equal(q.baseAmount, 4800);
  assert.equal(q.surgeAmount, Math.round((4800 / 48) * 34 * 0.2));
});

test("highest matching rule wins, inactive and other-category rules ignored", () => {
  const holiday: SurgeRule = { ...weekend, id: "h", name: "Holiday", type: "HOLIDAY", adjustmentPct: 50, daysOfWeek: [], startDate: new Date("2026-11-14T00:00:00+05:30"), endDate: new Date("2026-11-14T00:00:00+05:30") };
  const evOnly: SurgeRule = { ...weekend, id: "e", name: "EV", adjustmentPct: 90, category: "ELECTRIC" };
  const off: SurgeRule = { ...weekend, id: "o", name: "Off", adjustmentPct: 99, isActive: false };
  const sat = new Date("2026-11-14T00:00:00+05:30");
  const q = computeQuote({ rate, start: sat, end: new Date(sat.getTime() + 24 * H), rules: [weekend, holiday, evOnly, off], settings, doorstep: false });
  assert.equal(q.surgeAmount, 1200); // 50% of 2400
});

test("percent coupon respects max discount; min amount enforced", () => {
  const coupon = { code: "SAVE20", discountType: "PERCENT" as const, value: 20, maxDiscount: 300, minBookingAmount: 0 };
  const q = computeQuote({ rate, start: tue, end: new Date(tue.getTime() + 24 * H), rules: [], settings, doorstep: false, coupon });
  assert.equal(q.discountAmount, 300);
  const q2 = computeQuote({ rate, start: tue, end: new Date(tue.getTime() + 24 * H), rules: [], settings, doorstep: false, coupon: { ...coupon, minBookingAmount: 10000 } });
  assert.equal(q2.discountAmount, 0);
  assert.match(q2.couponError ?? "", /Minimum booking/);
});

test("fixed coupon never exceeds subtotal", () => {
  const q = computeQuote({ rate, start: tue, end: new Date(tue.getTime() + 4 * H), rules: [], settings, doorstep: false, coupon: { code: "BIG", discountType: "FIXED", value: 99999, maxDiscount: null, minBookingAmount: 0 } });
  assert.equal(q.discountAmount, 800);
  assert.equal(q.taxAmount, 0);
});

test("rejects end before start", () => {
  assert.throws(() => computeQuote({ rate, start: tue, end: tue, rules: [], settings, doorstep: false }));
});

test("return charges: grace, late hours, extra km, fuel, damage", () => {
  const end = new Date("2026-11-12T10:00:00+05:30");
  const base = { scheduledEnd: end, graceMinutes: 30, lateFeePerHour: 300, odometerStart: 1000, includedKm: 500, extraKmRate: 12, fuelStart: 100, fuelChargePerPct: 60, damageCharges: 0 };
  const onTime = computeReturnCharges({ ...base, actualReturn: new Date(end.getTime() + 20 * 60_000), odometerEnd: 1400, fuelEnd: 100 });
  assert.equal(onTime.total, 0);
  const late = computeReturnCharges({ ...base, actualReturn: new Date(end.getTime() + 95 * 60_000), odometerEnd: 1600, fuelEnd: 90, damageCharges: 1500 });
  assert.equal(late.lateReturnCharges, 600); // 2 started hours
  assert.equal(late.extraKm, 100);
  assert.equal(late.extraKmCharges, 1200);
  assert.equal(late.fuelCharges, 600);
  assert.equal(late.total, 600 + 1200 + 600 + 1500);
});

test("cancellation policy tiers", () => {
  const now = new Date("2026-11-10T10:00:00+05:30");
  const at = (h: number) => new Date(now.getTime() + h * H);
  assert.equal(cancellationRefund({ rentalTotal: 1000, deposit: 500, startAt: at(30), now }).total, 1500);
  assert.equal(cancellationRefund({ rentalTotal: 1000, deposit: 500, startAt: at(10), now }).total, 1000);
  assert.equal(cancellationRefund({ rentalTotal: 1000, deposit: 500, startAt: at(2), now }).total, 500);
});
