import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/constants";

// Template legal copy for the demo. Have counsel review before launch.
const DOCS: Record<string, { title: string; sections: [string, string][] }> = {
  terms: {
    title: "Terms of service",
    sections: [
      ["Eligibility", "You must be at least 21 years old and hold a valid Indian driving licence (or an International Driving Permit) held for a minimum of one year."],
      ["Bookings", "A booking is confirmed only after payment is verified with our payment partner and, where required, your documents are verified. Prices shown at checkout are final for that booking."],
      ["Use of vehicle", "Vehicles may not be used for commercial hire, racing, towing, or off-road use (except 4×4 vehicles on reasonable trails). Smoking is prohibited inside vehicles."],
      ["Liability", "You are responsible for traffic violations, tolls and fines incurred during your rental. Damage liability is capped as described in the rental agreement, subject to fair use."],
      ["Account", `We may suspend accounts for fraud, abuse or repeated policy violations. Contact ${BRAND.supportEmail} for any account concerns.`],
    ],
  },
  privacy: {
    title: "Privacy policy",
    sections: [
      ["What we collect", "Name, contact details, driving licence and ID documents, booking and payment metadata, and vehicle telematics during trips."],
      ["How we use it", "To verify identity, process bookings and payments, provide support, prevent fraud and meet legal obligations. We never sell personal data."],
      ["Documents", "Identity documents are stored privately and are only accessible to you and authorised verification staff."],
      ["Payments", "Card and UPI details are handled by our PCI-DSS compliant payment partner. We never see or store full card numbers."],
      ["Your rights", `You may request access, correction or deletion of your data by writing to ${BRAND.supportEmail}.`],
    ],
  },
  cancellation: {
    title: "Cancellation & refund policy",
    sections: [
      ["24+ hours before pickup", "Full refund of the rental amount and security deposit."],
      ["6–24 hours before pickup", "50% of the rental amount is refunded, plus the full security deposit."],
      ["Within 6 hours / no-show", "The rental amount is non-refundable; the security deposit is refunded in full."],
      ["Refund timelines", "Refunds are initiated immediately to the original payment method and typically reflect within 5–7 business days."],
      ["Cancellations by MyDrivez", "If we cancel your booking for any reason, you receive a full refund and priority rebooking."],
    ],
  },
  "rental-agreement": {
    title: "Rental agreement",
    sections: [
      ["Handover", "The vehicle's condition, odometer and fuel level are recorded with photos at pickup and confirmed by you."],
      ["Fuel", "Same-to-same fuel policy. Shortfall is charged per percentage point at the rate shown in your booking."],
      ["Kilometres", "Your booking includes a kilometre allowance. Additional kilometres are charged at the per-km rate shown at checkout."],
      ["Late returns", "A 30-minute grace period applies. After that, each started hour is charged at 1.5× the hourly rate."],
      ["Damage", "New damage is assessed at return against the pickup inspection. Charges are deducted from the security deposit with an itemised breakdown."],
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: DOCS[slug]?.title ?? "Legal" };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = DOCS[slug];
  if (!doc) notFound();
  return (
    <div className="container max-w-3xl pb-24 pt-32">
      <p className="eyebrow">Legal</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.035em]">{doc.title}</h1>
      <p className="mt-2 text-[13px] text-muted">Last updated 1 November 2026</p>
      <div className="mt-10 space-y-8">
        {doc.sections.map(([h, b]) => (
          <section key={h}>
            <h2 className="text-lg font-semibold">{h}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-graphite/85">{b}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
