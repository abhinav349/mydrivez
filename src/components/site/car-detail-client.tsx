"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowRight, CalendarClock, ChevronLeft, ChevronRight, Expand, Info, Loader2 } from "lucide-react";
import { buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { cn, formatINR, formatDuration, toLocalInput } from "@/lib/utils";
import { useQuote } from "./use-quote";

/* ───────────── Gallery ───────────── */

export function Gallery({ images, title }: { images: { url: string; alt: string | null }[]; title: string }) {
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(false);
  const n = images.length;
  const go = (d: number) => setI((x) => (x + d + n) % n);
  if (!n) return <div className="aspect-[16/10] rounded-3xl bg-paper" />;
  return (
    <div>
      <div className="group relative aspect-[16/10] overflow-hidden rounded-3xl bg-ink">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div key={i} initial={{ opacity: 0, scale: 1.03 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }} className="absolute inset-0">
            <Image src={images[i]!.url} alt={images[i]!.alt ?? title} fill priority={i === 0} sizes="(max-width:1024px) 100vw, 60vw" className="object-cover" />
          </motion.div>
        </AnimatePresence>
        {n > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-card transition-opacity group-hover:opacity-100 focus:opacity-100">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => go(1)} aria-label="Next photo" className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 opacity-0 shadow-card transition-opacity group-hover:opacity-100 focus:opacity-100">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
        <button onClick={() => setZoom(true)} className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-ink/70 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur">
          <Expand className="h-3.5 w-3.5" /> {i + 1} / {n}
        </button>
      </div>
      {n > 1 && (
        <div className="mt-3 flex gap-3 overflow-x-auto scrollbar-none">
          {images.map((im, k) => (
            <button
              key={im.url}
              onClick={() => setI(k)}
              className={cn("relative aspect-[16/10] w-28 shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 transition-all", k === i ? "ring-ink" : "ring-transparent opacity-60 hover:opacity-100")}
              aria-label={`Show photo ${k + 1}`}
            >
              <Image src={im.url} alt="" fill sizes="112px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
      <Dialog open={zoom} onClose={() => setZoom(false)} title={title} className="sm:max-w-5xl">
        <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-ink">
          <Image src={images[i]!.url} alt={images[i]!.alt ?? title} fill sizes="90vw" className="object-contain" />
        </div>
        {n > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            <button onClick={() => go(-1)} className={buttonClass("secondary", "sm")}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button onClick={() => go(1)} className={buttonClass("secondary", "sm")}>
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ───────────── Availability calendar ───────────── */

const IST = 5.5 * 3600_000;
const ymd = (t: number) => new Date(t + IST).toISOString().slice(0, 10);

export function AvailabilityCalendar({ ranges }: { ranges: { start: string; end: string }[] }) {
  const [offset, setOffset] = useState(0);
  const booked = useMemo(() => {
    const days = new Map<string, number>();
    for (const r of ranges) {
      const s = new Date(r.start).getTime();
      const e = new Date(r.end).getTime();
      for (let t = s; t < e; t += 3600_000) {
        const k = ymd(t);
        days.set(k, (days.get(k) ?? 0) + 1);
      }
    }
    return days;
  }, [ranges]);

  const todayIst = new Date(Date.now() + IST);
  const month = new Date(Date.UTC(todayIst.getUTCFullYear(), todayIst.getUTCMonth() + offset, 1));
  const firstDow = month.getUTCDay();
  const daysIn = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const todayKey = todayIst.toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-semibold text-ink">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })}</p>
        <div className="flex gap-1">
          <button disabled={offset === 0} onClick={() => setOffset((o) => o - 1)} className="rounded-lg p-1.5 hover:bg-paper disabled:opacity-30" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button disabled={offset >= 2} onClick={() => setOffset((o) => o + 1)} className="rounded-lg p-1.5 hover:bg-paper disabled:opacity-30" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-muted">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className="py-1">
            {d}
          </span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstDow }).map((_, i) => (
          <span key={`b${i}`} />
        ))}
        {Array.from({ length: daysIn }).map((_, d) => {
          const key = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), d + 1)).toISOString().slice(0, 10);
          const hours = booked.get(key) ?? 0;
          const past = key < todayKey;
          return (
            <span
              key={key}
              title={hours >= 20 ? "Booked" : hours > 0 ? "Partially booked" : "Available"}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg text-[13px] font-medium",
                past && "text-muted/40",
                !past && hours === 0 && "bg-success-soft text-success",
                !past && hours > 0 && hours < 20 && "bg-warning-soft text-warning",
                !past && hours >= 20 && "bg-ink/[.07] text-muted line-through",
                key === todayKey && "ring-2 ring-ink",
              )}
            >
              {d + 1}
            </span>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-muted">
        <Legend cls="bg-success-soft">Available</Legend>
        <Legend cls="bg-warning-soft">Partially booked</Legend>
        <Legend cls="bg-ink/[.07]">Booked</Legend>
      </div>
    </div>
  );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-3 rounded", cls)} />
      {children}
    </span>
  );
}

/* ───────────── Booking widget ───────────── */

function defaults() {
  const now = Date.now();
  const ist = new Date(now + 86_400_000 + IST);
  ist.setUTCHours(10, 0, 0, 0);
  const s = new Date(ist.getTime() - IST);
  return { start: toLocalInput(s), end: toLocalInput(new Date(s.getTime() + 2 * 86_400_000)) };
}

const BUFFER = 3_600_000; // mirrors the default turnaround; the server re-checks with the live setting

/** First start ≥ `from` where a trip of `dur` ms (plus buffer) clears every booked range. */
function nextFreeStart(from: number, dur: number, ranges: { start: string; end: string }[]) {
  const rs = ranges.map((r) => ({ s: new Date(r.start).getTime(), e: new Date(r.end).getTime() })).sort((a, b) => a.s - b.s);
  let c = from;
  for (let guard = 0; guard < 200; guard++) {
    const hit = rs.find((r) => c < r.e && c + dur + BUFFER > r.s);
    if (!hit) return c;
    c = Math.ceil(hit.e / BUFFER) * BUFFER; // next whole hour after the clash
  }
  return null;
}

const localMs = (v: string) => new Date(`${v}:00+05:30`).getTime();

export function BookingWidget({
  vehicleId,
  slug,
  dailyRate,
  hourlyRate,
  initialStart,
  initialEnd,
  bookable,
  ranges,
}: {
  vehicleId: string;
  slug: string;
  dailyRate: number;
  hourlyRate: number;
  initialStart?: string;
  initialEnd?: string;
  bookable: boolean;
  ranges: { start: string; end: string }[];
}) {
  // Without explicit dates, open on the first free slot so the car never greets visitors as "unavailable".
  const d = useMemo(() => {
    const def = defaults();
    const dur = localMs(def.end) - localMs(def.start);
    const free = nextFreeStart(localMs(def.start), dur, ranges);
    return free ? { start: toLocalInput(new Date(free)), end: toLocalInput(new Date(free + dur)) } : def;
  }, [ranges]);
  const [start, setStart] = useState(initialStart ?? d.start);
  const [end, setEnd] = useState(initialEnd ?? d.end);
  const q = useQuote({ vehicleId, start, end });
  const suggestion = useMemo(() => {
    if (q.available !== false) return null;
    const dur = localMs(end) - localMs(start);
    const free = dur > 0 ? nextFreeStart(localMs(start), dur, ranges) : null;
    return free ? { start: toLocalInput(new Date(free)), end: toLocalInput(new Date(free + dur)) } : null;
  }, [q.available, start, end, ranges]);
  const href = `/book/${slug}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const canBook = bookable && q.available !== false && !q.error && !!q.quote;

  const cta = (
    <Link
      href={canBook ? href : "#"}
      aria-disabled={!canBook}
      onClick={(e) => !canBook && e.preventDefault()}
      className={buttonClass("primary", "lg", cn("w-full", !canBook && "pointer-events-none opacity-50"))}
    >
      {q.available === false ? "Dates unavailable" : "Continue to book"} <ArrowRight className="h-4 w-4" />
    </Link>
  );

  return (
    <>
      <div className="card overflow-hidden">
        <div className="border-b border-line p-6">
          <p className="font-display text-[30px] font-semibold tracking-[-0.04em] text-ink">
            {formatINR(dailyRate)}
            <span className="text-[14px] font-medium tracking-normal text-muted"> /day</span>
          </p>
          <p className="text-[13px] text-muted">or {formatINR(hourlyRate)}/hour · GST extra</p>
        </div>
        <div className="space-y-3 p-6">
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-line">
            <label className="border-r border-line px-3.5 py-2.5">
              <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                <CalendarClock className="h-3 w-3" /> Pickup
              </span>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-0.5 w-full bg-transparent text-[13px] font-semibold text-ink outline-none" />
            </label>
            <label className="px-3.5 py-2.5">
              <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted">
                <CalendarClock className="h-3 w-3" /> Return
              </span>
              <input type="datetime-local" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="mt-0.5 w-full bg-transparent text-[13px] font-semibold text-ink outline-none" />
            </label>
          </div>

          <div className="min-h-[148px] rounded-xl bg-paper p-4">
            {q.loading && !q.quote ? (
              <div className="flex h-[116px] items-center justify-center text-muted">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : q.error ? (
              <p className="flex items-start gap-2 text-[13px] font-medium text-danger">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {q.error}
              </p>
            ) : q.quote ? (
              <div className={cn("space-y-2 text-[13.5px] transition-opacity", q.loading && "opacity-50")}>
                {q.quote.lineItems
                  .filter((l) => l.kind !== "deposit")
                  .map((l) => (
                    <div key={l.label} className="flex justify-between gap-3">
                      <span className="text-muted">{l.label}</span>
                      <span className={cn("font-medium", l.amount < 0 ? "text-success" : "text-ink")}>{l.amount < 0 ? `−${formatINR(-l.amount)}` : formatINR(l.amount)}</span>
                    </div>
                  ))}
                <div className="flex justify-between border-t border-line pt-2 font-semibold text-ink">
                  <span>Trip total · {formatDuration(q.quote.durationHours)}</span>
                  <span>{formatINR(q.quote.rentalTotal)}</span>
                </div>
                <div className="flex justify-between text-[12.5px] text-muted">
                  <span className="flex items-center gap-1">
                    <Info className="h-3 w-3" /> Refundable deposit
                  </span>
                  <span>{formatINR(q.quote.securityDeposit)}</span>
                </div>
                <p className="text-[12px] text-muted">Includes {q.quote.includedKm} km · then {formatINR(q.quote.extraKmRate)}/km</p>
              </div>
            ) : null}
          </div>
          {q.available === false && (
            <div className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-[13px]">
              <p className="font-medium text-danger">This car is booked for part of that window.</p>
              {suggestion && (
                <button
                  onClick={() => {
                    setStart(suggestion.start);
                    setEnd(suggestion.end);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 font-semibold text-ink shadow-card hover:bg-paper"
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Next available: {new Date(`${suggestion.start}:00+05:30`).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
                </button>
              )}
            </div>
          )}
          {!bookable && <p className="text-[13px] font-medium text-warning">This car is temporarily unavailable for new bookings.</p>}
          <div className="hidden lg:block">{cta}</div>
          <p className="text-center text-[12px] text-muted">Free cancellation up to 24 hours before pickup</p>
        </div>
      </div>

      {/* Mobile sticky booking bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-semibold leading-tight text-ink">{q.quote ? formatINR(q.quote.rentalTotal) : formatINR(dailyRate)}</p>
            <p className="truncate text-[12px] text-muted">{q.quote ? `${formatDuration(q.quote.durationHours)} · incl. GST` : "per day"}</p>
          </div>
          <div className="w-1/2">{cta}</div>
        </div>
      </div>
    </>
  );
}

/* ───────────── Recently viewed (per-browser convenience) ───────────── */

const RV_KEY = "mdz_recent";

export function TrackRecentlyViewed({ id }: { id: string }) {
  useEffect(() => {
    try {
      const list: string[] = JSON.parse(localStorage.getItem(RV_KEY) ?? "[]");
      localStorage.setItem(RV_KEY, JSON.stringify([id, ...list.filter((x) => x !== id)].slice(0, 8)));
    } catch {
      /* storage unavailable */
    }
  }, [id]);
  return null;
}

export function readRecentlyViewed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RV_KEY) ?? "[]");
  } catch {
    return [];
  }
}
