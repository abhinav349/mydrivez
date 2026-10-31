import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { NotificationList } from "@/components/account/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireCustomerPage();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Notifications</h1>
      <NotificationList items={items.map((n) => ({ ...n, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))} />
    </div>
  );
}
