"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Sheet } from "@/components/ui/overlay";
import { buttonClass } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";

export type QuickBooking = {
  id: string;
  code: string;
  status: string;
  statusLabel: string;
  customer: string;
  email: string;
  phone: string;
  vehicle: string;
  reg: string;
  hub: string;
  start: string;
  end: string;
  total: string;
  deposit: string;
  payment: string;
  coupon: string | null;
  note: string | null;
  doorstep: string | null;
  isDemo: boolean;
};

export function BookingQuickView({ b }: { b: QuickBooking }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink" aria-label={`Quick view ${b.code}`}>
        <Eye className="h-4 w-4" />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={<span className="font-mono">{b.code}</span>}>
        <div className="space-y-6 p-6 text-[14px]">
          <div className="flex items-center gap-2">
            <Badge tone="dark">{b.statusLabel}</Badge>
            {b.isDemo && <Badge tone="warning">Demo record</Badge>}
          </div>
          <Section title="Customer" rows={[["Name", b.customer], ["Email", b.email], ["Phone", b.phone]]} />
          <Section title="Vehicle" rows={[["Car", b.vehicle], ["Registration", b.reg], ["Hub", b.hub], ...(b.doorstep ? ([["Doorstep", b.doorstep]] as [string, string][]) : [])]} />
          <Section title="Trip" rows={[["Pickup", b.start], ["Return", b.end]]} />
          <Section title="Money" rows={[["Rental total", b.total], ["Deposit", b.deposit], ["Payment", b.payment], ...(b.coupon ? ([["Coupon", b.coupon]] as [string, string][]) : [])]} />
          {b.note && (
            <div>
              <p className="eyebrow mb-2">Customer note</p>
              <p className="rounded-xl bg-paper p-3 text-graphite">{b.note}</p>
            </div>
          )}
          <Link href={`/admin/bookings/${b.id}`} className={buttonClass("primary", "md", "w-full")}>
            Open full booking
          </Link>
        </div>
      </Sheet>
    </>
  );
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div>
      <p className="eyebrow mb-2">{title}</p>
      <dl className="divide-y divide-line rounded-xl border border-line">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-muted">{k}</dt>
            <dd className="text-right font-medium text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
