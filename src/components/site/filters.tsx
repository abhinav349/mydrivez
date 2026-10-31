"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { CATEGORY_LABEL, FUEL_LABEL } from "@/lib/constants";
import { cn, formatINR } from "@/lib/utils";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";

type Facets = { brands: string[]; cities: { name: string; slug: string }[]; minPrice: number; maxPrice: number };

function useParamsUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const set = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    mutate(p);
    start(() => router.replace(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  return { params, set, pending };
}

function toggleList(p: URLSearchParams, key: string, value: string) {
  const list = (p.get(key) ?? "").split(",").filter(Boolean);
  const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  if (next.length) p.set(key, next.join(","));
  else p.delete(key);
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-xl border px-3 py-2 text-[13px] font-medium transition-all",
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-graphite hover:border-ink/30",
      )}
    >
      {children}
    </button>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-5 last:border-0">
      <p className="mb-3 text-[13px] font-semibold text-ink">{title}</p>
      {children}
    </div>
  );
}

function FilterBody({ facets }: { facets: Facets }) {
  const { params, set } = useParamsUpdater();
  const list = (k: string) => (params.get(k) ?? "").split(",").filter(Boolean);
  const [max, setMax] = useState(Number(params.get("priceMax") ?? facets.maxPrice));

  return (
    <div>
      <Group title="City">
        <div className="flex flex-wrap gap-2">
          <Chip active={!params.get("city")} onClick={() => set((p) => p.delete("city"))}>
            All
          </Chip>
          {facets.cities.map((c) => (
            <Chip key={c.slug} active={params.get("city") === c.slug} onClick={() => set((p) => p.set("city", c.slug))}>
              {c.name}
            </Chip>
          ))}
        </div>
      </Group>
      <Group title="Price per day">
        <div className="flex items-center justify-between text-[13px] text-muted">
          <span>{formatINR(facets.minPrice)}</span>
          <span className="font-semibold text-ink">up to {formatINR(max)}</span>
        </div>
        <input
          type="range"
          min={facets.minPrice}
          max={facets.maxPrice}
          step={100}
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
          onPointerUp={() => set((p) => (max >= facets.maxPrice ? p.delete("priceMax") : p.set("priceMax", String(max))))}
          onKeyUp={() => set((p) => (max >= facets.maxPrice ? p.delete("priceMax") : p.set("priceMax", String(max))))}
          className="mt-3 w-full accent-ink"
          aria-label="Maximum price per day"
        />
      </Group>
      <Group title="Car type">
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
            <Chip key={k} active={list("category").includes(k)} onClick={() => set((p) => toggleList(p, "category", k))}>
              {v}
            </Chip>
          ))}
        </div>
      </Group>
      <Group title="Transmission">
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Any"],
            ["AUTOMATIC", "Automatic"],
            ["MANUAL", "Manual"],
          ].map(([k, v]) => (
            <Chip key={k} active={(params.get("transmission") ?? "") === k} onClick={() => set((p) => (k ? p.set("transmission", k) : p.delete("transmission")))}>
              {v}
            </Chip>
          ))}
        </div>
      </Group>
      <Group title="Fuel type">
        <div className="flex flex-wrap gap-2">
          {Object.entries(FUEL_LABEL).map(([k, v]) => (
            <Chip key={k} active={list("fuel").includes(k)} onClick={() => set((p) => toggleList(p, "fuel", k))}>
              {v}
            </Chip>
          ))}
        </div>
      </Group>
      <Group title="Seats">
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Any"],
            ["5", "5+"],
            ["7", "7+"],
          ].map(([k, v]) => (
            <Chip key={k} active={(params.get("seats") ?? "") === k} onClick={() => set((p) => (k ? p.set("seats", k) : p.delete("seats")))}>
              {v}
            </Chip>
          ))}
        </div>
      </Group>
      <Group title="Brand">
        <div className="flex flex-wrap gap-2">
          {facets.brands.map((b) => (
            <Chip key={b} active={list("brand").includes(b)} onClick={() => set((p) => toggleList(p, "brand", b))}>
              {b}
            </Chip>
          ))}
        </div>
      </Group>
      <Group title="Rating">
        <div className="flex flex-wrap gap-2">
          {[
            ["", "Any"],
            ["4", "4.0+"],
            ["4.5", "4.5+"],
          ].map(([k, v]) => (
            <Chip key={k} active={(params.get("rating") ?? "") === k} onClick={() => set((p) => (k ? p.set("rating", k) : p.delete("rating")))}>
              {v}
            </Chip>
          ))}
        </div>
      </Group>
      <Group title="Availability">
        <label className="flex cursor-pointer items-center justify-between gap-3 text-[13.5px] text-graphite">
          Only show cars free for my dates
          <input
            type="checkbox"
            className="h-4 w-4 accent-ink"
            checked={params.get("available") === "1"}
            onChange={(e) => set((p) => (e.target.checked ? p.set("available", "1") : p.delete("available")))}
          />
        </label>
        {!params.get("start") && <p className="mt-2 text-[12px] text-muted">Pick dates above to check live availability.</p>}
      </Group>
    </div>
  );
}

export function FilterSidebar({ facets }: { facets: Facets }) {
  return (
    <aside className="sticky top-[88px] hidden max-h-[calc(100vh-110px)] overflow-y-auto rounded-2xl border border-line bg-white px-5 py-1 lg:block">
      <FilterBody facets={facets} />
    </aside>
  );
}

export function MobileFilters({ facets, activeCount }: { facets: Facets; activeCount: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)} className="lg:hidden">
        <SlidersHorizontal className="h-4 w-4" /> Filters {activeCount > 0 && <span className="rounded-full bg-ink px-1.5 text-[11px] text-lime">{activeCount}</span>}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Filters" width="max-w-md">
        <div className="px-6 pb-28">
          <FilterBody facets={facets} />
        </div>
        <div className="absolute inset-x-0 bottom-0 border-t border-line bg-white p-4">
          <Button className="w-full" onClick={() => setOpen(false)}>
            Show results
          </Button>
        </div>
      </Sheet>
    </>
  );
}

export function SortSelect() {
  const { params, set, pending } = useParamsUpdater();
  return (
    <label className="flex items-center gap-2 text-[13px] text-muted">
      <span className="hidden sm:inline">Sort by</span>
      <select
        value={params.get("sort") ?? "recommended"}
        onChange={(e) => set((p) => (e.target.value === "recommended" ? p.delete("sort") : p.set("sort", e.target.value)))}
        className={cn("h-9 rounded-lg border border-line bg-white px-3 text-[13px] font-semibold text-ink", pending && "opacity-60")}
      >
        <option value="recommended">Recommended</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="popular">Most Popular</option>
        <option value="rating">Highest Rated</option>
      </select>
    </label>
  );
}

export function ClearFilters() {
  const { params, set } = useParamsUpdater();
  const keys = ["category", "brand", "fuel", "transmission", "seats", "priceMax", "rating", "available", "q"];
  if (!keys.some((k) => params.get(k))) return null;
  return (
    <button onClick={() => set((p) => keys.forEach((k) => p.delete(k)))} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink">
      <X className="h-3.5 w-3.5" /> Clear filters
    </button>
  );
}
