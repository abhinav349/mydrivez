import "server-only";
import { db } from "./db";
import type { PricingSettings } from "./pricing";

export type AppSettings = PricingSettings & {
  turnaroundMinutes: number;
  holdMinutes: number;
  manualApproval: boolean;
  requireVerifiedDocs: boolean;
  lateGraceMinutes: number;
  fuelChargePerPct: number;
  maxRentalDays: number;
  minLeadMinutes: number;
  loyaltyPointsPer100: number;
  referralBonusPoints: number;
};

export const DEFAULT_SETTINGS: AppSettings = {
  taxRatePct: 18,
  doorstepFee: 499,
  lateFeeMultiplier: 1.5,
  minHours: 4,
  turnaroundMinutes: 60,
  holdMinutes: 15,
  manualApproval: false,
  requireVerifiedDocs: false,
  lateGraceMinutes: 30,
  fuelChargePerPct: 60,
  maxRentalDays: 90,
  minLeadMinutes: 60,
  loyaltyPointsPer100: 1,
  referralBonusPoints: 250,
};

export async function getSettings(): Promise<AppSettings> {
  const row = await db.setting.findUnique({ where: { key: "app" } });
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<AppSettings>) ?? {}) };
}

export async function saveSettings(patch: Partial<AppSettings>) {
  const current = await getSettings();
  const value = { ...current, ...patch };
  await db.setting.upsert({ where: { key: "app" }, create: { key: "app", value }, update: { value } });
  return value;
}
