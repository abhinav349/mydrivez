import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { Logo } from "@/components/ui/misc";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <Image src="/photos/night.jpg" alt="" fill priority sizes="50vw" className="object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/30" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Link href="/" aria-label="MyDrivez home">
            <Logo dark />
          </Link>
          <div className="max-w-md">
            <p className="font-display text-[44px] font-semibold leading-[1.02] tracking-tightest text-white">
              Keys to <span className="text-lime">anywhere</span>, in minutes.
            </p>
            <figure className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-lime text-lime" />
                ))}
              </div>
              <blockquote className="mt-3 text-[15px] leading-relaxed text-white/80">
                “Booked a Thar for a Coorg weekend in under three minutes. The car was spotless and pickup took five.”
              </blockquote>
              <figcaption className="mt-4 text-[13px] text-white/50">Rohan K. · Bengaluru</figcaption>
            </figure>
          </div>
        </div>
      </div>
      <div className="flex flex-col bg-white">
        <div className="flex items-center justify-between p-6 lg:hidden">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-[420px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
