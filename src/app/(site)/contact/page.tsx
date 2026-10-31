import type { Metadata } from "next";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { getLocations } from "@/lib/queries/vehicles";
import { BRAND } from "@/lib/constants";
import { PageHero } from "@/components/site/page-hero";
import { ContactForm } from "@/components/site/contact-form";

export const metadata: Metadata = { title: "Contact us", description: "Talk to MyDrivez — 24/7 support, corporate rentals and partnerships." };

export default async function ContactPage() {
  const locations = await getLocations();
  return (
    <>
      <PageHero eyebrow="Contact" title={<>We&apos;re here, <span className="text-lime">24/7</span>.</>} body="Questions about a booking, a corporate fleet, or partnering with us? Reach out — a real person will reply." image="/photos/night.jpg" />
      <section className="py-20 lg:py-24">
        <div className="container grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-4">
            {[
              [Phone, "Call us", BRAND.phone, "Roadside & booking help, any hour"],
              [Mail, "Email", BRAND.email, "We reply within 2 working hours"],
              [MapPin, "Head office", BRAND.address, ""],
              [Clock, "Hub hours", "6:00 AM – 11:00 PM daily", "Airport hubs operate 24/7"],
            ].map(([Icon, t, v, s]) => {
              const I = Icon as React.ElementType;
              return (
                <div key={t as string} className="card flex gap-4 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ink text-lime">
                    <I className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[12.5px] text-muted">{t as string}</p>
                    <p className="font-semibold text-ink">{v as string}</p>
                    {s && <p className="text-[12.5px] text-muted">{s as string}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card p-6 sm:p-8">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Send us a message</h2>
            <p className="mb-6 mt-1 text-[14px] text-muted">Booking-related? Signed-in customers get faster help through support tickets.</p>
            <ContactForm />
          </div>
        </div>
        <div className="container mt-16">
          <h2 className="mb-6 text-2xl font-semibold tracking-[-0.03em]">Our pickup hubs</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l) => (
              <a
                key={l.id}
                href={l.latitude ? `https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                className="card group p-5 transition-all hover:shadow-lift"
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">{l.city.name}</p>
                <p className="mt-1 font-semibold text-ink">{l.name}</p>
                <p className="mt-1 text-[13.5px] text-muted">{l.address}</p>
                <p className="mt-3 text-[12.5px] font-semibold text-ink opacity-60 group-hover:opacity-100">Open in Google Maps →</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
