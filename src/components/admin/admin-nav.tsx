"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  CalendarRange,
  Car,
  FileCheck2,
  Gauge,
  History,
  KeyRound,
  LifeBuoy,
  Menu,
  Settings,
  Star,
  Tags,
  TicketPercent,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: React.ElementType; perm?: string; adminOnly?: boolean; badgeKey?: "verifications" | "review" | "tickets" | "unread" };

const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Overview", items: [
    { href: "/admin", label: "Dashboard", icon: Gauge },
    { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  ] },
  { title: "Operations", items: [
    { href: "/admin/bookings", label: "Bookings", icon: CalendarRange, badgeKey: "review" },
    { href: "/admin/handovers", label: "Handovers", icon: KeyRound },
    { href: "/admin/fleet", label: "Fleet", icon: Car },
    { href: "/admin/maintenance", label: "Maintenance", icon: Wrench },
  ] },
  { title: "Customers", items: [
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/verifications", label: "Verifications", icon: FileCheck2, badgeKey: "verifications" },
    { href: "/admin/reviews", label: "Reviews", icon: Star },
    { href: "/admin/support", label: "Support", icon: LifeBuoy, badgeKey: "tickets" },
  ] },
  { title: "Revenue", items: [
    { href: "/admin/pricing", label: "Pricing rules", icon: Tags },
    { href: "/admin/coupons", label: "Coupons", icon: TicketPercent },
  ] },
  { title: "System", items: [
    { href: "/admin/notifications", label: "Notifications", icon: Bell, badgeKey: "unread" },
    { href: "/admin/staff", label: "Staff & roles", icon: UserCog, adminOnly: true },
    { href: "/admin/activity", label: "Activity log", icon: History, adminOnly: true },
    { href: "/admin/settings", label: "Settings", icon: Settings, adminOnly: true },
  ] },
];

export type AdminBadges = { verifications: number; review: number; tickets: number; unread: number };

function NavBody({ role, badges, onNav }: { role: string; badges: AdminBadges; onNav?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5 scrollbar-none" aria-label="Admin">
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => !i.adminOnly || role === "ADMIN");
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/30">{g.title}</p>
            <ul className="space-y-0.5">
              {items.map((it) => {
                const active = it.href === "/admin" ? pathname === "/admin" : pathname.startsWith(it.href);
                const badge = it.badgeKey ? badges[it.badgeKey] : 0;
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={onNav}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors",
                        active ? "bg-white/[.08] text-white" : "text-white/55 hover:bg-white/[.04] hover:text-white",
                      )}
                    >
                      {active && <motion.span layoutId="admin-active" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-lime" />}
                      <it.icon className={cn("h-[17px] w-[17px]", active ? "text-lime" : "text-white/40 group-hover:text-white/80")} />
                      {it.label}
                      {badge > 0 && <span className="ml-auto rounded-md bg-lime px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-ink">{badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AdminSidebar({ role, badges, user }: { role: string; badges: AdminBadges; user: { name: string; title: string } }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/5 bg-ink lg:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <Link href="/admin">
          <Logo dark />
        </Link>
        <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/60">Admin</span>
      </div>
      <NavBody role={role} badges={badges} />
      <div className="border-t border-white/5 p-4">
        <p className="truncate text-[13px] font-semibold text-white">{user.name}</p>
        <p className="truncate text-[12px] text-white/40">{user.title}</p>
      </div>
    </aside>
  );
}

export function AdminMobileNav({ role, badges }: { role: string; badges: AdminBadges }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink hover:bg-paper lg:hidden" aria-label="Open navigation">
        <Menu className="h-5 w-5" />
      </button>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70] lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ type: "spring", damping: 32, stiffness: 340 }} className="absolute inset-y-0 left-0 flex w-[270px] flex-col bg-ink">
              <div className="flex h-16 items-center justify-between px-5">
                <Logo dark />
                <button onClick={() => setOpen(false)} className="text-white/60" aria-label="Close navigation">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavBody role={role} badges={badges} onNav={() => setOpen(false)} />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
