import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { NotificationList } from "@/components/account/notification-list";

export const metadata: Metadata = { title: "Notifications" };

export default async function AdminNotifications() {
  const user = await requireStaffPage();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" description="New bookings, payments, document uploads, cancellations, returns and maintenance alerts." />
      <NotificationList items={items.map((n) => ({ ...n, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))} />
    </div>
  );
}
