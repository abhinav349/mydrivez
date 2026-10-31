import type { Metadata } from "next";
import Image from "next/image";
import { Compass, HeartHandshake, Leaf, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "About us", description: "MyDrivez is building India's most trusted self-drive car rental experience." };

const VALUES = [
  { icon: ShieldCheck, title: "Trust by default", body: "Verified cars, documented handovers and pricing you can audit line by line." },
  { icon: HeartHandshake, title: "Human support", body: "Real people on call around the clock — because roads don't keep office hours." },
  { icon: Compass, title: "Freedom first", body: "Hourly to monthly, hub or doorstep. Your trip, planned your way." },
  { icon: Leaf, title: "Cleaner miles", body: "A growing EV and hybrid fleet, with charging guidance on every trip." },
];

export default async function AboutPage() {
  const [cars, cities] = await Promise.all([db.vehicle.count({ where: { status: { not: "INACTIVE" } } }), db.city.count({ where: { isActive: true } })]);
  return (
    <>
      <PageHero eyebrow="About MyDrivez" title={<>We think renting a car should feel like <span className="text-lime">owning one</span>.</>} body="MyDrivez started with a simple frustration: self-drive rentals in India were either cheap and unreliable, or reliable and opaque. We set out to build neither." image="/photos/offroad.jpg" />
      <section className="py-20 lg:py-28">
        <div className="container grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow="Our story" title="Built by road-trippers, for road-trippers" />
            <div className="mt-6 space-y-4 text-[15.5px] leading-relaxed text-muted">
              <p>Every MyDrivez car is hand-picked, maintained on a strict schedule and inspected before every single trip. Every price is calculated live, in the open, with GST and deposits shown before you pay.</p>
              <p>Today we operate {cars} cars across {cities} cities — from nimble hatchbacks for city errands to 4×4s for the Western Ghats and luxury sedans for the moments that matter.</p>
            </div>
            <div className="mt-10 grid grid-cols-3 gap-6">
              {[
                [`${cars}+`, "Cars"],
                [`${cities}`, "Cities"],
                ["24/7", "Support"],
              ].map(([v, l]) => (
                <div key={l}>
                  <p className="font-display text-4xl font-semibold tracking-[-0.04em] text-ink">{v}</p>
                  <p className="text-[13px] text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl">
            <Image src="/photos/cat-suv.jpg" alt="SUV on a desert road" fill sizes="(max-width:1024px) 100vw, 50vw" className="object-cover" />
          </div>
        </div>
      </section>
      <section className="bg-white py-20 lg:py-28">
        <div className="container">
          <SectionHeading align="center" eyebrow="What we stand for" title="Our values" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={i * 0.06}>
                <div className="h-full rounded-3xl border border-line bg-paper p-7">
                  <v.icon className="h-6 w-6 text-ink" />
                  <h3 className="mt-6 text-lg font-semibold">{v.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <div className="mt-14 text-center">
            <LinkButton href="/cars" size="lg">
              Start your journey
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
