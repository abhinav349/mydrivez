import type { Metadata } from "next";
import { CarFront } from "lucide-react";
import { getFilterFacets, getLocations, searchVehicles, type SearchFilters } from "@/lib/queries/vehicles";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { fromLocalInput, formatDateTime } from "@/lib/utils";
import { CarCard } from "@/components/site/car-card";
import { SearchWidget } from "@/components/site/search-widget";
import { ClearFilters, FilterSidebar, MobileFilters, SortSelect } from "@/components/site/filters";
import { EmptyState } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: "Explore self-drive cars",
  description: "Browse hatchbacks, sedans, SUVs, EVs and luxury cars for self-drive rental. Live availability and transparent pricing.",
};

type SP = Record<string, string | undefined>;

const csv = (v?: string) => (v ? v.split(",").filter(Boolean) : undefined);
const num = (v?: string) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
const validLocal = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v : undefined);

export default async function CarsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const startLocal = validLocal(sp.start);
  const endLocal = validLocal(sp.end);
  const filters: SearchFilters = {
    city: sp.city,
    start: startLocal ? fromLocalInput(startLocal) : undefined,
    end: endLocal ? fromLocalInput(endLocal) : undefined,
    categories: csv(sp.category),
    brands: csv(sp.brand),
    fuels: csv(sp.fuel),
    transmission: sp.transmission,
    seats: num(sp.seats),
    priceMax: num(sp.priceMax),
    rating: num(sp.rating),
    availableOnly: sp.available === "1",
    q: sp.q?.slice(0, 40),
    sort: sp.sort as SearchFilters["sort"],
  };

  const [cars, facets, locations, user] = await Promise.all([searchVehicles(filters), getFilterFacets(), getLocations(), getCurrentUser()]);
  const wish = user ? new Set((await db.wishlist.findMany({ where: { userId: user.id }, select: { vehicleId: true } })).map((w) => w.vehicleId)) : new Set<string>();

  const carry = new URLSearchParams();
  if (startLocal) carry.set("start", startLocal);
  if (endLocal) carry.set("end", endLocal);
  if (sp.drop) carry.set("drop", sp.drop);
  const query = carry.toString() ? `?${carry}` : "";
  const activeCount = ["category", "brand", "fuel", "transmission", "seats", "priceMax", "rating", "available"].filter((k) => sp[k]).length;
  const cityName = facets.cities.find((c) => c.slug === sp.city)?.name;

  return (
    <div className="pb-24 pt-[68px]">
      <div className="border-b border-line bg-white">
        <div className="container py-8 lg:py-10">
          <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{cityName ? `Self-drive cars in ${cityName}` : "Explore cars"}</h1>
          <p className="mt-2 text-[15px] text-muted">
            {filters.start && filters.end ? (
              <>
                Showing live availability for <span className="font-medium text-ink">{formatDateTime(filters.start)}</span> →{" "}
                <span className="font-medium text-ink">{formatDateTime(filters.end)}</span>
              </>
            ) : (
              "Every car is verified, insured and deep-cleaned before your trip."
            )}
          </p>
          <div className="mt-6">
            <SearchWidget locations={locations} variant="bar" initial={{ city: sp.city, start: startLocal, end: endLocal, category: sp.category?.split(",")[0], drop: sp.drop }} />
          </div>
        </div>
      </div>

      <div className="container mt-8 grid gap-8 lg:grid-cols-[280px_1fr]">
        <FilterSidebar facets={facets} />
        <section aria-label="Results">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <p className="text-[14px] text-muted">
                <span className="font-semibold text-ink">{cars.length}</span> {cars.length === 1 ? "car" : "cars"} found
              </p>
              <ClearFilters />
            </div>
            <div className="flex items-center gap-2">
              <MobileFilters facets={facets} activeCount={activeCount} />
              <SortSelect />
            </div>
          </div>
          {cars.length ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {cars.map((c, i) => (
                <CarCard key={c.id} car={c} saved={wish.has(c.id)} query={query} priority={i < 3} />
              ))}
            </div>
          ) : (
            <EmptyState icon={CarFront} title="No cars match these filters" body="Try widening the price range, changing dates, or clearing a few filters." />
          )}
        </section>
      </div>
    </div>
  );
}
