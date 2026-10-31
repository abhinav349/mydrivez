import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BadgePercent,
  CalendarRange,
  CarFront,
  FileCheck2,
  Headphones,
  KeyRound,
  ReceiptIndianRupee,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCategoryCounts, getFeaturedVehicles, getLocations } from "@/lib/queries/vehicles";
import { CATEGORY_BLURB, CATEGORY_IMAGE, CATEGORY_LABEL } from "@/lib/constants";
import { formatINR } from "@/lib/utils";
import { SearchWidget } from "@/components/site/search-widget";
import { CarCard } from "@/components/site/car-card";
import { Faq } from "@/components/site/faq";
import { HeroText, Reveal } from "@/components/site/reveal";
import { LinkButton } from "@/components/ui/button";
import { Avatar, SectionHeading } from "@/components/ui/misc";
import { getCurrentUser } from "@/lib/auth/session";
import type { VehicleCategory } from "@prisma/client";

const STEPS = [
  { icon: CarFront, title: "Choose your car", body: "Filter 100s of verified cars by city, dates, type and price." },
  { icon: CalendarRange, title: "Complete your booking", body: "See every rupee upfront. Apply a coupon, pay securely." },
  { icon: FileCheck2, title: "Verify your documents", body: "Upload licence & ID once. We verify within hours." },
  { icon: KeyRound, title: "Pick up your car", body: "Collect from a hub or get it delivered to your door." },
  { icon: Route, title: "Enjoy your journey", body: "Unlimited freedom with 24/7 roadside support." },
];

const WHY = [
  { icon: ReceiptIndianRupee, title: "Affordable pricing", body: "Hourly to monthly plans with automatic best-rate tiering." },
  { icon: Wrench, title: "Well-maintained vehicles", body: "142-point inspection and deep-clean before every single trip." },
  { icon: BadgeCheck, title: "No hidden charges", body: "GST, deposit, km allowance — all shown before you pay." },
  { icon: Sparkles, title: "Easy online booking", body: "Search to keys in under 3 minutes, on any device." },
  { icon: Headphones, title: "Reliable support", body: "Real humans, 24/7, with an average 40-second pickup time." },
  { icon: ShieldCheck, title: "Insured & secure", body: "Comprehensive insurance and GPS-tracked fleet." },
];

