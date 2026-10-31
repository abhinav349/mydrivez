import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, MessageSquarePlus, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { BRAND, TICKET_PRIORITY, TICKET_STATUS } from "@/lib/constants";
import { relativeTime, titleCase } from "@/lib/utils";
import { EmptyState, StatusBadge } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { Faq } from "@/components/site/faq";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await requireCustomerPage();
  const tickets = await db.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { messages: true } }, messages: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Support</h1>
          <p className="mt-1 text-[14px] text-muted">We&apos;re here 24/7. Average first response: under 30 minutes.</p>
        </div>
        <LinkButton href="/dashboard/support/new">
          <MessageSquarePlus className="h-4 w-4" /> New ticket
        </LinkButton>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card flex items-center gap-4 p-5">
          <Phone className="h-5 w-5 text-ink" />
          <div>
            <p className="text-[12px] text-muted">24/7 roadside & booking helpline</p>
            <p className="font-semibold text-ink">{BRAND.phone}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5">
          <Mail className="h-5 w-5 text-ink" />
          <div>
            <p className="text-[12px] text-muted">Email</p>
            <p className="font-semibold text-ink">{BRAND.supportEmail}</p>
          </div>
        </div>
      </div>
      <section>
        <h2 className="mb-4 text-lg font-semibold">Your tickets</h2>
        {tickets.length ? (
          <ul className="card divide-y divide-line overflow-hidden">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/dashboard/support/${t.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-paper sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{t.subject}</p>
                    <p className="text-[12.5px] text-muted">
                      <span className="font-mono">{t.code}</span> · {titleCase(t.category)} · {t._count.messages} messages · updated {relativeTime(t.updatedAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge map={TICKET_PRIORITY} value={t.priority} />
                    <StatusBadge map={TICKET_STATUS} value={t.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={LifeBuoy} title="No tickets yet" body="If something's not right, open a ticket and we'll jump on it." />
        )}
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold">Frequently asked</h2>
        <Faq />
      </section>
    </div>
  );
}
