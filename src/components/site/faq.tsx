"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const FAQS = [
  {
    q: "What documents do I need to rent a car?",
    a: "A valid Indian driving licence (held for at least 1 year) and a government-issued photo ID such as Aadhaar or passport. Upload both once in your dashboard; we verify them within a few hours and you're set for every future trip.",
  },
  {
    q: "Is fuel included in the price?",
    a: "No — rentals follow a same-to-same fuel policy. You receive the car with a recorded fuel level and return it at the same level. Any shortfall is charged at a transparent per-percent rate shown at checkout. EVs are handed over with at least 80% charge.",
  },
  {
    q: "How does the security deposit work?",
    a: "A refundable deposit is collected with your booking. After you return the car, we deduct only documented extra charges (excess kilometres, late return, fuel or damage) and refund the rest to your original payment method within 5–7 business days.",
  },
  {
    q: "Can I cancel or change my booking?",
    a: "Cancel 24+ hours before pickup for a full refund, 6–24 hours for 50% of the rental (deposit always refunded). Cancellations are self-serve from My Bookings and refunds are initiated instantly.",
  },
  {
    q: "What if I return the car late?",
    a: "There's a 30-minute grace period. After that, late returns are charged hourly at 1.5× the car's hourly rate. If you're running late, extend from the app or call support so the next guest can be informed.",
  },
  {
    q: "Is there a kilometre limit?",
    a: "Each car includes a generous daily kilometre allowance (shown on the car page). Kilometres beyond the allowance are billed at the per-km rate listed before you pay — no surprises.",
  },
  {
    q: "Do you deliver the car to my doorstep?",
    a: "Yes. Choose doorstep delivery at checkout and our team will deliver and collect the car within city limits for a flat fee.",
  },
];

export function Faq({ items = FAQS }: { items?: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line rounded-3xl border border-line bg-white">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-6 px-6 py-5 text-left sm:px-8"
              aria-expanded={isOpen}
            >
              <span className="text-[15.5px] font-semibold text-ink">{f.q}</span>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line transition-all duration-300", isOpen && "rotate-45 border-ink bg-ink text-lime")}>
                <Plus className="h-4 w-4" />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden">
                  <p className="px-6 pb-6 pr-16 text-[14.5px] leading-relaxed text-muted sm:px-8">{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
