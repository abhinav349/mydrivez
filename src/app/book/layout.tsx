import Link from "next/link";
import { Lock } from "lucide-react";
import { Logo } from "@/components/ui/misc";

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <Logo />
          </Link>
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <Lock className="h-3.5 w-3.5" /> Secure checkout
          </span>
        </div>
      </header>
      {children}
    </div>
  );
}
