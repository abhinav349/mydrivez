import Link from "next/link";
import { Logo } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center">
      <Logo dark />
      <p className="mt-12 font-display text-[120px] font-bold leading-none tracking-tightest text-white/10 sm:text-[180px]">404</p>
      <h1 className="-mt-6 text-3xl font-semibold tracking-[-0.03em] text-white">Wrong turn.</h1>
      <p className="mt-3 max-w-sm text-[15px] text-white/60">The page you&apos;re looking for has driven off. Let&apos;s get you back on the road.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className={buttonClass("accent", "lg")}>
          Go home
        </Link>
        <Link href="/cars" className={buttonClass("dark-outline", "lg")}>
          Explore cars
        </Link>
      </div>
    </div>
  );
}
