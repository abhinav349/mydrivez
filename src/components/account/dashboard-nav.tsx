"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Bell,
  CalendarCheck,
  CarFront,
  FileCheck2,
  Gift,
  Heart,
  History,
  KeyRound,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  ReceiptText,
  Sparkles,
  TicketPercent,
  User,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/cars", label: "Browse Cars", icon: CarFront },
  { href: "/dashboard/bookings", label: "My Bookings", icon: CalendarCheck, tab: null },
  { href: "/dashboard/bookings?tab=active", label: "Active Rentals", icon: KeyRound, tab: "active" },
  { href: "/dashboard/bookings?tab=history", label: "Booking History", icon: History, tab: "history" },
  { href: "/dashboard/documents", label: "My Documents", icon: FileCheck2 },
  { href: "/dashboard/payments", label: "Payments & Invoices", icon: ReceiptText },
  { href: "/dashboard/wishlist", label: "Wishlist", icon: Heart },
  { href: "/dashboard/offers", label: "Offers & Coupons", icon: TicketPercent },
  { href: "/dashboard/rewards", label: "Rewards & Referrals", icon: Gift },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell, badge: true },
  { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
  { href: "/dashboard/profile", label: "My Profile", icon: User },
] as const;

function useActive() {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  return (it: (typeof items)[number]) => {
    const base = it.href.split("?")[0]!;
    if ("exact" in it && it.exact) return pathname === base;
    if ("tab" in it) return pathname === base && (it.tab === null ? !tab || !["active", "history"].includes(tab) : tab === it.tab);
    return pathname.startsWith(base);
  };
}

export function DashboardSidebar({ unread }: { unread: number }) {
  const isActive = useActive();
  return (
    <nav className="space-y-0.5" aria-label="Account">
      {items.map((it) => {
        const active = isActive(it);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors",
              active ? "bg-ink text-white" : "text-graphite/80 hover:bg-white hover:text-ink",
            )}
          >
            <it.icon className={cn("h-[18px] w-[18px]", active ? "text-lime" : "text-muted group-hover:text-ink")} />
            {it.label}
            {"badge" in it && unread > 0 && <span className="ml-auto rounded-full bg-danger px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-white">{unread}</span>}
          </Link>
        );
      })}
      <form action={logoutAction} className="pt-3">
        <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-danger hover:bg-danger-soft">
          <LogOut className="h-[18px] w-[18px]" /> Logout
        </button>
      </form>
    </nav>
  );
}

const mobile = [
  { href: "/dashboard", label: "Home", icon: LayoutGrid, exact: true },
  { href: "/cars", label: "Explore", icon: Sparkles },
  { href: "/dashboard/bookings", label: "Trips", icon: CalendarCheck },
  { href: "/dashboard/notifications", label: "Alerts", icon: Bell },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

export function DashboardBottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Primary">
      <ul className="grid grid-cols-5">
        {mobile.map((m) => {
          const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
          return (
            <li key={m.href}>
              <Link href={m.href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-ink" : "text-muted")}>
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", active && "bg-lime")}>
                  <m.icon className="h-[18px] w-[18px]" />
                </span>
                {m.label}
                {m.href.endsWith("notifications") && unread > 0 && <span className="absolute right-[30%] top-2 h-2 w-2 rounded-full bg-danger" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
