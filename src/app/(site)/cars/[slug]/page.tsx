import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AirVent,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronRight,
  Cog,
  Fuel,
  Gauge,
  MapPin,
  ShieldCheck,
  Snowflake,
  Users,
} from "lucide-react";
import { getBookedRanges, getSimilarVehicles, getVehicleBySlug } from "@/lib/queries/vehicles";
import { getSettings } from "@/lib/settings";
import { CATEGORY_LABEL, FUEL_LABEL, TRANSMISSION_LABEL } from "@/lib/constants";
import { formatDate, formatINR } from "@/lib/utils";
import { AvailabilityCalendar, BookingWidget, Gallery, TrackRecentlyViewed } from "@/components/site/car-detail-client";
import { CarCard } from "@/components/site/car-card";
import { Avatar, Badge, Stars } from "@/components/ui/misc";

type Params = { slug: string };
type SP = Record<string, string | undefined>;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const v = await getVehicleBySlug(slug);
  if (!v) return { title: "Car not found" };
  const title = `${v.brand} ${v.model} self-drive rental in ${v.location.city.name}`;
  return {
    title,
    description: `Rent the ${v.year} ${v.brand} ${v.model} from ${formatINR(v.dailyRate)}/day. ${TRANSMISSION_LABEL[v.transmission]}, ${FUEL_LABEL[v.fuelType]}, ${v.seats} seats.`,
    openGraph: { title, images: v.images[0] ? [v.images[0].url] : [] },
  };
}

