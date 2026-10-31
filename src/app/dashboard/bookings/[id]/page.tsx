import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, Download, FileText, Fuel, Gauge, LifeBuoy, MapPin, Navigation } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { cancellationRefund, type LineItem } from "@/lib/pricing";
import { BOOKING_STATUS, PAYMENT_STATUS } from "@/lib/constants";
import { formatDateTime, formatDuration, formatINR, titleCase } from "@/lib/utils";
import { Badge, Stars, StatusBadge } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { CancelBooking, ReviewForm } from "@/components/account/booking-actions";

export const metadata: Metadata = { title: "Booking details" };

const TIMELINE: { key: string; label: string }[] = [
  { key: "created", label: "Booked" },
  { key: "paid", label: "Paid" },
  { key: "confirmed", label: "Confirmed" },
  { key: "picked", label: "Picked up" },
  { key: "returned", label: "Returned" },
];

export default async function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCustomerPage();
  const b = await db.booking.findFirst({
    where: { id, userId: user.id },
    include: {
      vehicle: { include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } } },
      pickupLocation: { include: { city: true } },
      dropoffLocation: true,
      pricing: true,
      payments: { orderBy: { createdAt: "asc" } },
      refunds: { orderBy: { createdAt: "asc" } },
      handovers: { include: { inspections: true }, orderBy: { recordedAt: "asc" } },
      review: true,
    },
  });
  if (!b) notFound();
  const p = b.pricing!;
  const paid = b.payments.some((x) => ["CAPTURED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(x.status));
  const cancellable = ["AWAITING_PAYMENT", "PENDING", "PAYMENT_COMPLETED", "CONFIRMED"].includes(b.status);
  const policy = cancellationRefund({ rentalTotal: p.rentalTotal, deposit: p.securityDeposit, startAt: b.startAt });
  const upcoming = b.status === "CONFIRMED" && b.startAt > new Date() ? "Upcoming" : null;
  const reached = {
    created: true,
    paid,
    confirmed: ["CONFIRMED", "ACTIVE", "COMPLETED"].includes(b.status),
    picked: !!b.actualPickupAt,
    returned: !!b.actualReturnAt,
  } as Record<string, boolean>;
  const extra = p.extraKmCharges + p.lateReturnCharges + p.damageCharges + p.fuelCharges;

  return (
    <div className="space-y-6">
      <Link href="/dashboard/bookings" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All bookings
      </Link>

      <div className="card overflow-hidden">
        <div className="grid md:grid-cols-[280px_1fr]">
          <div className="relative aspect-[16/10] bg-paper md:aspect-auto">
            {b.vehicle.images[0] && <Image src={b.vehicle.images[0].url} alt="" fill sizes="280px" className="object-cover" />}
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge map={BOOKING_STATUS} value={b.status} override={upcoming} />
              <span className="font-mono text-[12.5px] text-muted">{b.code}</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
              {b.vehicle.brand} {b.vehicle.model}
            </h1>
            <p className="text-[13.5px] text-muted">
              {b.vehicle.variant} · {b.vehicle.registrationNumber}
            </p>
            <div className="mt-5 grid gap-4 text-[13.5px] sm:grid-cols-3">
              <Info icon={CalendarClock} label="Pickup" value={formatDateTime(b.startAt)} />
              <Info icon={CalendarClock} label="Return" value={formatDateTime(b.endAt)} />
              <Info icon={MapPin} label={b.deliveryType === "DOORSTEP" ? "Doorstep delivery" : "Pickup hub"} value={b.deliveryType === "DOORSTEP" ? b.deliveryAddress ?? "" : `${b.pickupLocation.name}, ${b.pickupLocation.city.name}`} />
            </div>
            {b.dropoffLocation && <p className="mt-3 text-[13px] text-muted">Drop-off at {b.dropoffLocation.name}</p>}
          </div>
        </div>

        {/* Timeline */}
        {!["CANCELLED", "REFUNDED"].includes(b.status) ? (
          <ol className="flex border-t border-line px-6 py-5">
            {TIMELINE.map((t, i) => (
              <li key={t.key} className="relative flex flex-1 flex-col items-center text-center">
                {i > 0 && <span className={`absolute right-1/2 top-3 h-0.5 w-full ${reached[t.key] ? "bg-ink" : "bg-line"}`} />}
                <span className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${reached[t.key] ? "bg-ink text-lime" : "border-2 border-line bg-white text-muted"}`}>{i + 1}</span>
                <span className={`mt-2 text-[11.5px] font-medium sm:text-[12.5px] ${reached[t.key] ? "text-ink" : "text-muted"}`}>{t.label}</span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="border-t border-line bg-danger-soft/50 px-6 py-4 text-[13.5px] text-danger">
            Cancelled {b.cancelledAt ? formatDateTime(b.cancelledAt) : ""} — {b.cancelReason}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper px-6 py-4">
          {b.status === "AWAITING_PAYMENT" && <LinkButton href={`/book/pay/${b.id}`}>Complete payment</LinkButton>}
          {paid && (
            <>
              <a href={`/api/bookings/${b.id}/pdf?type=invoice`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[13px] font-semibold text-ink hover:border-ink/25">
                <FileText className="h-4 w-4" /> Download invoice
              </a>
              <a href={`/api/bookings/${b.id}/pdf?type=confirmation`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[13px] font-semibold text-ink hover:border-ink/25">
                <Download className="h-4 w-4" /> Booking confirmation
              </a>
            </>
          )}
          {b.pickupLocation.latitude && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${b.pickupLocation.latitude},${b.pickupLocation.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-white px-4 text-[13px] font-semibold text-ink hover:border-ink/25"
            >
              <Navigation className="h-4 w-4" /> Directions
            </a>
          )}
          <LinkButton href={`/dashboard/support/new?booking=${b.id}`} variant="ghost" size="sm">
            <LifeBuoy className="h-4 w-4" /> Get help
          </LinkButton>
          {cancellable && (
            <div className="ml-auto">
              <CancelBooking bookingId={b.id} policy={{ rule: policy.rule, total: paid ? policy.total : 0 }} />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section className="card p-6">
          <h2 className="text-[16px] font-semibold">Price breakdown</h2>
          <p className="text-[13px] text-muted">
            {formatDuration(p.durationHours)} · {p.includedKm} km included · extra {formatINR(p.extraKmRate)}/km
          </p>
          <div className="mt-4 space-y-2.5 text-[14px]">
            {(p.lineItems as unknown as LineItem[]).map((l) => (
              <div key={l.label} className="flex justify-between gap-3">
                <span className="text-muted">{l.label}</span>
                <span className={l.amount < 0 ? "font-medium text-success" : "font-medium text-ink"}>{l.amount < 0 ? `−${formatINR(-l.amount)}` : formatINR(l.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-line pt-2.5 font-semibold text-ink">
              <span>Paid at booking</span>
              <span>{formatINR(p.totalPayable)}</span>
            </div>
            {extra > 0 && (
              <div className="mt-3 space-y-2 rounded-xl bg-warning-soft/60 p-4">
                <p className="text-[13px] font-semibold text-warning">Trip charges (deducted from deposit)</p>
                {[
                  ["Extra kilometres", p.extraKmCharges],
                  ["Late return", p.lateReturnCharges],
                  ["Fuel", p.fuelCharges],
                  ["Damage", p.damageCharges],
                ]
                  .filter(([, v]) => (v as number) > 0)
                  .map(([k, v]) => (
                    <div key={k as string} className="flex justify-between text-[13px]">
                      <span className="text-muted">{k}</span>
                      <span className="font-medium">{formatINR(v as number)}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-[16px] font-semibold">Payments & refunds</h2>
          <ul className="mt-4 space-y-3 text-[13.5px]">
            {b.payments.map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">
                    {x.provider === "DEMO" ? "Demo payment" : "Razorpay"} {x.method && `· ${x.method.toUpperCase()}`}
                  </p>
                  <p className="font-mono text-[11.5px] text-muted">{x.providerPaymentId ?? x.providerOrderId}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink">{formatINR(x.amount)}</p>
                  <StatusBadge map={PAYMENT_STATUS} value={x.status} />
                </div>
              </li>
            ))}
            {b.refunds.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 border-t border-line pt-3">
                <div>
                  <p className="font-medium text-ink">{titleCase(r.type)} refund</p>
                  <p className="text-[12px] text-muted">{r.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-success">+{formatINR(r.amount)}</p>
                  <Badge tone={r.status === "PROCESSED" ? "success" : r.status === "FAILED" ? "danger" : "warning"}>{titleCase(r.status)}</Badge>
                </div>
              </li>
            ))}
            {!b.payments.length && <li className="text-muted">No payments yet.</li>}
          </ul>
        </section>
      </div>

      {b.handovers.length > 0 && (
        <section className="card p-6">
          <h2 className="text-[16px] font-semibold">Vehicle handover</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {b.handovers.map((h) => (
              <div key={h.id} className="rounded-xl border border-line p-4 text-[13.5px]">
                <p className="font-semibold text-ink">
                  {h.type === "PICKUP" ? "Pickup" : "Return"} · {formatDateTime(h.recordedAt)}
                </p>
                <div className="mt-3 flex gap-6 text-graphite">
                  <span className="flex items-center gap-1.5">
                    <Gauge className="h-4 w-4 text-muted" /> {h.odometer.toLocaleString("en-IN")} km
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Fuel className="h-4 w-4 text-muted" /> {h.fuelLevel}%
                  </span>
                </div>
                {h.inspections.length > 0 && (
                  <ul className="mt-3 space-y-1 text-[12.5px] text-muted">
                    {h.inspections.map((i) => (
                      <li key={i.id}>
                        • {i.area}: {titleCase(i.severity)} {i.note && `— ${i.note}`}
                      </li>
                    ))}
                  </ul>
                )}
                {h.lateMinutes > 0 && <p className="mt-2 text-[12.5px] text-warning">Returned {h.lateMinutes} min late</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {b.status === "COMPLETED" && (
        <section className="card p-6">
          <h2 className="text-[16px] font-semibold">Your review</h2>
          {b.review ? (
            <div className="mt-3">
              <div className="flex items-center gap-2">
                <Stars value={b.review.rating} size={16} />
                <Badge tone={b.review.status === "APPROVED" ? "success" : b.review.status === "REJECTED" ? "danger" : "warning"}>{titleCase(b.review.status)}</Badge>
              </div>
              {b.review.title && <p className="mt-2 font-semibold text-ink">{b.review.title}</p>}
              <p className="mt-1 text-[14px] text-graphite">{b.review.comment}</p>
            </div>
          ) : (
            <div className="mt-4">
              <p className="mb-4 text-[13.5px] text-muted">How was your trip? Reviews help other drivers — and earn you 50 bonus points.</p>
              <ReviewForm bookingId={b.id} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <div className="min-w-0">
        <p className="text-[12px] text-muted">{label}</p>
        <p className="font-medium text-ink">{value}</p>
      </div>
    </div>
  );
}
