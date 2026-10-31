"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CarFront, MapPin, Search } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/constants";
import { cn, toLocalInput } from "@/lib/utils";

export type LocationOption = { id: string; name: string; city: { name: string; slug: string } };

function defaultTimes() {
  const start = new Date(Date.now() + 24 * 3600_000);
  start.setUTCMinutes(start.getUTCMinutes() < 30 ? 30 : 60, 0, 0);
  // Round to 10:00 IST tomorrow for a friendlier default
  const ist = new Date(start.getTime() + 5.5 * 3600_000);
  ist.setUTCHours(10, 0, 0, 0);
  const s = new Date(ist.getTime() - 5.5 * 3600_000);
  return { start: toLocalInput(s), end: toLocalInput(new Date(s.getTime() + 2 * 86_400_000)) };
}

export function SearchWidget({ locations, variant = "hero", initial }: { locations: LocationOption[]; variant?: "hero" | "bar"; initial?: Partial<Record<string, string>> }) {
  const router = useRouter();
  const defaults = useMemo(defaultTimes, []);
  const [pickup, setPickup] = useState(initial?.city ?? "");
  const [drop, setDrop] = useState(initial?.drop ?? "");
  const [start, setStart] = useState(initial?.start ?? defaults.start);
  const [end, setEnd] = useState(initial?.end ?? defaults.end);
  const [category, setCategory] = useState(initial?.category ?? "");
  const [error, setError] = useState<string | null>(null);

  const cities = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; hubs: LocationOption[] }>();
    for (const l of locations) {
      const c = map.get(l.city.slug) ?? { ...l.city, hubs: [] };
      c.hubs.push(l);
      map.set(l.city.slug, c);
    }
    return [...map.values()];
  }, [locations]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (new Date(end) <= new Date(start)) return setError("Return must be after pickup.");
    if (new Date(`${start}:00+05:30`).getTime() < Date.now()) return setError("Pickup time is in the past.");
    setError(null);
    const p = new URLSearchParams();
    if (pickup) p.set("city", pickup);
    if (drop) p.set("drop", drop);
    p.set("start", start);
    p.set("end", end);
    if (category) p.set("category", category);
    router.push(`/cars?${p.toString()}`);
  };

  const hero = variant === "hero";
  const wide = "col-span-2 lg:col-span-1";
  const cell = cn("group relative flex flex-col justify-center px-4 py-3 transition-colors", hero ? "rounded-2xl hover:bg-paper focus-within:bg-paper" : "rounded-xl");
  const lbl = "flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted";
  const ctl = "mt-1 w-full min-w-0 appearance-none bg-transparent text-[13px] sm:text-[14.5px] font-semibold text-ink outline-none [color-scheme:light]";

  return (
    <form
      onSubmit={submit}
      className={cn(
        "w-full",
        hero ? "rounded-[26px] border border-white/60 bg-white/95 p-2 shadow-[0_30px_80px_-20px_rgba(0,0,0,.5)] backdrop-blur-xl" : "rounded-2xl border border-line bg-white p-1.5 shadow-card",
      )}
    >
      <div className="grid grid-cols-2 gap-1 lg:grid-cols-[1.25fr_1fr_1.15fr_1.15fr_.95fr_auto]">
        <label className={cn(cell, wide)}>
          <span className={lbl}>
            <MapPin className="h-3.5 w-3.5" /> Pickup city
          </span>
          <select className={ctl} value={pickup} onChange={(e) => setPickup(e.target.value)} aria-label="Pickup city">
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className={cn(cell, wide)}>
          <span className={lbl}>
            <MapPin className="h-3.5 w-3.5" /> Drop-off <span className="normal-case tracking-normal text-muted/70">(optional)</span>
          </span>
          <select className={ctl} value={drop} onChange={(e) => setDrop(e.target.value)} aria-label="Drop-off hub">
            <option value="">Same as pickup</option>
            {cities.map((c) => (
              <optgroup key={c.slug} label={c.name}>
                {c.hubs.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className={cell}>
          <span className={lbl}>
            <CalendarClock className="h-3.5 w-3.5" /> Pickup
          </span>
          <input type="datetime-local" className={cn(ctl, "max-lg:[&::-webkit-calendar-picker-indicator]:hidden")} value={start} min={defaults.start.slice(0, 10) + "T00:00"} onChange={(e) => setStart(e.target.value)} required />
        </label>
        <label className={cell}>
          <span className={lbl}>
            <CalendarClock className="h-3.5 w-3.5" /> Return
          </span>
          <input type="datetime-local" className={cn(ctl, "max-lg:[&::-webkit-calendar-picker-indicator]:hidden")} value={end} min={start} onChange={(e) => setEnd(e.target.value)} required />
        </label>
        <label className={cn(cell, wide)}>
          <span className={lbl}>
            <CarFront className="h-3.5 w-3.5" /> Category
          </span>
          <select className={ctl} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Any type</option>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="group/s flex h-14 items-center justify-center gap-2 rounded-2xl bg-ink px-7 text-[15px] font-semibold text-white transition-all hover:bg-ink-700 active:scale-[.98] col-span-2 lg:col-span-1 lg:h-auto"
        >
          <Search className="h-[18px] w-[18px] text-lime transition-transform group-hover/s:scale-110" />
          Search cars
        </button>
      </div>
      {error && <p className="px-4 pb-2 pt-1 text-[13px] font-medium text-danger">{error}</p>}
    </form>
  );
}
