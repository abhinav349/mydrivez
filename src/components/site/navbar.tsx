"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, CalendarCheck, ChevronDown, Heart, LayoutDashboard, LogOut, Menu, User, X } from "lucide-react";
import { Avatar, Logo } from "@/components/ui/misc";
import { LinkButton, buttonClass } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/cars", label: "Explore Cars" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
];

/** Pages that open with a full-bleed dark hero, where the bar starts transparent. */
const DARK_HERO_ROUTES = ["/", "/about", "/how-it-works", "/contact", "/offers"];

type NavUser ={ name: string; role: string; avatarUrl: string | null; unread: number } | null;

export function Navbar({ user, transparent = false }: { user: NavUser; transparent?: boolean }) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
    setMenu(false);
  }, [pathname]);

  const overHero = transparent && DARK_HERO_ROUTES.includes(pathname);
  const dark = overHero && !scrolled && !open;
  const dashHref = user?.role === "CUSTOMER" ? "/dashboard" : "/admin";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        dark ? "bg-transparent" : "border-b border-line/80 bg-white/80 backdrop-blur-xl backdrop-saturate-150",
      )}
    >
      <nav className="container flex h-[68px] items-center justify-between gap-6">
        <Link href="/" aria-label="MyDrivez home">
          <Logo dark={dark} />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={cn(
                    "relative rounded-lg px-3.5 py-2 text-[14px] font-medium transition-colors",
                    dark ? "text-white/75 hover:text-white" : "text-graphite/75 hover:text-ink",
                    active && (dark ? "text-white" : "text-ink"),
                  )}
                >
                  {l.label}
                  {active && <motion.span layoutId="nav-dot" className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lime" />}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="relative">
              <button
                onClick={() => setMenu((m) => !m)}
                className={cn(
                  "flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors",
                  dark ? "hover:bg-white/10" : "hover:bg-ink/[.05]",
                )}
                aria-expanded={menu}
                aria-haspopup="menu"
              >
                <span className="relative">
                  <Avatar name={user.name} src={user.avatarUrl} size={34} />
                  {user.unread > 0 && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-danger" />}
                </span>
                <span className={cn("hidden text-sm font-medium sm:block", dark ? "text-white" : "text-ink")}>{user.name.split(" ")[0]}</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", menu && "rotate-180", dark ? "text-white/70" : "text-muted")} />
              </button>
              <AnimatePresence>
                {menu && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 mt-2 w-60 origin-top-right rounded-2xl border border-line bg-white p-1.5 shadow-lift"
                    role="menu"
                  >
                    <MenuLink href={dashHref} icon={LayoutDashboard}>
                      Dashboard
                    </MenuLink>
                    {user.role === "CUSTOMER" && (
                      <>
                        <MenuLink href="/dashboard/bookings" icon={CalendarCheck}>
                          My bookings
                        </MenuLink>
                        <MenuLink href="/dashboard/wishlist" icon={Heart}>
                          Wishlist
                        </MenuLink>
                        <MenuLink href="/dashboard/notifications" icon={Bell}>
                          Notifications {user.unread > 0 && <span className="ml-auto rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{user.unread}</span>}
                        </MenuLink>
                        <MenuLink href="/dashboard/profile" icon={User}>
                          Profile
                        </MenuLink>
                      </>
                    )}
                    <form action={logoutAction} className="mt-1 border-t border-line pt-1">
                      <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft">
                        <LogOut className="h-4 w-4" /> Log out
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="hidden items-center gap-1.5 sm:flex">
              <LinkButton href="/login" variant={dark ? "dark-ghost" : "ghost"} size="sm">
                Login
              </LinkButton>
              <LinkButton href="/register" variant={dark ? "accent" : "primary"} size="sm">
                Sign up
              </LinkButton>
            </div>
          )}
          <button
            className={cn("rounded-xl p-2 lg:hidden", dark ? "text-white hover:bg-white/10" : "text-ink hover:bg-ink/[.05]")}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-line bg-white lg:hidden"
          >
            <div className="container flex flex-col gap-1 py-4">
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-xl px-3 py-3 text-[15px] font-medium text-ink hover:bg-paper">
                  {l.label}
                </Link>
              ))}
              {!user && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Link href="/login" className={buttonClass("secondary", "md")}>
                    Login
                  </Link>
                  <Link href="/register" className={buttonClass("primary", "md")}>
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function MenuLink({ href, icon: Icon, children }: { href: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Link href={href} role="menuitem" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-ink hover:bg-paper">
      <Icon className="h-4 w-4 text-muted" />
      {children}
    </Link>
  );
}
