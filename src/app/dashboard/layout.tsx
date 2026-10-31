import { Suspense } from "react";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { requireCustomerPage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Avatar, Logo } from "@/components/ui/misc";
import { DashboardBottomNav, DashboardSidebar } from "@/components/account/dashboard-nav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCustomerPage();
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-4 lg:px-8">
          <Link href="/" aria-label="MyDrivez home">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/cars" className="hidden items-center gap-2 rounded-xl border border-line bg-paper px-3.5 py-2 text-[13px] text-muted transition-colors hover:border-ink/20 md:flex">
              <Search className="h-4 w-4" /> Find your next car…
            </Link>
            <Link href="/dashboard/notifications" className="relative rounded-xl p-2.5 text-ink hover:bg-paper" aria-label={`Notifications (${unread} unread)`}>
              <Bell className="h-5 w-5" />
              {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{unread}</span>}
            </Link>
            <Link href="/dashboard/profile" className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-3 hover:bg-paper">
              <Avatar name={user.name} src={user.avatarUrl} size={34} />
              <span className="hidden text-[13.5px] font-semibold text-ink sm:block">{user.name.split(" ")[0]}</span>
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 pb-28 pt-6 lg:grid-cols-[250px_1fr] lg:px-8 lg:pb-16 lg:pt-8">
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <Suspense>
              <DashboardSidebar unread={unread} />
            </Suspense>
          </div>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
      <DashboardBottomNav unread={unread} />
    </div>
  );
}
