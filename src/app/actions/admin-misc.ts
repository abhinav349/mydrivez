"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthError, requireAdmin, requireStaff } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { ALL_PERMISSIONS } from "@/lib/auth/permissions";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { saveSettings, type AppSettings } from "@/lib/settings";
import { slugify } from "@/lib/utils";
import { couponSchema, fieldErrors, passwordSchema, type ActionState } from "@/lib/validators";

type R<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<R<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong." };
  }
}

/* ───────────── Customers & documents ───────────── */

export async function reviewDocument(id: string, decision: "VERIFIED" | "REJECTED", reason?: string) {
  return run(async () => {
    const u = await requireStaff("customers:write");
    if (decision === "REJECTED" && !reason?.trim()) throw new AuthError("Add a reason so the customer knows what to fix.", 403);
    const doc = await db.customerDocument.update({
      where: { id },
      data: { status: decision, rejectionReason: decision === "REJECTED" ? reason!.trim().slice(0, 300) : null, reviewedById: u.id, reviewedAt: new Date() },
      include: { user: true },
    });
    const label = doc.type === "DRIVING_LICENSE" ? "driving licence" : doc.type === "GOVERNMENT_ID" ? "government ID" : "document";
    await notify({
      userId: doc.userId,
      type: "DOCUMENT_UPDATE",
      title: decision === "VERIFIED" ? `Your ${label} is verified ✅` : `Your ${label} needs attention`,
      body: decision === "VERIFIED" ? "You're all set for faster pickups." : `We couldn't verify it: ${reason}. Please upload a new copy.`,
      link: "/dashboard/documents",
      channels: ["email"],
    });
    await audit(u.id, `document.${decision.toLowerCase()}`, "CustomerDocument", id, `${decision === "VERIFIED" ? "Verified" : "Rejected"} ${label} for ${doc.user.name}`);
    revalidatePath("/admin/verifications");
    revalidatePath(`/admin/customers/${doc.userId}`);
    return null;
  });
}

export async function setCustomerStatus(userId: string, status: "ACTIVE" | "SUSPENDED", reason?: string) {
  return run(async () => {
    const u = await requireStaff("customers:write");
    const target = await db.user.findUniqueOrThrow({ where: { id: userId } });
    if (target.role !== "CUSTOMER") throw new AuthError("Use Staff & roles to manage staff accounts.", 403);
    await db.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
    await audit(u.id, status === "SUSPENDED" ? "customer.suspend" : "customer.reactivate", "User", userId, `${status === "SUSPENDED" ? "Suspended" : "Reactivated"} ${target.name}${reason ? `: ${reason}` : ""}`);
    revalidatePath(`/admin/customers/${userId}`);
    revalidatePath("/admin/customers");
    return null;
  });
}

/* ───────────── Reviews ───────────── */

export async function moderateReview(id: string, status: "APPROVED" | "REJECTED") {
  return run(async () => {
    const u = await requireStaff("reviews:moderate");
    const r = await db.review.update({ where: { id }, data: { status } });
    const agg = await db.review.aggregate({ where: { vehicleId: r.vehicleId, status: "APPROVED" }, _avg: { rating: true }, _count: true });
    await db.vehicle.update({ where: { id: r.vehicleId }, data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count } });
    await audit(u.id, `review.${status.toLowerCase()}`, "Review", id, `${status === "APPROVED" ? "Approved" : "Rejected"} a ${r.rating}★ review`);
    revalidatePath("/admin/reviews");
    revalidatePath("/cars");
    return null;
  });
}

/* ───────────── Support ───────────── */

