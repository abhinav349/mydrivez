import type { Metadata } from "next";
import { CalendarRange, CarFront, FileCheck2, KeyRound, Route, ShieldCheck, Undo2, Wallet } from "lucide-react";
import { PageHero } from "@/components/site/page-hero";
import { Reveal } from "@/components/site/reveal";
import { Faq } from "@/components/site/faq";
import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/misc";

export const metadata: Metadata = { title: "How it works", description: "Book a self-drive car in minutes: choose, pay, verify, pick up and go." };

const STEPS = [
  { icon: CarFront, title: "Choose your car", body: "Search by city and dates. Every listing shows live availability, the exact price for your trip, included kilometres and the deposit — no surprises later." },
  { icon: CalendarRange, title: "Complete your booking", body: "Pick self-pickup at a hub or doorstep delivery, apply a coupon and see a line-by-line breakdown with GST before you pay. Your car is held for 15 minutes while you check out." },
  { icon: Wallet, title: "Pay securely", body: "UPI, cards or net banking through Razorpay. Payments are verified with the gateway on our servers before your booking is confirmed." },
  { icon: FileCheck2, title: "Verify your documents", body: "Upload your driving licence and a government ID once. Our team verifies them within hours, and they're stored privately — never shared." },
  { icon: KeyRound, title: "Pick up your car", body: "We walk around the car with you, photograph its condition and record the odometer and fuel level. You confirm, we hand over the keys." },
  { icon: Route, title: "Enjoy your journey", body: "Drive anywhere in India with 24/7 roadside assistance. Need more time? Contact support to extend." },
  { icon: Undo2, title: "Return & get your deposit", body: "Drop the car at the agreed hub. Any extra km, late hours or fuel shortfall are calculated transparently and the rest of your deposit is refunded automatically." },
];

export default function HowItWorks() {
  return (
    <>
      <PageHero eyebrow="How it works" title={<>From search to steering wheel in <span className="text-lime">minutes</span>.</>} body="No paperwork queues, no hidden charges, no awkward haggling. Here's exactly what happens when you rent with MyDrivez." />
      <section className="py-20 lg:py-28">
        <div className="container max-w-4xl">
          <ol className="relative space-y-6 before:absolute before:bottom-6 before:left-7 before:top-6 before:w-px before:bg-line">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.04}>
                <li className="relative flex gap-6">
                  <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-lime shadow-[0_0_0_6px_#F7F8FA]">
                    <s.icon className="h-6 w-6" />
                  </span>
                  <div className="card flex-1 p-6">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">Step {i + 1}</p>
                    <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{s.title}</h2>
                    <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>
      <section className="bg-white py-20 lg:py-28">
        <div className="container grid gap-12 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <SectionHeading eyebrow="Good to know" title="Every rental includes" />
            <ul className="mt-8 space-y-3 text-[15px] text-graphite">
              {["Comprehensive insurance", "24/7 roadside assistance", "Sanitised, inspected car", "Generous km allowance", "Free cancellation up to 24h"].map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-lime-600" /> {x}
                </li>
              ))}
            </ul>
            <LinkButton href="/cars" className="mt-10" size="lg">
              Find your car
            </LinkButton>
          </div>
          <Faq />
        </div>
      </section>
    </>
  );
}
