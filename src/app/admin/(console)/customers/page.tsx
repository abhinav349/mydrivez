import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { formatDate, formatINR, titleCase } from "@/lib/utils";
import { PageHeader, Pagination, Panel, tableCls, td, th, theadCls } from "@/components/admin/ui";
import { Avatar, Badge, DemoBadge } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Customers" };
const PAGE = 20;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  await requireStaffPage();
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.UserWhereInput = {
    role: "CUSTOMER",
    ...(sp.status ? { status: sp.status as "ACTIVE" } : {}),
    ...(sp.segment ? { customerProfile: { segment: sp.segment } } : {}),
    ...(sp.docs === "pending" ? { documents: { some: { status: "PENDING" } } } : {}),
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { email: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      include: { customerProfile: true, documents: { select: { status: true } }, _count: { select: { bookings: true } } },
    }),
    db.user.count({ where }),
  ]);
  const spend = await db.bookingPricing.groupBy({
    by: ["bookingId"],
    where: { booking: { userId: { in: rows.map((r) => r.id) }, status: { in: ["COMPLETED", "ACTIVE", "CONFIRMED"] } } },
    _sum: { rentalTotal: true },
  });
  const bookingOwners = await db.booking.findMany({ where: { id: { in: spend.map((s) => s.bookingId) } }, select: { id: true, userId: true } });
  const owner = new Map(bookingOwners.map((b) => [b.id, b.userId]));
  const spendByUser = new Map<string, number>();
  for (const s of spend) {
    const u = owner.get(s.bookingId)!;
    spendByUser.set(u, (spendByUser.get(u) ?? 0) + (s._sum.rentalTotal ?? 0));
  }
  const params = { q: sp.q, status: sp.status, segment: sp.segment, docs: sp.docs };

  return (
    <div>
      <PageHeader title="Customers" description={`${total} customers`} />
      <Panel>
        <form className="flex flex-wrap gap-2 border-b border-line p-4" action="/admin/customers">
          <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" className="h-10 min-w-[220px] flex-1 rounded-xl border border-line bg-paper px-3 text-[13px] outline-none" />
          <select name="status" defaultValue={sp.status ?? ""} className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px]">
            <option value="">Any status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
          <select name="segment" defaultValue={sp.segment ?? ""} className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px]">
            <option value="">All segments</option>
            {["new", "regular", "loyal", "corporate"].map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
          <select name="docs" defaultValue={sp.docs ?? ""} className="h-10 rounded-xl border border-line bg-paper px-3 text-[13px]">
            <option value="">Any documents</option>
            <option value="pending">Pending verification</option>
          </select>
          <button className="h-10 rounded-xl bg-ink px-4 text-[13px] font-semibold text-white">Filter</button>
        </form>
        <div className="overflow-x-auto">
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Customer</th>
                <th className={th}>Phone</th>
                <th className={th}>Segment</th>
                <th className={th}>Documents</th>
                <th className={`${th} text-right`}>Bookings</th>
                <th className={`${th} text-right`}>Spend</th>
                <th className={th}>Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => {
                const verified = u.documents.filter((d) => d.status === "VERIFIED").length;
                const pending = u.documents.some((d) => d.status === "PENDING");
                return (
                  <tr key={u.id} className="hover:bg-paper/60">
                    <td className={td}>
                      <Link href={`/admin/customers/${u.id}`} className="flex items-center gap-3">
                        <Avatar name={u.name} src={u.avatarUrl} size={32} />
                        <span>
                          <span className="flex items-center gap-1.5 font-semibold text-ink hover:underline">
                            {u.name} {u.isDemo && <DemoBadge />} {u.status === "SUSPENDED" && <Badge tone="danger">Suspended</Badge>}
                          </span>
                          <span className="text-[12px] text-muted">{u.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className={td}>{u.phone}</td>
                    <td className={td}>
                      <Badge>{titleCase(u.customerProfile?.segment ?? "new")}</Badge>
                    </td>
                    <td className={td}>{pending ? <Badge tone="warning">Pending review</Badge> : verified >= 2 ? <Badge tone="success">Verified</Badge> : <Badge>Incomplete</Badge>}</td>
                    <td className={`${td} text-right`}>{u._count.bookings}</td>
                    <td className={`${td} text-right font-semibold`}>{formatINR(spendByUser.get(u.id) ?? 0)}</td>
                    <td className={td}>{formatDate(u.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={PAGE} total={total} params={params} basePath="/admin/customers" />
      </Panel>
    </div>
  );
}
