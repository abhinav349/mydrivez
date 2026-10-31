import Link from "next/link";
import { Instagram, Linkedin, Mail, MapPin, Phone, Twitter, Youtube } from "lucide-react";
import { Logo } from "@/components/ui/misc";
import { BRAND } from "@/lib/constants";
import { NewsletterForm } from "./newsletter-form";

const cols = [
  {
    title: "Explore",
    links: [
      ["All cars", "/cars"],
      ["SUVs", "/cars?category=SUV"],
      ["Luxury", "/cars?category=LUXURY"],
      ["Electric", "/cars?category=ELECTRIC"],
      ["Offers", "/offers"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About us", "/about"],
      ["How it works", "/how-it-works"],
      ["Contact", "/contact"],
      ["FAQ", "/#faq"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Terms of service", "/legal/terms"],
      ["Privacy policy", "/legal/privacy"],
      ["Cancellation policy", "/legal/cancellation"],
      ["Rental agreement", "/legal/rental-agreement"],
    ],
  },
];

export function Footer() {
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute -right-40 -top-40 h-[480px] w-[480px] rounded-full bg-lime/10 blur-[120px]" />
      <div className="container relative py-16 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_2fr]">
          <div>
            <Logo dark />
            <p className="mt-5 max-w-sm text-[14.5px] leading-relaxed text-white/55">
              Premium self-drive rentals with verified cars, transparent pricing and support that actually picks up — any hour, every city.
            </p>
            <div className="mt-8">
              <p className="mb-3 text-sm font-semibold">Get drive-worthy deals in your inbox</p>
              <NewsletterForm />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4">
            {cols.map((c) => (
              <div key={c.title}>
                <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/40">{c.title}</p>
                <ul className="space-y-2.5">
                  {c.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href!} className="text-[14px] text-white/70 transition-colors hover:text-lime">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-1">
              <p className="mb-4 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/40">Reach us</p>
              <ul className="space-y-3 text-[14px] text-white/70">
                <li className="flex gap-2.5">
                  <Phone className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
                  {BRAND.phone}
                </li>
                <li className="flex gap-2.5">
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
                  {BRAND.email}
                </li>
                <li className="flex gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
                  <span>{BRAND.address}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
          <p className="text-[13px] text-white/40">© {new Date().getFullYear()} MyDrivez Mobility Pvt. Ltd. All rights reserved.</p>
          <div className="flex gap-2">
            {[Instagram, Twitter, Linkedin, Youtube].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="Social link"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-lime hover:text-lime"
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
      <div aria-hidden className="pointer-events-none select-none overflow-hidden">
        <p className="-mb-[0.18em] whitespace-nowrap text-center font-display text-[22vw] font-extrabold leading-none tracking-[-0.06em] text-white/[.035]">MYDRIVEZ</p>
      </div>
    </footer>
  );
}
