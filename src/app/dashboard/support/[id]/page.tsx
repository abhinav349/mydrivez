import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { TICKET_PRIORITY, TICKET_STATUS } from "@/lib/constants";
import { titleCase } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/misc";
import { Thread } from "@/components/support/thread";
import { ReplyForm } from "@/components/support/forms";

export const metadata: Metadata = { title: "Support ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCustomerPage();
  const t = await db.supportTicket.findFirst({
    where: { id, userId: user.id },
    include: { booking: true, messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { name: true, avatarUrl: true } } } } },
  });
  if (!t) notFound();
  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/support" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Support
      </Link>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em]">{t.subject}</h1>
          <p className="mt-1 text-[13px] text-muted">
            <span className="font-mono">{t.code}</span> · {titleCase(t.category)}
            {t.booking && (
              <>
                {" "}
                ·{" "}
                <Link href={`/dashboard/bookings/${t.booking.id}`} className="font-medium text-ink underline">
                  {t.booking.code}
                </Link>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge map={TICKET_PRIORITY} value={t.priority} />
          <StatusBadge map={TICKET_STATUS} value={t.status} />
        </div>
      </div>
      <div className="mt-8">
        <Thread messages={t.messages} viewer="customer" />
      </div>
      <div className="mt-8">{t.status === "CLOSED" ? <p className="text-[14px] text-muted">This ticket is closed.</p> : <ReplyForm ticketId={t.id} />}</div>
    </div>
  );
}
