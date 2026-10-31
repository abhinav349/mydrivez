import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/utils";
import { PageHeader, Pagination, Panel, tableCls, td, th, theadCls } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Activity log" };
const PAGE = 30;

const LINK: Record<string, (id: string) => string> = {
  Booking: (id) => `/admin/bookings/${id}`,
  Vehicle: (id) => `/admin/fleet/${id}`,
  User: (id) => `/admin/customers/${id}`,
  SupportTicket: (id) => `/admin/support/${id}`,
};

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string; entity?: string }> }) {
  const sp = await searchParams;
  const me = await requireStaffPage();
  if (me.role !== "ADMIN") redirect("/admin?denied=1");
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.entity ? { entityType: sp.entity } : {};
  const [rows, total, types] = await Promise.all([
    db.adminActivityLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE, take: PAGE, include: { actor: { select: { name: true, role: true } } } }),
    db.adminActivityLog.count({ where }),
    db.adminActivityLog.groupBy({ by: ["entityType"], _count: true }),
  ]);
  return (
    <div>
      <PageHeader title="Activity log" description="Immutable audit trail of every important admin and staff action." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/admin/activity" className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${!sp.entity ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"}`}>
          All
        </Link>
        {types.map((t) => (
          <Link key={t.entityType} href={`/admin/activity?entity=${t.entityType}`} className={`rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${sp.entity === t.entityType ? "border-ink bg-ink text-white" : "border-line bg-white text-muted"}`}>
            {t.entityType} {t._count}
          </Link>
        ))}
      </div>
      <Panel>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>When</th>
                <th className={th}>Who</th>
                <th className={th}>Action</th>
                <th className={th}>Summary</th>
                <th className={th}>IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTime(r.createdAt)}</td>
                  <td className={td}>{r.actor.name}</td>
                  <td className={`${td} font-mono text-[12px]`}>{r.action}</td>
                  <td className={td}>
                    {r.entityId && LINK[r.entityType] ? (
                      <Link href={LINK[r.entityType]!(r.entityId)} className="hover:underline">
                        {r.summary}
                      </Link>
                    ) : (
                      r.summary
                    )}
                  </td>
                  <td className={`${td} font-mono text-[11.5px] text-muted`}>{r.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE} total={total} params={{ entity: sp.entity }} basePath="/admin/activity" />
      </Panel>
    </div>
  );
}
