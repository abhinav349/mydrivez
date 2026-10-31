import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { TICKET_PRIORITY, TICKET_STATUS } from "@/lib/constants";
import { formatDateTime, relativeTime, titleCase } from "@/lib/utils";
import { PageHeader, Panel, Segmented, tableCls, td, th, theadCls } from "@/components/admin/ui";
import { Badge, StatusBadge } from "@/components/ui/misc";
import { HandledButton } from "@/components/admin/ticket-controls";

export const metadata: Metadata = { title: "Support" };

export default async function AdminSupport({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const me = await requireStaffPage("support:write");
  const tab = sp.tab === "enquiries" ? "enquiries" : "tickets";
  const filter = sp.filter ?? "open";
  const where: Prisma.SupportTicketWhereInput =
    filter === "open" ? { status: { in: ["OPEN", "IN_PROGRESS", "AWAITING_CUSTOMER"] } } : filter === "mine" ? { assignedToId: me.id, status: { notIn: ["CLOSED"] } } : {};
  const [tickets, enquiries] = await Promise.all([
    db.supportTicket.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      take: 100,
      include: { user: { select: { name: true } }, assignedTo: { select: { name: true } }, _count: { select: { messages: true } } },
    }),
    db.contactMessage.findMany({ orderBy: [{ handled: "asc" }, { createdAt: "desc" }], take: 50 }),
  ]);
  const priorityRank = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  tickets.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]);

  return (
    <div>
      <PageHeader
        title="Support"
        description="Customer tickets and website enquiries."
        actions={<Segmented basePath="/admin/support" param="tab" value={tab} params={{}} options={[{ value: "tickets", label: "Tickets" }, { value: "enquiries", label: `Enquiries (${enquiries.filter((e) => !e.handled).length})` }]} />}
      />
      {tab === "tickets" ? (
        <Panel
          title="Tickets"
          action={<Segmented basePath="/admin/support" param="filter" value={filter} params={{ tab }} options={[{ value: "open", label: "Open" }, { value: "mine", label: "Assigned to me" }, { value: "all", label: "All" }]} />}
        >
          <div className="overflow-x-auto">
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr>
                  <th className={th}>Ticket</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Category</th>
                  <th className={th}>Priority</th>
                  <th className={th}>Status</th>
                  <th className={th}>Assignee</th>
                  <th className={th}>Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-paper/60">
                    <td className={td}>
                      <Link href={`/admin/support/${t.id}`} className="font-semibold text-ink hover:underline">
                        {t.subject}
                      </Link>
                      <p className="font-mono text-[11.5px] text-muted">
                        {t.code} · {t._count.messages} msgs
                      </p>
                    </td>
                    <td className={td}>{t.user.name}</td>
                    <td className={td}>{titleCase(t.category)}</td>
                    <td className={td}>
                      <StatusBadge map={TICKET_PRIORITY} value={t.priority} />
                    </td>
                    <td className={td}>
                      <StatusBadge map={TICKET_STATUS} value={t.status} />
                    </td>
                    <td className={td}>{t.assignedTo?.name ?? <span className="text-muted">—</span>}</td>
                    <td className={`${td} text-muted`}>{relativeTime(t.updatedAt)}</td>
                  </tr>
                ))}
                {!tickets.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted">
                      No tickets here. 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Panel title="Website enquiries">
          <ul className="divide-y divide-line">
            {enquiries.map((e) => (
              <li key={e.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 text-[13.5px]">
                  <p className="font-semibold text-ink">
                    {e.subject} {e.handled && <Badge tone="success">Handled</Badge>}
                  </p>
                  <p className="text-[12.5px] text-muted">
                    {e.name} · {e.email} {e.phone && `· ${e.phone}`} · {formatDateTime(e.createdAt)}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-graphite">{e.message}</p>
                </div>
                {!e.handled && <HandledButton id={e.id} />}
              </li>
            ))}
            {!enquiries.length && <li className="px-5 py-10 text-center text-muted">No enquiries yet.</li>}
          </ul>
        </Panel>
      )}
    </div>
  );
}
