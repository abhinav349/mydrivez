import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";

const esc = (v: unknown) => {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** GET /api/admin/export/bookings?from&to&status&data=live|all — CSV export (opens in Excel). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user.role, user.permissions, "reports:export")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const live = url.searchParams.get("data") === "live";

  const rows = await db.booking.findMany({
    where: {
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
      ...(status ? { status: status as "CONFIRMED" } : {}),
      ...(live ? { isDemo: false } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
    include: { user: true, vehicle: true, pickupLocation: true, pricing: true, payments: true, refunds: true },
  });

  const header = ["Booking ID", "Created", "Status", "Customer", "Email", "Phone", "Vehicle", "Registration", "Hub", "Pickup", "Return", "Hours", "Base", "Surge", "Delivery", "Discount", "Coupon", "GST", "Rental total", "Deposit", "Extra km", "Late fee", "Fuel", "Damage", "Paid", "Refunded", "Payment IDs", "Demo"];
  const lines = [header.join(",")];
  for (const b of rows) {
    const p = b.pricing;
    const paid = b.payments.filter((x) => ["CAPTURED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(x.status)).reduce((s, x) => s + x.amount, 0);
    const refunded = b.refunds.filter((r) => r.status === "PROCESSED").reduce((s, r) => s + r.amount, 0);
    lines.push(
      [
        b.code, b.createdAt.toISOString(), b.status, b.user.name, b.user.email, b.user.phone, `${b.vehicle.brand} ${b.vehicle.model}`, b.vehicle.registrationNumber, b.pickupLocation.name,
        b.startAt.toISOString(), b.endAt.toISOString(), p?.durationHours, p?.baseAmount, p?.surgeAmount, p?.deliveryFee, p?.discountAmount, p?.couponCode, p?.taxAmount, p?.rentalTotal,
        p?.securityDeposit, p?.extraKmCharges, p?.lateReturnCharges, p?.fuelCharges, p?.damageCharges, paid, refunded, b.payments.map((x) => x.providerPaymentId).filter(Boolean).join(" "), b.isDemo ? "yes" : "no",
      ]
        .map(esc)
        .join(","),
    );
  }
  await audit(user.id, "report.export", "Booking", null, `Exported ${rows.length} bookings to CSV`);
  return new NextResponse("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mydrivez-bookings-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
