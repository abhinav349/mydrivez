import Link from "next/link";
import { Bell, ExternalLink, LogOut, Search } from "lucide-react";
import { requireStaffPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logoutAction } from "@/app/actions/auth";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/admin-nav";
import { Avatar } from "@/components/ui/misc";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  const [verifications, review, tickets, unread, profile] = await Promise.all([
    db.customerDocument.count({ where: { status: "PENDING" } }),
    db.booking.count({ where: { status: { in: ["PAYMENT_COMPLETED", "PENDING"] } } }),
    db.supportTicket.count({ where: { status: { in: ["OPEN"] } } }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    db.adminProfile.findUnique({ where: { userId: user.id } }),
  ]);
  const badges = { verifications, review, tickets, unread };

  return (
    <div className="min-h-screen bg-[#F3F4F6]">
      <AdminSidebar role={user.role} badges={badges} user={{ name: user.name, title: profile?.title ?? (user.role === "ADMIN" ? "Administrator" : "Staff") }} />
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-xl lg:px-8">
          <AdminMobileNav role={user.role} badges={badges} />
          <form action="/admin/bookings" className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              name="q"
              placeholder="Search booking ID, customer, registration…"
              className="h-10 w-full rounded-xl border border-line bg-paper pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-ink/30 focus:bg-white"
              aria-label="Search bookings"
            />
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted hover:bg-paper hover:text-ink sm:flex">
              <ExternalLink className="h-4 w-4" /> View site
            </Link>
            <Link href="/admin/notifications" className="relative rounded-lg p-2.5 text-ink hover:bg-paper" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
            <Avatar name={user.name} src={user.avatarUrl} size={34} className="ml-1" />
            <form action={logoutAction}>
              <button className="rounded-lg p-2.5 text-muted hover:bg-paper hover:text-danger" aria-label="Log out">
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </form>
          </div>
        </header>
        <main className="px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