export default async function HomePage() {
  const [locations, featured, counts, coupons, reviews, user] = await Promise.all([
    getLocations(),
    getFeaturedVehicles(6),
    getCategoryCounts(),
    db.coupon.findMany({ where: { isActive: true, isPublic: true, validUntil: { gt: new Date() } }, orderBy: { validUntil: "asc" }, take: 4 }),
    db.review.findMany({
      where: { status: "APPROVED", rating: { gte: 4 } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { user: { select: { name: true, avatarUrl: true } }, vehicle: { select: { brand: true, model: true } } },
    }),
    getCurrentUser(),
  ]);
  const wish = user ? new Set((await db.wishlist.findMany({ where: { userId: user.id }, select: { vehicleId: true } })).map((w) => w.vehicleId)) : new Set<string>();
  const totalCars = Object.values(counts).reduce((s, c) => s + (c?.count ?? 0), 0);
  const cityCount = new Set(locations.map((l) => l.city.slug)).size;

  return (
    <>
      {/* ───────────── HERO ───────────── */}
      <section className="relative isolate overflow-hidden bg-ink">
        <Image src="/photos/hero.jpg" alt="" fill priority sizes="100vw" className="-z-10 object-cover object-[60%_center] opacity-80" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_40%,transparent_0%,rgba(16,24,32,.55)_55%,#101820_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-ink to-transparent" />
        <div className="grain pointer-events-none absolute inset-0 -z-10" />

        <div className="container flex min-h-[100svh] flex-col justify-end pb-10 pt-32 lg:min-h-[860px] lg:pb-14">
          <div className="max-w-3xl">
            <HeroText>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1.5 pl-1.5 pr-3.5 text-[12.5px] font-medium text-white/80 backdrop-blur">
                <span className="rounded-full bg-lime px-2 py-0.5 text-[11px] font-bold text-ink">NEW</span>
                Doorstep delivery now live in {cityCount} cities
              </span>
            </HeroText>
            <HeroText delay={0.08}>
              <h1 className="mt-6 text-balance font-display text-[44px] font-semibold leading-[0.98] tracking-tightest text-white sm:text-[68px] lg:text-[84px]">
                Your Journey.
                <br />
                Your Rules. <span className="text-lime">Your Drive.</span>
              </h1>
            </HeroText>
            <HeroText delay={0.16}>
              <p className="mt-6 max-w-xl text-[16.5px] leading-relaxed text-white/65 sm:text-lg">
                Experience the freedom of self-drive car rentals. Find your perfect ride, book in minutes, and hit the road.
              </p>
            </HeroText>
          </div>

          <HeroText delay={0.26} className="mt-10">
            <SearchWidget locations={locations} />
          </HeroText>

          <HeroText delay={0.36}>
            <ul className="mt-7 grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px] text-white/70 sm:flex sm:flex-wrap sm:items-center sm:gap-x-8">
              {[
                [ShieldCheck, "Verified vehicles"],
                [ReceiptIndianRupee, "Transparent pricing"],
                [CalendarRange, "Flexible bookings"],
                [Headphones, "24/7 customer support"],
              ].map(([Icon, label]) => {
                const I = Icon as React.ElementType;
                return (
                  <li key={label as string} className="flex items-center gap-2">
                    <I className="h-4 w-4 text-lime" /> {label as string}
                  </li>
                );
              })}
            </ul>
          </HeroText>
        </div>
      </section>

      {/* ───────────── STATS STRIP ───────────── */}
      <section className="border-b border-line bg-white">
        <div className="container grid grid-cols-2 divide-line py-8 sm:grid-cols-4 sm:divide-x">
          {[
            [`${totalCars}+`, "Cars in the fleet"],
            [`${cityCount}`, "Cities & growing"],
            ["4.8★", "Average trip rating"],
            ["40s", "Avg. support pickup"],
          ].map(([v, l]) => (
            <div key={l} className="px-4 py-3 text-center">
              <p className="font-display text-3xl font-semibold tracking-[-0.04em] text-ink sm:text-4xl">{v}</p>
              <p className="mt-1 text-[13px] text-muted">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────── FEATURED ───────────── */}
      <section className="py-20 lg:py-28">
        <div className="container">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <SectionHeading eyebrow="Featured fleet" title="Hand-picked for the drive ahead" body="Spotless, sanitised and inspected before every trip. These are our guests' favourites this month." />
            <LinkButton href="/cars" variant="secondary">
              Explore all cars <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c, i) => (
              <CarCard key={c.id} car={c} saved={wish.has(c.id)} priority={i < 3} />
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── CATEGORIES ───────────── */}
      <section className="pb-20 lg:pb-28">
        <div className="container">
          <SectionHeading eyebrow="Browse by category" title="A car for every kind of plan" />
          <div className="mt-12 grid auto-rows-[220px] grid-cols-2 gap-4 lg:grid-cols-4 lg:auto-rows-[250px]">
            {(Object.keys(CATEGORY_LABEL) as VehicleCategory[]).map((cat, i) => {
              const wide = i === 0 || i === 5;
              return (
                <Reveal key={cat} delay={i * 0.05} className={wide ? "col-span-2" : ""}>
                  <Link href={`/cars?category=${cat}`} className="group relative block h-full overflow-hidden rounded-3xl bg-ink">
                    <Image src={CATEGORY_IMAGE[cat]} alt="" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover opacity-80 transition-all duration-700 group-hover:scale-105 group-hover:opacity-90" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-5 sm:p-6">
                      <div>
                        <p className="text-[12px] font-medium text-white/60">{CATEGORY_BLURB[cat]}</p>
                        <h3 className="mt-1 text-[22px] font-semibold tracking-[-0.03em] text-white sm:text-[26px]">{CATEGORY_LABEL[cat]}</h3>
                        <p className="mt-1 text-[12.5px] text-white/60">
                          {counts[cat]?.count ?? 0} cars{counts[cat] ? ` · from ${formatINR(counts[cat]!.from)}/day` : ""}
                        </p>
                      </div>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-all group-hover:bg-lime group-hover:text-ink">
                        <ArrowRight className="h-4 w-4 -rotate-45 transition-transform group-hover:rotate-0" />
                      </span>
                    </div>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────── HOW IT WORKS ───────────── */}
      <section className="relative overflow-hidden bg-ink py-20 text-white lg:py-28">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-lime/10 blur-[140px]" />
        <div className="container relative">
          <SectionHeading dark align="center" eyebrow="How it works" title="From search to steering wheel in five steps" />
          <ol className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
            <div aria-hidden className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent lg:block" />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <li className="relative">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-ink-700 text-lime shadow-[0_0_0_6px_#101820]">
                    <s.icon className="h-6 w-6" />
                    <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-lime text-[11px] font-bold text-ink">{i + 1}</span>
                  </div>
                  <h3 className="mt-6 text-lg font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-white/55">{s.body}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── WHY US ───────────── */}
      <section className="py-20 lg:py-28">
        <div className="container grid gap-14 lg:grid-cols-[1fr_1.4fr] lg:items-center">
          <div>
            <SectionHeading eyebrow="Why MyDrivez" title="Rental, rebuilt around you" body="We obsess over the details other rental companies skip — so every trip feels like it's your own car." />
            <div className="relative mt-10 aspect-[4/3] overflow-hidden rounded-3xl">
              <Image src="/photos/interior.jpg" alt="Driving a MyDrivez car" fill sizes="(max-width:1024px) 100vw, 40vw" className="object-cover" />
              <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl bg-white/90 p-4 backdrop-blur">
                <div className="flex -space-x-2">
                  {["Aarav Shah", "Isha Rao", "Kabir Mehta"].map((n) => (
                    <Avatar key={n} name={n} size={32} className="ring-2 ring-white" />
                  ))}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">12,000+ happy drivers</p>
                  <p className="flex items-center gap-1 text-[12px] text-muted">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> 4.8 average across all trips
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {WHY.map((w, i) => (
              <Reveal key={w.title} delay={i * 0.05}>
                <div className="card group h-full p-6 transition-all hover:-translate-y-0.5 hover:shadow-lift">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper text-ink transition-colors group-hover:bg-ink group-hover:text-lime">
                    <w.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-[17px] font-semibold">{w.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-muted">{w.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── OFFERS ───────────── */}
      {coupons.length > 0 && (
        <section className="pb-20 lg:pb-28">
          <div className="container">
            <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
              <SectionHeading eyebrow="Offers" title="Deals worth hitting the road for" />
              <LinkButton href="/offers" variant="secondary">
                All offers <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {coupons.map((c, i) => (
                <Reveal key={c.id} delay={i * 0.06}>
                  <div className={`relative h-full overflow-hidden rounded-3xl p-6 ${i === 0 ? "bg-lime text-ink" : "border border-line bg-white"}`}>
                    <BadgePercent className={`h-7 w-7 ${i === 0 ? "text-ink" : "text-lime-600"}`} />
                    <p className="mt-6 font-display text-[32px] font-semibold leading-none tracking-[-0.04em]">
                      {c.discountType === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`}
                    </p>
                    <h3 className="mt-3 text-[16px] font-semibold">{c.title}</h3>
                    <p className={`mt-1 text-[13px] leading-relaxed ${i === 0 ? "text-ink/70" : "text-muted"}`}>{c.description}</p>
                    <div className={`mt-6 inline-flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 font-mono text-[13px] font-bold tracking-wider ${i === 0 ? "border-ink/40" : "border-ink/20"}`}>
                      {c.code}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────────── TESTIMONIALS ───────────── */}
      {reviews.length > 0 && (
        <section className="overflow-hidden border-y border-line bg-white py-20 lg:py-28">
          <div className="container">
            <SectionHeading align="center" eyebrow="Loved by drivers" title="Don't take our word for it" />
          </div>
          <div className="relative mt-14">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white to-transparent" />
            <div className="flex w-max animate-marquee gap-5 hover:[animation-play-state:paused]">
              {[...reviews, ...reviews].map((r, i) => (
                <figure key={`${r.id}-${i}`} className="w-[340px] shrink-0 rounded-3xl border border-line bg-paper p-7 sm:w-[400px]">
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.rating }).map((_, k) => (
                      <Star key={k} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <blockquote className="mt-4 line-clamp-4 text-[15px] leading-relaxed text-graphite">“{r.comment}”</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <Avatar name={r.user.name} src={r.user.avatarUrl} size={38} />
                    <div>
                      <p className="text-sm font-semibold text-ink">{r.user.name}</p>
                      <p className="text-[12px] text-muted">
                        Drove the {r.vehicle.brand} {r.vehicle.model}
                      </p>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ───────────── FAQ ───────────── */}
      <section id="faq" className="scroll-mt-24 py-20 lg:py-28">
        <div className="container grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHeading eyebrow="FAQ" title="Questions, answered" body="Can't find what you're looking for? Our team is available around the clock." />
            <LinkButton href="/contact" variant="secondary" className="mt-8">
              Contact support
            </LinkButton>
          </div>
          <Faq />
        </div>
      </section>

      {/* ───────────── CTA ───────────── */}
      <section className="pb-20 lg:pb-28">
        <div className="container">
          <div className="relative isolate overflow-hidden rounded-[32px] bg-ink px-6 py-16 sm:px-14 lg:py-20">
            <Image src="/photos/road.jpg" alt="" fill sizes="100vw" className="-z-10 object-cover opacity-35" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/85 to-ink/30" />
            <div className="max-w-xl">
              <h2 className="text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.04em] text-white sm:text-5xl">
                The open road is <span className="text-lime">one tap</span> away.
              </h2>
              <p className="mt-4 text-[16px] text-white/60">Sign up today and get ₹500 off your first trip with code FIRSTDRIVE.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/cars" variant="accent" size="lg">
                  Find a car <ArrowRight className="h-4 w-4" />
                </LinkButton>
                <LinkButton href="/register" variant="dark-outline" size="lg">
                  Create free account
                </LinkButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
