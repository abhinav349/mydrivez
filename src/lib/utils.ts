import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-IN");

export function formatINR(amount: number) {
  return inr.format(Math.round(amount));
}

export function formatNumber(n: number) {
  return num.format(n);
}

export function formatCompactINR(amount: number) {
  if (amount >= 1_00_00_000) return `₹${(amount / 1_00_00_000).toFixed(2)} Cr`;
  if (amount >= 1_00_000) return `₹${(amount / 1_00_000).toFixed(2)} L`;
  if (amount >= 1_000) return `₹${(amount / 1_000).toFixed(1)}K`;
  return formatINR(amount);
}

const IST = "Asia/Kolkata";

export function formatDate(d: Date | string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: IST, ...opts });
}

export function formatDateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: IST,
  });
}

export function formatTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });
}

export function formatDuration(hours: number) {
  const d = Math.floor(hours / 24);
  const h = hours % 24;
  if (d === 0) return `${h} hr${h === 1 ? "" : "s"}`;
  if (h === 0) return `${d} day${d === 1 ? "" : "s"}`;
  return `${d}d ${h}h`;
}

/** Only allow same-origin relative redirect targets. */
export function safeNext(next: unknown, fallback: string) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-");
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function titleCase(s: string) {
  return s
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Format a Date for <input type="datetime-local"> in IST. */
export function toLocalInput(d: Date) {
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  return ist.toISOString().slice(0, 16);
}

/** Parse a datetime-local value (interpreted as IST) into a UTC Date. */
export function fromLocalInput(v: string) {
  return new Date(`${v}:00+05:30`);
}

export function relativeTime(d: Date | string) {
  const seconds = (new Date(d).getTime() - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["week", 604800],
    ["month", 2629800],
    ["year", 31557600],
  ];
  let chosen = steps[0]!;
  for (const step of steps) if (abs >= step[1]) chosen = step;
  return rtf.format(Math.round(seconds / chosen[1]), chosen[0]);
}
