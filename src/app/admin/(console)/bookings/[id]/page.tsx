import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, Fuel, Gauge } from "lucide-react";
import { db } from "@/lib/db";
import { requireStaffPage } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { BOOKING_STATUS, DOC_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import type { LineItem } from "@/lib/pricing";
import { formatDateTime, formatDuration, formatINR, relativeTime, titleCase } from "@/lib/utils";
import { Panel } from "@/components/admin/ui";
import { Badge, DemoBadge, StatusBadge } from "@/components/ui/misc";
import { AdminCancelButton, ConfirmButton, HandoverForm, RetryRefund } from "@/components/admin/booking-admin-actions";

export const metadata: Metadata = { title: "Booking" };

export default async function AdminBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireStaffPage();
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      user: { include: { customerProfile: true, documents: { orderBy: { createdAt: "desc" } } } },
      vehicle: true,
      pickupLocation: { include: { city: true } },
      dropoffLocation: true,
      pricing: true,
      payments: { orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" } },
      handovers: { include: { inspections: true, recordedBy: { select: { name: true } } }, orderBy: { recordedAt: "asc" } },
      tickets: true,
    },
  });
  if (!b) notFound();
  const logs = await db.adminActivityLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "desc" }, include: { actor: { select: { name: true } } } });
  const p = b.pricing!;
  const paid = b.payments.some((x) => ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(x.status));
  const canBook = hasPermission(me.role, me.permissions, "bookings:write");
  const canHandover = hasPermission(me.role, me.permissions, "handover:write");
  const pickup = b.handovers.find((h) => h.type === "PICKUP");
  const late = b.status === "ACTIVE" && b.endAt < new Date();
  const docs = ["DRIVING_LICENSE", "GOVERNMENT_ID"].map((t) => ({ type: t, doc: b.user.documents.find((d) => d.type === t) }));

  return (
    <div className="space-y-6">
      <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Bookings
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-2xl font-bold tracking-tight">{b.code}</h1>
            <StatusBadge map={BOOKING_STATUS} value={b.status} />
            {b.isDemo && <DemoBadge />}
            {late && <Badge tone="danger">Overdue</Badge>}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">
            Created {formatDateTime(b.createdAt)} · {b.vehicle.brand} {b.vehicle.model} for {b.user.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canBook && ["PAYMENT_COMPLETED", "PENDING"].includes(b.status) && <ConfirmButton id={b.id} />}
          {canBook && ["PENDING", "AWAITING_PAYMENT", "PAYMENT_COMPLETED", "CONFIRMED"].includes(b.status) && <AdminCancelButton id={b.id} paid={paid} />}
          {paid && (
            <a href={`/api/bookings/${b.id}/pdf?type=invoice`} className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[13px] font-semibold text-ink">
              <FileText className="h-4 w-4" /> Invoice
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Trip">
            <dl className="grid gap-5 p-5 text-[13.5px] sm:grid-cols-3">
              <Item k="Pickup" v={formatDateTime(b.startAt)} sub={b.actualPickupAt ? `Picked up ${formatDateTime(b.actualPickupAt)}` : undefined} />
              <Item k="Return" v={formatDateTime(b.endAt)} sub={b.actualReturnAt ? `Returned ${formatDateTime(b.actualReturnAt)}` : late ? `Overdue by ${relativeTime(b.endAt).replace(" ago", "")}` : undefined} />
              <Item k="Duration" v={formatDuration(p.durationHours)} sub={`${p.includedKm} km included`} />
              <Item k="Vehicle" v={`${b.vehicle.brand} ${b.vehicle.model}`} sub={b.vehicle.registrationNumber} href={`/admin/fleet/${b.vehicleId}`} />
              <Item k={b.deliveryType === "DOORSTEP" ? "Doorstep delivery" : "Pickup hub"} v={b.deliveryType === "DOORSTEP" ? b.deliveryAddress ?? "" : b.pickupLocation.name} sub={b.pickupLocation.city.name} />
              <Item k="Drop-off" v={b.dropoffLocation?.name ?? "Same as pickup"} />
            </dl>
            {b.customerNote && <p className="mx-5 mb-5 rounded-xl bg-paper p-3 text-[13.5px] text-graphite">“{b.customerNote}”</p>}
            {b.cancelReason && <p className="mx-5 mb-5 rounded-xl bg-danger-soft p-3 text-[13.5px] text-danger">Cancelled by {b.cancelledBy}: {b.cancelReason}</p>}
          </Panel>

          {canHandover && b.status === "CONFIRMED" && (
            <Panel title="Record vehicle pickup">
              <div className="p-5">
                <HandoverForm bookingId={b.id} type="PICKUP" customerName={b.user.name} deposit={p.securityDeposit} />
              </div>
            </Panel>
          )}
          {canHandover && b.status === "ACTIVE" && pickup && (
            <Panel title="Record vehicle return">
              <div className="p-5">
                <HandoverForm bookingId={b.id} type="RETURN" customerName={b.user.name} pickup={{ odometer: pickup.odometer, fuelLevel: pickup.fuelLevel }} deposit={p.securityDeposit} />
              </div>
            </Panel>
          )}

          {b.handovers.length > 0 && (
            <Panel title="Handover history">
              <div className="grid gap-4 p-5 md:grid-cols-2">
                {b.handovers.map((h) => (
                  <div key={h.id} className="rounded-xl border border-line p-4 text-[13px]">
                    <div className="flex items-center justify-between">
                      <Badge tone={h.type === "PICKUP" ? "accent" : "info"}>{h.type === "PICKUP" ? "Pickup" : "Return"}</Badge>
                      <span className="text-muted">{formatDateTime(h.recordedAt)}</span>
                    </div>
                    <div className="mt-3 flex gap-5">
                      <span className="flex items-center gap-1.5">
                        <Gauge className="h-4 w-4 text-muted" /> {h.odometer.toLocaleString("en-IN")} km
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Fuel className="h-4 w-4 text-muted" /> {h.fuelLevel}%
                      </span>
                    </div>
                    {h.inspections.length > 0 && (
                      <ul className="mt-2 space-y-0.5 text-muted">
                        {h.inspections.map((i) => (
                          <li key={i.id}>
                            • {i.area} — {titleCase(i.severity)} {i.note && `(${i.note})`}
                          </li>
                        ))}
                      </ul>
                    )}
                    {h.photoUrls.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {h.photoUrls.map((u) => (
                          <a key={u} href={u} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="Condition" className="h-14 w-20 rounded-md object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                    {h.notes && <p className="mt-2 text-graphite">{h.notes}</p>}
                    <p className="mt-2 text-[12px] text-muted">
                      By {h.recordedBy.name}
                      {h.customerSignature && ` · signed by ${h.customerSignature}`}
                      {h.chargesAssessed > 0 && ` · charges ${formatINR(h.chargesAssessed)}`}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          <Panel title="Activity">
            <ul className="divide-y divide-line">
              {logs.map((l) => (
                <li key={l.id} className="flex justify-between gap-4 px-5 py-3 text-[13px]">
                  <span>
                    <span className="font-medium text-ink">{l.actor.name}</span> <span className="text-muted">{l.summary}</span>
                  </span>
                  <span className="shrink-0 text-muted">{relativeTime(l.createdAt)}</span>
                </li>
              ))}
              {!logs.length && <li className="px-5 py-6 text-[13px] text-muted">No admin actions yet.</li>}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Customer" action={<Link href={`/admin/customers/${b.userId}`} className="text-[12.5px] font-semibold text-muted hover:text-ink">Profile</Link>}>
            <div className="space-y-1 p-5 text-[13.5px]">
              <p className="font-semibold text-ink">{b.user.name}</p>
              <p className="text-muted">{b.user.email}</p>
              <p className="text-muted">{b.user.phone}</p>
              {b.user.customerProfile?.licenseNumber && <p className="text-muted">DL: {b.user.customerProfile.licenseNumber}</p>}
              <div className="mt-3 space-y-2">
                {docs.map(({ type, doc }) => (
                  <div key={type} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2">
                    <span>{titleCase(type)}</span>
                    {doc ? <StatusBadge map={DOC_STATUS} value={doc.status} /> : <Badge>Missing</Badge>}
                  </div>
                ))}
              </div>
              {docs.some((d) => d.doc?.status === "PENDING") && (
                <Link href="/admin/verifications" className="mt-2 inline-block text-[12.5px] font-semibold text-ink underline">
                  Review documents →
                </Link>
              )}
            </div>
          </Panel>

          <Panel title="Pricing">
            <div className="space-y-2 p-5 text-[13.5px]">
              {(p.lineItems as unknown as LineItem[]).map((l) => (
                <div key={l.label} className="flex justify-between gap-3">
                  <span className="text-muted">{l.label}</span>
                  <span className={l.amount < 0 ? "text-success" : "text-ink"}>{l.amount < 0 ? `−${formatINR(-l.amount)}` : formatINR(l.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-2 font-semibold">
                <span>Collected</span>
                <span>{formatINR(p.totalPayable)}</span>
              </div>
              {[
                ["Extra km", p.extraKmCharges],
                ["Late return", p.lateReturnCharges],
                ["Fuel", p.fuelCharges],
                ["Damage", p.damageCharges],
              ]
                .filter(([, v]) => (v as number) > 0)
                .map(([k, v]) => (
                  <div key={k as string} className="flex justify-between text-warning">
                    <span>{k}</span>
                    <span>{formatINR(v as number)}</span>
                  </div>
                ))}
            </div>
          </Panel>

          <Panel title="Payments & refunds">
            <ul className="divide-y divide-line text-[13px]">
              {b.payments.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium text-ink">
                      {x.provider}
                      {x.isTest && <span className="ml-1 text-[11px] text-warning">(test)</span>} · {formatINR(x.amount)}
                    </p>
                    <p className="font-mono text-[11px] text-muted">{x.providerPaymentId ?? x.providerOrderId}</p>
                    {x.failureReason && <p className="text-[11.5px] text-danger">{x.failureReason}</p>}
                  </div>
                  <StatusBadge map={PAYMENT_STATUS} value={x.status} />
                </li>
              ))}
              {b.refunds.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="font-medium text-ink">
                      {titleCase(r.type)} refund · {formatINR(r.amount)}
                    </p>
                    <p className="text-[11.5px] text-muted">{r.reason}</p>
                  </div>
                  {r.status === "PROCESSED" ? <Badge tone="success">Processed</Badge> : canBook ? <RetryRefund id={r.id} /> : <Badge tone="warning">{titleCase(r.status)}</Badge>}
                </li>
              ))}
              {!b.payments.length && <li className="px-5 py-4 text-muted">No payment attempts.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Item({ k, v, sub, href }: { k: string; v: string; sub?: string; href?: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{k}</dt>
      <dd className="mt-0.5 font-medium text-ink">{href ? <Link href={href} className="hover:underline">{v}</Link> : v}</dd>
      {sub && <dd className="text-[12px] text-muted">{sub}</dd>}
    </div>
  );
}