export async function staffReplyAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const u = await requireStaff("support:write");
    const ticketId = String(form.get("ticketId"));
    const body = String(form.get("body") ?? "").trim();
    if (body.length < 2) return { error: "Write a reply first." };
    const t = await db.supportTicket.findUniqueOrThrow({ where: { id: ticketId } });
    await db.supportMessage.create({ data: { ticketId, authorId: u.id, body: body.slice(0, 3000), isStaff: true } });
    await db.supportTicket.update({ where: { id: ticketId }, data: { status: "AWAITING_CUSTOMER", assignedToId: t.assignedToId ?? u.id } });
    await notify({ userId: t.userId, type: "SUPPORT_REPLY", title: "New reply on your ticket", body: `Our team replied to “${t.subject}”.`, link: `/dashboard/support/${t.id}`, channels: ["email"] });
    revalidatePath(`/admin/support/${ticketId}`);
    return { ok: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateTicket(id: string, patch: { status?: string; priority?: string; assignedToId?: string | null }) {
  return run(async () => {
    const u = await requireStaff("support:write");
    const data = z
      .object({
        status: z.enum(["OPEN", "IN_PROGRESS", "AWAITING_CUSTOMER", "RESOLVED", "CLOSED"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        assignedToId: z.string().nullable().optional(),
      })
      .parse(patch);
    const t = await db.supportTicket.update({ where: { id }, data });
    if (data.status === "RESOLVED" || data.status === "CLOSED")
      await notify({ userId: t.userId, type: "SUPPORT_RESOLVED", title: `Ticket ${t.code} ${data.status.toLowerCase()}`, body: `“${t.subject}” has been marked ${data.status.toLowerCase()}.`, link: `/dashboard/support/${t.id}` });
    await audit(u.id, "ticket.update", "SupportTicket", id, `Updated ${t.code}: ${JSON.stringify(data)}`);
    revalidatePath(`/admin/support/${id}`);
    revalidatePath("/admin/support");
    return null;
  });
}

export async function markEnquiryHandled(id: string) {
  return run(async () => {
    await requireStaff("support:write");
    await db.contactMessage.update({ where: { id }, data: { handled: true } });
    revalidatePath("/admin/support");
    return null;
  });
}

/* ───────────── Pricing rules & coupons ───────────── */

const ruleSchema = z.object({
  name: z.string().trim().min(3).max(60),
  type: z.enum(["WEEKEND", "SEASONAL", "HOLIDAY"]),
  adjustmentPct: z.coerce.number().int().min(-50).max(200),
  daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  category: z.string().optional(),
});

export async function createPricingRuleAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const u = await requireStaff("pricing:write");
    const p = ruleSchema.safeParse({ ...Object.fromEntries(form), daysOfWeek: form.getAll("daysOfWeek") });
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const d = p.data;
    if (d.type === "WEEKEND" && !d.daysOfWeek.length) return { fieldErrors: { daysOfWeek: "Pick at least one day" } };
    if (d.type !== "WEEKEND" && (!d.startDate || !d.endDate)) return { fieldErrors: { startDate: "Seasonal and holiday rules need a date range" } };
    if (d.startDate && d.endDate && d.endDate < d.startDate) return { fieldErrors: { endDate: "End must be after start" } };
    const r = await db.pricingRule.create({
      data: {
        name: d.name,
        type: d.type,
        adjustmentPct: d.adjustmentPct,
        daysOfWeek: d.type === "WEEKEND" ? d.daysOfWeek : [],
        startDate: d.startDate ? new Date(`${d.startDate}T00:00:00+05:30`) : null,
        endDate: d.endDate ? new Date(`${d.endDate}T00:00:00+05:30`) : null,
        category: d.category ? (d.category as "SUV") : null,
      },
    });
    await audit(u.id, "pricing.rule.create", "PricingRule", r.id, `Created "${d.name}" (${d.adjustmentPct > 0 ? "+" : ""}${d.adjustmentPct}%)`);
    revalidatePath("/admin/pricing");
    return { ok: true, message: "Pricing rule created. It applies to new quotes immediately." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function togglePricingRule(id: string) {
  return run(async () => {
    const u = await requireStaff("pricing:write");
    const r = await db.pricingRule.findUniqueOrThrow({ where: { id } });
    await db.pricingRule.update({ where: { id }, data: { isActive: !r.isActive } });
    await audit(u.id, "pricing.rule.toggle", "PricingRule", id, `${r.isActive ? "Paused" : "Activated"} "${r.name}"`);
    revalidatePath("/admin/pricing");
    return null;
  });
}

export async function deletePricingRule(id: string) {
  return run(async () => {
    const u = await requireStaff("pricing:write");
    const r = await db.pricingRule.delete({ where: { id } });
    await audit(u.id, "pricing.rule.delete", "PricingRule", id, `Deleted "${r.name}"`);
    revalidatePath("/admin/pricing");
    return null;
  });
}

export async function saveCouponAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const u = await requireStaff("pricing:write");
    const id = (form.get("id") as string) || null;
    const p = couponSchema.safeParse(Object.fromEntries(form));
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const d = p.data;
    if (d.validUntil <= d.validFrom) return { fieldErrors: { validUntil: "Expiry must be after the start date" } };
    if (d.discountType === "PERCENT" && d.value > 90) return { fieldErrors: { value: "Percentage discounts are capped at 90%" } };
    const clash = await db.coupon.findFirst({ where: { code: d.code, ...(id ? { id: { not: id } } : {}) } });
    if (clash) return { fieldErrors: { code: "This code already exists" } };
    const data = {
      code: d.code,
      title: d.title,
      description: d.description || null,
      discountType: d.discountType,
      value: d.value,
      maxDiscount: d.maxDiscount === "" || d.maxDiscount == null ? null : d.maxDiscount,
      minBookingAmount: d.minBookingAmount,
      // Date inputs are calendar days in IST: valid from 00:00 on the first day to 23:59:59 on the last.
      validFrom: new Date(d.validFrom.getTime() - 5.5 * 3600_000),
      validUntil: new Date(d.validUntil.getTime() + 18.5 * 3600_000 - 1000),
      usageLimit: d.usageLimit === "" || d.usageLimit == null ? null : d.usageLimit,
      perUserLimit: d.perUserLimit,
      firstBookingOnly: d.firstBookingOnly === "on",
      isPublic: d.isPublic === "on",
    };
    const c = id ? await db.coupon.update({ where: { id }, data }) : await db.coupon.create({ data });
    await audit(u.id, id ? "coupon.update" : "coupon.create", "Coupon", c.id, `${id ? "Updated" : "Created"} coupon ${c.code}`);
    revalidatePath("/admin/coupons");
    revalidatePath("/");
    return { ok: true, message: id ? "Coupon updated." : "Coupon created." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleCoupon(id: string) {
  return run(async () => {
    const u = await requireStaff("pricing:write");
    const c = await db.coupon.findUniqueOrThrow({ where: { id } });
    await db.coupon.update({ where: { id }, data: { isActive: !c.isActive } });
    await audit(u.id, "coupon.toggle", "Coupon", id, `${c.isActive ? "Paused" : "Activated"} ${c.code}`);
    revalidatePath("/admin/coupons");
    return null;
  });
}

export async function deleteCoupon(id: string) {
  return run(async () => {
    const u = await requireStaff("pricing:write");
    const c = await db.coupon.findUniqueOrThrow({ where: { id }, include: { _count: { select: { bookings: true } } } });
    if (c._count.bookings) {
      await db.coupon.update({ where: { id }, data: { isActive: false } });
    } else {
      await db.coupon.delete({ where: { id } });
    }
    await audit(u.id, "coupon.delete", "Coupon", id, `${c._count.bookings ? "Archived" : "Deleted"} ${c.code}`);
    revalidatePath("/admin/coupons");
    return { archived: c._count.bookings > 0 };
  });
}

/* ───────────── Staff ───────────── */

export async function createStaffAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const u = await requireAdmin();
    const p = z
      .object({
        name: z.string().trim().min(2).max(80),
        email: z.string().trim().toLowerCase().email(),
        title: z.string().trim().max(60).optional(),
        role: z.enum(["STAFF", "ADMIN"]),
        password: passwordSchema,
      })
      .safeParse(Object.fromEntries(form));
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const d = p.data;
    if (await db.user.findUnique({ where: { email: d.email } })) return { fieldErrors: { email: "Email already in use" } };
    const perms = form.getAll("permissions").map(String).filter((x) => (ALL_PERMISSIONS as string[]).includes(x));
    const s = await db.user.create({
      data: {
        name: d.name,
        email: d.email,
        role: d.role,
        passwordHash: await hashPassword(d.password),
        referralCode: `STF${randomInt(10000, 99999)}`,
        emailVerifiedAt: new Date(),
        adminProfile: { create: { title: d.title || null, permissions: perms } },
      },
    });
    await audit(u.id, "staff.create", "User", s.id, `Added ${d.role.toLowerCase()} ${d.name}`, { permissions: perms });
    revalidatePath("/admin/staff");
    return { ok: true, message: `${d.name} can now sign in at /admin/login.` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateStaffPermissions(userId: string, permissions: string[]) {
  return run(async () => {
    const u = await requireAdmin();
    const perms = permissions.filter((x) => (ALL_PERMISSIONS as string[]).includes(x));
    await db.adminProfile.upsert({ where: { userId }, create: { userId, permissions: perms }, update: { permissions: perms } });
    await audit(u.id, "staff.permissions", "User", userId, `Updated permissions`, { permissions: perms });
    revalidatePath("/admin/staff");
    return null;
  });
}

export async function setStaffStatus(userId: string, status: "ACTIVE" | "SUSPENDED") {
  return run(async () => {
    const u = await requireAdmin();
    if (userId === u.id) throw new AuthError("You can't deactivate your own account.", 403);
    const s = await db.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED") await db.session.deleteMany({ where: { userId } });
    await audit(u.id, "staff.status", "User", userId, `${status === "SUSPENDED" ? "Deactivated" : "Reactivated"} ${s.name}`);
    revalidatePath("/admin/staff");
    return null;
  });
}

/* ───────────── Settings & locations ───────────── */

export async function saveSettingsAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const u = await requireAdmin();
    const n = (k: string, min: number, max: number) => z.coerce.number().min(min).max(max).parse(form.get(k));
    const patch: Partial<AppSettings> = {
      taxRatePct: n("taxRatePct", 0, 40),
      doorstepFee: n("doorstepFee", 0, 10000),
      lateFeeMultiplier: n("lateFeeMultiplier", 1, 5),
      minHours: n("minHours", 1, 48),
      turnaroundMinutes: n("turnaroundMinutes", 0, 720),
      holdMinutes: n("holdMinutes", 5, 60),
      lateGraceMinutes: n("lateGraceMinutes", 0, 180),
      fuelChargePerPct: n("fuelChargePerPct", 0, 1000),
      maxRentalDays: n("maxRentalDays", 1, 365),
      minLeadMinutes: n("minLeadMinutes", 0, 1440),
      loyaltyPointsPer100: n("loyaltyPointsPer100", 0, 20),
      referralBonusPoints: n("referralBonusPoints", 0, 10000),
      manualApproval: form.get("manualApproval") === "on",
      requireVerifiedDocs: form.get("requireVerifiedDocs") === "on",
    };
    await saveSettings(patch);
    await audit(u.id, "settings.update", "Setting", "app", "Updated platform settings", patch as object);
    revalidatePath("/", "layout");
    return { ok: true, message: "Settings saved. New quotes use these values immediately." };
  } catch (e) {
    return { error: e instanceof z.ZodError ? "One of the values is out of range." : (e as Error).message };
  }
}

export async function addLocationAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const u = await requireAdmin();
    const p = z
      .object({
        city: z.string().trim().min(2).max(40),
        state: z.string().trim().min(2).max(40),
        name: z.string().trim().min(2).max(60),
        address: z.string().trim().min(8).max(200),
        latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal("")),
        longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal("")),
      })
      .safeParse(Object.fromEntries(form));
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const d = p.data;
    const city = await db.city.upsert({ where: { slug: slugify(d.city) }, create: { name: d.city, slug: slugify(d.city), state: d.state }, update: { isActive: true } });
    const loc = await db.vehicleLocation.create({
      data: { cityId: city.id, name: d.name, address: d.address, latitude: d.latitude === "" ? null : d.latitude ?? null, longitude: d.longitude === "" ? null : d.longitude ?? null },
    });
    await audit(u.id, "location.create", "VehicleLocation", loc.id, `Added hub ${d.name}, ${d.city}`);
    revalidatePath("/admin/settings");
    return { ok: true, message: "Pickup hub added." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleLocation(id: string) {
  return run(async () => {
    const u = await requireAdmin();
    const l = await db.vehicleLocation.findUniqueOrThrow({ where: { id } });
    await db.vehicleLocation.update({ where: { id }, data: { isActive: !l.isActive } });
    await audit(u.id, "location.toggle", "VehicleLocation", id, `${l.isActive ? "Disabled" : "Enabled"} hub ${l.name}`);
    revalidatePath("/admin/settings");
    return null;
  });
}

export async function markAllAdminNotificationsRead() {
  const u = await requireStaff();
  await db.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/admin", "layout");
}
