import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Download, FileText, Hourglass, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { formatDateTime, formatINR } from "@/lib/utils";
import { LinkButton } from "@/components/ui/button";
import { Confetti } from "@/components/booking/confetti";

export const metadata: Metadata = { title: "Booking confirmed", robots: { index: false } };

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCustomerPage();
  const b = await db.booking.findFirst({
    where: { id, userId: user.id },
    include: { vehicle: { include: { images: { take: 1, orderBy: { sortOrder: "asc" } } } }, pickupLocation: true, pricing: true, payments: { where: { status: "CAPTURED" } } },
  });
  if (!b) notFound();
  const confirmed = b.status === "CONFIRMED";
  const paid = b.payments.length > 0;

  return (
    <div className="container max-w-3xl py-12 lg:py-16">
      {paid && <Confetti />}
      <div className="text-center">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${confirmed ? "bg-lime text-ink" : "bg-warning-soft text-warning"}`}>
          {confirmed ? <CheckCircle2 className="h-8 w-8" /> : <Hourglass className="h-8 w-8" />}
        </span>
        <h1 className="mt-6 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
          {confirmed ? "You're all set!" : paid ? "Payment received — almost there" : "Booking not yet paid"}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] text-muted">
          {confirmed
            ? "Your booking is confirmed. We've sent the details to your email and you'll get a reminder before pickup."
            : paid
              ? "Your booking is paid and under review. We'll confirm it shortly — usually once your documents are verified."
              : "This booking is still awaiting payment."}
        </p>
        <p className="mt-4 inline-flex rounded-full bg-white px-4 py-1.5 font-mono text-[13px] font-bold tracking-wider text-ink shadow-card">{b.code}</p>
      </div>

      <div className="card mt-10 overflow-hidden">
        <div className="grid sm:grid-cols-[220px_1fr]">
          <div className="relative aspect-[16/10] bg-paper sm:aspect-auto">
            {b.vehicle.images[0] && <Image src={b.vehicle.images[0].url} alt="" fill sizes="220px" className="object-cover" />}
          </div>
          <div className="p-6">
            <p className="text-lg font-semibold text-ink">
              {b.vehicle.brand} {b.vehicle.model}
            </p>
            <p className="text-[13px] text-muted">{b.vehicle.registrationNumber}</p>
            <div className="mt-4 grid gap-3 text-[13.5px] sm:grid-cols-2">
              <p className="flex gap-2">
                <CalendarClock className="h-4 w-4 shrink-0 text-muted" />
                <span>
                  <span className="block text-muted">Pickup</span>
                  <span className="font-medium text-ink">{formatDateTime(b.startAt)}</span>
                </span>
              </p>
              <p className="flex gap-2">
                <CalendarClock className="h-4 w-4 shrink-0 text-muted" />
                <span>
                  <span className="block text-muted">Return</span>
                  <span className="font-medium text-ink">{formatDateTime(b.endAt)}</span>
                </span>
              </p>
              <p className="flex gap-2 sm:col-span-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted" />
                <span className="font-medium text-ink">{b.deliveryType === "DOORSTEP" ? `Doorstep: ${b.deliveryAddress}` : `${b.pickupLocation.name} — ${b.pickupLocation.address}`}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-6 py-4">
          <p className="text-[14px] text-muted">
            Paid <span className="font-semibold text-ink">{formatINR(b.pricing?.totalPayable ?? 0)}</span> (incl. {formatINR(b.pricing?.securityDeposit ?? 0)} refundable deposit)
          </p>
          {paid && (
            <div className="flex gap-2">
              <a href={`/api/bookings/${b.id}/pdf?type=confirmation`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink hover:underline">
                <Download className="h-4 w-4" /> Confirmation
              </a>
              <a href={`/api/bookings/${b.id}/pdf?type=invoice`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink hover:underline">
                <FileText className="h-4 w-4" /> Invoice
              </a>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href={`/dashboard/bookings/${b.id}`}>View booking</LinkButton>
        {!paid && b.status === "AWAITING_PAYMENT" && (
          <LinkButton href={`/book/pay/${b.id}`} variant="accent">
            Complete payment
          </LinkButton>
        )}
        <LinkButton href="/cars" variant="secondary">
          Browse more cars
        </LinkButton>
      </div>
    </div>
  );
}
