import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { BOOKING_STATUS, DOC_STATUS, TICKET_STATUS } from "@/lib/constants";
import { formatDate, formatDateTime, formatINR, relativeTime, titleCase } from "@/lib/utils";
import { Kpi, PageHeader, Panel } from "@/components/admin/ui";
import { Avatar, Badge, DemoBadge, StatusBadge } from "@/components/ui/misc";
import { DocumentDecision, SuspendToggle } from "@/components/admin/review-controls";
import { CalendarRange, Gift, IndianRupee, LifeBuoy } from "lucide-react";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaffPage();
  const u = await db.user.findFirst({
    where: { id, role: "CUSTOMER" },
    include: {
      customerProfile: true,
      documents: { orderBy: { createdAt: "desc" }, include: { file: { select: { id: true } } } },
      bookings: { orderBy: { startAt: "desc" }, include: { vehicle: true, pricing: true } },
      tickets: { orderBy: { updatedAt: "desc" } },
      referredBy: { select: { id: true, name: true } },
      _count: { select: { referrals: true, reviews: true } },
    },
  });
  if (!u) notFound();
  const canWrite = hasPermission(me.role, me.permissions, "customers:write");
  const spend = u.bookings.filter((b) => ["COMPLETED", "ACTIVE", "CONFIRMED"].includes(b.status)).reduce((s, b) => s + (b.pricing?.rentalTotal ?? 0), 0);
  const p = u.customerProfile;

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={u.name} src={u.avatarUrl} size={56} />
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-[-0.03em]">
              {u.name} {u.isDemo && <DemoBadge />} {u.status === "SUSPENDED" && <Badge tone="danger">Suspended</Badge>}
            </h1>
            <p className="text-[13.5px] text-muted">
              {u.email} · {u.phone} · joined {formatDate(u.createdAt)} · last login {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "never"}
            </p>
          </div>
        </div>
        {canWrite && <SuspendToggle id={u.id} status={u.status} />}
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Lifetime spend" value={formatINR(spend)} icon={IndianRupee} />
        <Kpi label="Bookings" value={u.bookings.length} sub={`${u.bookings.filter((b) => b.status === "COMPLETED").length} completed`} icon={CalendarRange} />
        <Kpi label="Loyalty points" value={u.loyaltyPoints} sub={`${u._count.referrals} referrals · code ${u.referralCode}`} icon={Gift} />
        <Kpi label="Support tickets" value={u.tickets.length} sub={`${u.tickets.filter((t) => !["RESOLVED", "CLOSED"].includes(t.status)).length} open`} icon={LifeBuoy} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        <Panel title="Profile">
          <dl className="grid grid-cols-2 gap-4 p-5 text-[13.5px]">
            {[
              ["Date of birth", p?.dateOfBirth ? formatDate(p.dateOfBirth) : "—"],
              ["Segment", titleCase(p?.segment ?? "new")],
              ["Address", [p?.addressLine1, p?.city, p?.state, p?.pincode].filter(Boolean).join(", ") || "—"],
              ["Licence", p?.licenseNumber ? `${p.licenseNumber}${p.licenseExpiry ? ` (till ${formatDate(p.licenseExpiry)})` : ""}` : "—"],
              ["Emergency contact", p?.emergencyName ? `${p.emergencyName} · ${p.emergencyPhone}` : "—"],
              ["Referred by", u.referredBy?.name ?? "—"],
              ["Email verified", u.emailVerifiedAt ? "Yes" : "No"],
              ["Reviews written", String(u._count.reviews)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] text-muted">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Documents">
          <ul className="divide-y divide-line text-[13.5px]">
            {u.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-medium text-ink">
                    {titleCase(d.type)} · <span className="font-mono">{d.documentNumber ?? "—"}</span>
                  </p>
                  <p className="text-[12px] text-muted">
                    Uploaded {formatDate(d.createdAt)}
                    {d.rejectionReason && ` · ${d.rejectionReason}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`/api/files/${d.file.id}`} target="_blank" rel="noopener noreferrer" className="text-[12.5px] font-semibold underline">
                    View
                  </a>
                  {d.status === "PENDING" && canWrite ? <DocumentDecision id={d.id} /> : <StatusBadge map={DOC_STATUS} value={d.status} />}
                </div>
              </li>
            ))}
            {!u.documents.length && <li className="px-5 py-6 text-muted">No documents uploaded.</li>}
          </ul>
        </Panel>
      </div>

      <Panel title="Booking history">
        <ul className="divide-y divide-line text-[13px]">
          {u.bookings.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-paper/60">
                <span>
                  <span className="font-mono font-semibold">{b.code}</span> · {b.vehicle.brand} {b.vehicle.model}
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {formatDateTime(b.startAt)}
                  <StatusBadge map={BOOKING_STATUS} value={b.status} />
                  <span className="w-20 text-right font-semibold text-ink">{formatINR(b.pricing?.rentalTotal ?? 0)}</span>
                </span>
              </Link>
            </li>
          ))}
          {!u.bookings.length && <li className="px-5 py-6 text-muted">No bookings yet.</li>}
        </ul>
      </Panel>

      {u.tickets.length > 0 && (
        <Panel title="Complaints & support tickets">
          <ul className="divide-y divide-line text-[13px]">
            {u.tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/admin/support/${t.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-paper/60">
                  <span>
                    <span className="font-mono">{t.code}</span> · {t.subject}
                  </span>
                  <StatusBadge map={TICKET_STATUS} value={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
