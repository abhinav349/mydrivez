import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { requireCustomerPage } from "@/lib/auth/session";
import { NewTicketForm } from "@/components/support/forms";

export const metadata: Metadata = { title: "New support ticket" };

export default async function NewTicketPage({ searchParams }: { searchParams: Promise<{ booking?: string }> }) {
  const { booking } = await searchParams;
  const user = await requireCustomerPage();
  const bookings = await db.booking.findMany({ where: { userId: user.id }, orderBy: { startAt: "desc" }, take: 20, include: { vehicle: true } });
  return (
    <div className="max-w-3xl">
      <Link href="/dashboard/support" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Support
      </Link>
      <h1 className="mb-6 mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Open a support ticket</h1>
      <div className="card p-6">
        <NewTicketForm bookings={bookings.map((b) => ({ id: b.id, label: `${b.code} · ${b.vehicle.brand} ${b.vehicle.model}` }))} defaultBooking={bookings.some((b) => b.id === booking) ? booking : undefined} />
      </div>
    </div>
  );
}
