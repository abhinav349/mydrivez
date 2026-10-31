"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarCheck, CreditCard, FileCheck2, Gift, LifeBuoy, ShieldAlert, Wrench } from "lucide-react";
import { markNotificationsReadAction } from "@/app/actions/customer";
import { Button } from "@/components/ui/button";
import { cn, relativeTime } from "@/lib/utils";

type N = { id: string; type: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

function iconFor(type: string) {
  if (type.includes("BOOKING") || type.includes("PICKUP") || type.includes("RETURN") || type.includes("TRIP")) return CalendarCheck;
  if (type.includes("PAYMENT") || type.includes("REFUND")) return CreditCard;
  if (type.includes("DOCUMENT")) return FileCheck2;
  if (type.includes("OFFER") || type.includes("REFERRAL")) return Gift;
  if (type.includes("SUPPORT") || type.includes("TICKET") || type === "CONTACT") return LifeBuoy;
  if (type.includes("SECURITY")) return ShieldAlert;
  if (type.includes("MAINTENANCE") || type.includes("VEHICLE")) return Wrench;
  return Bell;
}

export function NotificationList({ items }: { items: N[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[13.5px] text-muted">{unread ? `${unread} unread` : "You're all caught up"}</p>
        {unread > 0 && (
          <Button variant="secondary" size="sm" loading={pending} onClick={() => start(async () => { await markNotificationsReadAction(); router.refresh(); })}>
            Mark all as read
          </Button>
        )}
      </div>
      <ul className="card divide-y divide-line overflow-hidden">
        {items.map((n) => {
          const Icon = iconFor(n.type);
          const inner = (
            <div className={cn("flex gap-4 px-5 py-4 transition-colors hover:bg-paper", !n.readAt && "bg-lime-50/60")}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", n.readAt ? "bg-paper text-muted" : "bg-ink text-lime")}>
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={cn("text-[14px] text-ink", !n.readAt && "font-semibold")}>{n.title}</p>
                  <span className="shrink-0 text-[12px] text-muted">{relativeTime(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-[13.5px] text-muted">{n.body}</p>
              </div>
            </div>
          );
          return (
            <li key={n.id} onClick={() => !n.readAt && markNotificationsReadAction([n.id])}>
              {n.link ? <Link href={n.link}>{inner}</Link> : inner}
            </li>
          );
        })}
        {!items.length && <li className="px-5 py-10 text-center text-[14px] text-muted">No notifications yet.</li>}
      </ul>
    </div>
  );
}