export default async function CarPage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<SP> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const v = await getVehicleBySlug(slug);
  if (!v) notFound();
  const [ranges, similar, settings] = await Promise.all([getBookedRanges(v.id), getSimilarVehicles(v.id, v.category), getSettings()]);
  const valid = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s : undefined);
  const title = `${v.brand} ${v.model}`;
  const bookable = v.status !== "MAINTENANCE" && v.status !== "INACTIVE";

  const ratingDist = [5, 4, 3, 2, 1].map((s) => ({ s, n: v.reviews.filter((r) => r.rating === s).length }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    image: v.images.map((i) => i.url),
    brand: { "@type": "Brand", name: v.brand },
    offers: { "@type": "Offer", priceCurrency: "INR", price: v.dailyRate, availability: "https://schema.org/InStock" },
    ...(v.ratingCount ? { aggregateRating: { "@type": "AggregateRating", ratingValue: v.ratingAvg.toFixed(1), reviewCount: v.ratingCount } } : {}),
  };

  return (
    <div className="pb-32 pt-[68px] lg:pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TrackRecentlyViewed id={v.id} />
      <div className="container">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 py-5 text-[13px] text-muted">
          <Link href="/cars" className="hover:text-ink">
            Cars
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href={`/cars?category=${v.category}`} className="hover:text-ink">
            {CATEGORY_LABEL[v.category]}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-ink">{title}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-[1fr_400px]">
          <div className="min-w-0">
            <Gallery images={v.images} title={title} />

            <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="dark">{CATEGORY_LABEL[v.category]}</Badge>
                  <Badge>{v.year}</Badge>
                  {v.status === "MAINTENANCE" && <Badge tone="warning">Under maintenance</Badge>}
                </div>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{title}</h1>
                {v.variant && <p className="mt-1 text-[15px] text-muted">{v.variant}</p>}
              </div>
              <div className="text-right">
                {v.ratingCount > 0 ? (
                  <>
                    <div className="flex items-center justify-end gap-2">
                      <Stars value={v.ratingAvg} size={16} />
                      <span className="font-semibold text-ink">{v.ratingAvg.toFixed(1)}</span>
                    </div>
                    <p className="text-[13px] text-muted">
                      {v.ratingCount} reviews · {v.tripCount} trips
                    </p>
                  </>
                ) : (
                  <Badge tone="accent">New to the fleet</Badge>
                )}
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [Cog, "Transmission", TRANSMISSION_LABEL[v.transmission]],
                [Fuel, "Fuel", FUEL_LABEL[v.fuelType]],
                [Users, "Seats", `${v.seats} seats`],
                [CalendarDays, "Model year", String(v.year)],
                [Gauge, "Mileage", v.mileage ?? "—"],
                [Snowflake, "Air conditioning", v.hasAC ? "Yes" : "No"],
                [AirVent, "Engine", v.engine ?? "—"],
                [MapPin, "Pickup hub", v.location.name],
              ].map(([Icon, label, value]) => {
                const I = Icon as React.ElementType;
                return (
                  <div key={label as string} className="rounded-2xl border border-line bg-white p-4">
                    <I className="h-4 w-4 text-muted" />
                    <p className="mt-3 text-[12px] text-muted">{label as string}</p>
                    <p className="mt-0.5 truncate text-[14px] font-semibold text-ink">{value as string}</p>
                  </div>
                );
              })}
            </div>

            <Section title="About this car">
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-graphite/85">{v.description}</p>
            </Section>

            {v.features.length > 0 && (
              <Section title="Features">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {v.features.map((f) => (
                    <li key={f.id} className="flex items-center gap-2.5 text-[14.5px] text-graphite">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lime-100 text-lime-600">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {f.name}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Pricing">
              <div className="overflow-hidden rounded-2xl border border-line bg-white">
                <table className="w-full text-[14px]">
                  <tbody className="divide-y divide-line">
                    {[
                      ["Hourly", `${formatINR(v.hourlyRate)} / hour`, "Short trips, capped at the daily rate"],
                      ["Daily", `${formatINR(v.dailyRate)} / day`, "Most popular"],
                      ["Weekly", `${formatINR(v.weeklyRate)} / week`, `${formatINR(Math.round(v.weeklyRate / 7))}/day effective`],
                      ["Monthly", `${formatINR(v.monthlyRate)} / month`, `${formatINR(Math.round(v.monthlyRate / 30))}/day effective`],
                      ["Security deposit", formatINR(v.securityDeposit), "Fully refundable after return"],
                      ["Included kilometres", `${v.includedKmPerDay} km / day`, "Pro-rated for your trip"],
                      ["Extra kilometres", `${formatINR(v.extraKmCharge)} / km`, "Beyond your allowance"],
                      ["Late return", `${formatINR(Math.round(v.hourlyRate * settings.lateFeeMultiplier))} / hour`, `After a ${settings.lateGraceMinutes}-minute grace period`],
                    ].map(([a, b, c]) => (
                      <tr key={a}>
                        <td className="px-5 py-3.5 font-medium text-ink">{a}</td>
                        <td className="px-5 py-3.5 font-semibold text-ink">{b}</td>
                        <td className="hidden px-5 py-3.5 text-muted sm:table-cell">{c}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[13px] text-muted">
                Prices exclude {settings.taxRatePct}% GST. Weekend and holiday pricing may apply and is always shown before you pay.
              </p>
            </Section>

            <Section title="Availability">
              <AvailabilityCalendar ranges={ranges} />
            </Section>

            <Section title="Pickup location">
              <div className="flex items-start gap-4 rounded-2xl border border-line bg-white p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-lime">
                  <MapPin className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {v.location.name}, {v.location.city.name}
                  </p>
                  <p className="mt-0.5 text-[14px] text-muted">{v.location.address}</p>
                  {v.location.latitude && v.location.longitude && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${v.location.latitude},${v.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-[13px] font-semibold text-ink underline underline-offset-4"
                    >
                      Open in Google Maps
                    </a>
                  )}
                  <p className="mt-2 text-[13px] text-muted">Doorstep delivery available at checkout for {formatINR(settings.doorstepFee)}.</p>
                </div>
              </div>
            </Section>

            <Section title="Rental conditions">
              <ul className="grid gap-3 text-[14px] text-graphite sm:grid-cols-2">
                {[
                  "Minimum driver age 21 with a licence held for 1+ year",
                  "Original driving licence must be shown at pickup",
                  v.fuelPolicy,
                  `Minimum booking duration ${settings.minHours} hours`,
                  "No smoking, pets allowed in a carrier only",
                  "Inter-state travel permitted; tolls & permits paid by guest",
                  "Free cancellation up to 24 hours before pickup",
                  "Comprehensive insurance with ₹5,000 damage liability cap",
                ].map((c) => (
                  <li key={c} className="flex gap-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                    {c}
                  </li>
                ))}
              </ul>
            </Section>

            <Section title={`Reviews${v.ratingCount ? ` (${v.ratingCount})` : ""}`}>
              {v.reviews.length ? (
                <div className="grid gap-8 md:grid-cols-[220px_1fr]">
                  <div>
                    <p className="font-display text-5xl font-semibold tracking-[-0.04em] text-ink">{v.ratingAvg.toFixed(1)}</p>
                    <Stars value={v.ratingAvg} size={16} className="mt-2" />
                    <div className="mt-5 space-y-1.5">
                      {ratingDist.map(({ s, n }) => (
                        <div key={s} className="flex items-center gap-2 text-[12px] text-muted">
                          <span className="w-3">{s}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/[.07]">
                            <div className="h-full rounded-full bg-ink" style={{ width: `${(n / v.reviews.length) * 100}%` }} />
                          </div>
                          <span className="w-4 text-right">{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <ul className="space-y-6">
                    {v.reviews.map((r) => (
                      <li key={r.id} className="border-b border-line pb-6 last:border-0">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.user.name} src={r.user.avatarUrl} size={36} />
                          <div>
                            <p className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
                              {r.user.name} <BadgeCheck className="h-3.5 w-3.5 text-info" aria-label="Verified trip" />
                            </p>
                            <p className="text-[12px] text-muted">{formatDate(r.createdAt)}</p>
                          </div>
                          <Stars value={r.rating} className="ml-auto" />
                        </div>
                        {r.title && <p className="mt-3 font-semibold text-ink">{r.title}</p>}
                        <p className="mt-1.5 text-[14.5px] leading-relaxed text-graphite/85">{r.comment}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-[14px] text-muted">No reviews yet. Only guests who complete a trip can review a car.</p>
              )}
            </Section>
          </div>

          <div>
            <div className="lg:sticky lg:top-[88px]">
              <BookingWidget
                vehicleId={v.id}
                slug={v.slug}
                dailyRate={v.dailyRate}
                hourlyRate={v.hourlyRate}
                initialStart={valid(sp.start)}
                initialEnd={valid(sp.end)}
                bookable={bookable}
                ranges={ranges}
              />
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-24">
            <h2 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">You might also like</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {similar.map((c) => (
                <CarCard key={c.id} car={c} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-line pt-10">
      <h2 className="mb-6 text-[22px] font-semibold tracking-[-0.03em]">{title}</h2>
      {children}
    </section>
  );
}
