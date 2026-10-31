import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { expireStaleHolds } from "@/lib/booking/service";
import { notify, notifyAdmins } from "@/lib/notify";
import { formatDateTime } from "@/lib/utils";

/**
 * GET /api/cron/reminders — scheduled job (see vercel.json).
 * Releases expired payment holds, sends pickup/return reminders, flags overdue returns,
 * and alerts admins about vehicle documents and maintenance that are due soon.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!env.cronSecret || auth !== `Bearer ${env.cronSecret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const in36h = new Date(now.getTime() + 36 * 3600_000);
  const released = await expireStaleHolds();

  const pickups = await db.booking.findMany({
    where: { status: "CONFIRMED", startAt: { gt: now, lt: in36h }, reminderSentAt: null },
    include: { vehicle: true, pickupLocation: true },
  });
  for (const b of pickups) {
    await notify({
      userId: b.userId,
      type: "PICKUP_REMINDER",
      title: "Your trip starts soon 🚗",
      body: `Pick up your ${b.vehicle.brand} ${b.vehicle.model} on ${formatDateTime(b.startAt)} at ${b.deliveryType === "DOORSTEP" ? "your doorstep" : b.pickupLocation.name}. Bring your original driving licence.`,
      link: `/dashboard/bookings/${b.id}`,
      channels: ["email", "sms", "whatsapp"],
    });
    await db.booking.update({ where: { id: b.id }, data: { reminderSentAt: now } });
  }

  const returns = await db.booking.findMany({ where: { status: "ACTIVE", endAt: { gt: now, lt: in36h } }, include: { vehicle: true } });
  for (const b of returns) {
    await notify({ userId: b.userId, type: "RETURN_REMINDER", title: "Return reminder", body: `Your ${b.vehicle.brand} ${b.vehicle.model} is due back ${formatDateTime(b.endAt)}.`, link: `/dashboard/bookings/${b.id}`, channels: ["email"] });
  }

  const overdue = await db.booking.findMany({ where: { status: "ACTIVE", endAt: { lt: now } }, include: { vehicle: true, user: true } });
  for (const b of overdue) {
    await notifyAdmins({ type: "RETURN_OVERDUE", title: `Overdue: ${b.vehicle.brand} ${b.vehicle.model}`, body: `${b.user.name} was due back ${formatDateTime(b.endAt)} (${b.code}).`, link: `/admin/bookings/${b.id}` });
  }

  const docs = await db.vehicleDocument.findMany({ where: { expiresAt: { lt: new Date(now.getTime() + 15 * 86_400_000) } }, include: { vehicle: true } });
  for (const d of docs) {
    await notifyAdmins({ type: "VEHICLE_DOC_EXPIRY", title: `${d.type} expiring for ${d.vehicle.registrationNumber}`, body: `${d.vehicle.brand} ${d.vehicle.model} ${d.type.toLowerCase()} expires ${formatDateTime(d.expiresAt)}.`, link: `/admin/fleet/${d.vehicleId}` });
  }

  const maint = await db.maintenanceRecord.findMany({ where: { status: "SCHEDULED", scheduledFor: { lt: new Date(now.getTime() + 2 * 86_400_000) } }, include: { vehicle: true } });
  for (const m of maint) {
    await notifyAdmins({ type: "MAINTENANCE_ALERT", title: `Maintenance due: ${m.vehicle.brand} ${m.vehicle.model}`, body: `${m.title} scheduled ${formatDateTime(m.scheduledFor)}.`, link: "/admin/maintenance" });
  }

  await db.rateLimit.deleteMany({ where: { windowStart: { lt: new Date(now.getTime() - 86_400_000) } } });
  await db.session.deleteMany({ where: { expiresAt: { lt: now } } });

  return NextResponse.json({ released, pickupReminders: pickups.length, returnReminders: returns.length, overdue: overdue.length, docAlerts: docs.length, maintenanceAlerts: maint.length });
}
