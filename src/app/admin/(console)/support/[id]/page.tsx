import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { staffReplyAction } from "@/app/actions/admin-misc";
import { formatDateTime, titleCase } from "@/lib/utils";
import { Panel } from "@/components/admin/ui";
import { Thread } from "@/components/support/thread";
import { ReplyForm } from "@/components/support/forms";
import { TicketControls } from "@/components/admin/ticket-controls";

export const metadata: Metadata = { title: "Ticket" };

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireStaffPage("support:write");
  const [t, staff] = await Promise.all([
    db.supportTicket.findUnique({
      where: { id },
      include: { user: true, booking: true, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, avatarUrl: true } } } } },
    }),
    db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] }, status: "ACTIVE" }, select: { id: true, name: true } }),
  ]);
  if (!t) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin/support" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Support
      </Link>
      <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">{t.subject}</h1>
          <p className="mt-1 text-[13px] text-muted">
            <span className="font-mono">{t.code}</span> · {titleCase(t.category)} · opened {formatDateTime(t.createdAt)}
          </p>
          <div className="mt-8">
            <Thread messages={t.messages} viewer="staff" />
          </div>
          <div className="mt-8">
            <ReplyForm ticketId={t.id} action={staffReplyAction} />
            <p className="mt-2 text-[12px] text-muted">Replying sets the ticket to “Awaiting customer” and emails the customer.</p>
          </div>
        </div>
        <div className="space-y-4">
          <Panel title="Manage">
            <div className="p-5">
              <TicketControls id={t.id} status={t.status} priority={t.priority} assignedToId={t.assignedToId} staff={staff} />
            </div>
          </Panel>
          <Panel title="Customer">
            <div className="space-y-1 p-5 text-[13.5px]">
              <Link href={`/admin/customers/${t.userId}`} className="font-semibold text-ink hover:underline">
                {t.user.name}
              </Link>
              <p className="text-muted">{t.user.email}</p>
              <p className="text-muted">{t.user.phone}</p>
              {t.booking && (
                <Link href={`/admin/bookings/${t.booking.id}`} className="mt-2 inline-block font-mono text-[12.5px] font-semibold underline">
                  {t.booking.code}
                </Link>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
