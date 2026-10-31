"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthError, requireStaff } from "@/lib/auth/session";
import { audit } from "@/lib/audit";
import { storeFile, UploadError } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { fieldErrors, vehicleSchema, type ActionState } from "@/lib/validators";

type R<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<R<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AuthError || e instanceof UploadError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(e);
    return { ok: false, error: "Something went wrong." };
  }
}

function refreshFleet(id?: string) {
  revalidatePath("/admin/fleet");
  if (id) revalidatePath(`/admin/fleet/${id}`);
  revalidatePath("/cars");
  revalidatePath("/");
}

async function uniqueSlug(base: string, excludeId?: string) {
  let slug = base;
  for (let i = 2; await db.vehicle.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } }); i++) slug = `${base}-${i}`;
  return slug;
}

export async function saveVehicleAction(_: ActionState, form: FormData): Promise<ActionState> {
  let user;
  try {
    user = await requireStaff("fleet:write");
  } catch (e) {
    return { error: (e as Error).message };
  }
  const id = (form.get("id") as string) || null;
  const parsed = vehicleSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: "Please fix the highlighted fields." };
  const d = parsed.data;
  if (d.weeklyRate > d.dailyRate * 7) return { fieldErrors: { weeklyRate: "Weekly rate should not exceed 7× the daily rate" } };
  if (d.monthlyRate > d.dailyRate * 30) return { fieldErrors: { monthlyRate: "Monthly rate should not exceed 30× the daily rate" } };
  const dupe = await db.vehicle.findFirst({ where: { registrationNumber: d.registrationNumber, ...(id ? { id: { not: id } } : {}) } });
  if (dupe) return { fieldErrors: { registrationNumber: "A vehicle with this registration already exists" } };

  const features = (d.features ?? "")
    .split(/[\n,]/)
    .map((f) => f.trim())
    .filter(Boolean)
    .slice(0, 30);
  const data = {
    brand: d.brand,
    model: d.model,
    variant: d.variant || null,
    registrationNumber: d.registrationNumber,
    year: d.year,
    category: d.category,
    fuelType: d.fuelType,
    transmission: d.transmission,
    seats: d.seats,
    engine: d.engine || null,
    mileage: d.mileage || null,
    color: d.color || null,
    description: d.description,
    hourlyRate: d.hourlyRate,
    dailyRate: d.dailyRate,
    weeklyRate: d.weeklyRate,
    monthlyRate: d.monthlyRate,
    securityDeposit: d.securityDeposit,
    includedKmPerDay: d.includedKmPerDay,
    extraKmCharge: d.extraKmCharge,
    fuelPolicy: d.fuelPolicy || undefined,
    locationId: d.locationId,
    isFeatured: d.isFeatured === "on",
  };

  let vehicleId = id;
  if (id) {
    const current = await db.vehicle.findUniqueOrThrow({ where: { id } });
    // Don't let the form override system-managed RENTED/BOOKED states.
    const status = current.status === "RENTED" || current.status === "BOOKED" ? current.status : d.status;
    await db.vehicle.update({
      where: { id },
      data: { ...data, status, slug: await uniqueSlug(slugify(`${d.brand} ${d.model} ${d.variant ?? ""}`), id), features: { deleteMany: {}, create: features.map((name) => ({ name })) } },
    });
    await audit(user.id, "vehicle.update", "Vehicle", id, `Updated ${d.brand} ${d.model} (${d.registrationNumber})`, { dailyRate: d.dailyRate });
  } else {
    const v = await db.vehicle.create({
      data: { ...data, status: d.status, slug: await uniqueSlug(slugify(`${d.brand} ${d.model} ${d.variant ?? ""}`)), features: { create: features.map((name) => ({ name })) } },
    });
    vehicleId = v.id;
    await audit(user.id, "vehicle.create", "Vehicle", v.id, `Added ${d.brand} ${d.model} (${d.registrationNumber})`);
  }

  // Optional images submitted with the form
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length) {
    const existing = await db.vehicleImage.count({ where: { vehicleId: vehicleId! } });
    for (const [i, f] of files.slice(0, 8).entries()) {
      try {
        const s = await storeFile(f, { ownerId: user.id, kind: "VEHICLE_IMAGE" });
        await db.vehicleImage.create({ data: { vehicleId: vehicleId!, url: s.url, alt: `${d.brand} ${d.model}`, sortOrder: existing + i } });
      } catch (e) {
        if (e instanceof UploadError) return { error: `Saved, but an image failed: ${e.message}` };
        throw e;
      }
    }
  }
  refreshFleet(vehicleId!);
  if (!id) redirect(`/admin/fleet/${vehicleId}?created=1`);
  return { ok: true, message: "Vehicle saved." };
}

export async function setVehicleStatus(id: string, status: "AVAILABLE" | "MAINTENANCE" | "INACTIVE") {
  return run(async () => {
    const u = await requireStaff("fleet:write");
    const v = await db.vehicle.findUniqueOrThrow({ where: { id } });
    if (v.status === "RENTED" && status !== "AVAILABLE") throw new AuthError("This car is currently on a trip. Record its return first.", 403);
    await db.vehicle.update({ where: { id }, data: { status } });
    await audit(u.id, "vehicle.status", "Vehicle", id, `Set ${v.brand} ${v.model} to ${status}`);
    refreshFleet(id);
    return null;
  });
}

export async function deleteVehicle(id: string) {
  return run(async () => {
    const u = await requireStaff("fleet:write");
    const v = await db.vehicle.findUniqueOrThrow({ where: { id }, include: { _count: { select: { bookings: true } } } });
    if (v._count.bookings > 0) {
      // Keep history intact — retire instead of hard-deleting.
      await db.vehicle.update({ where: { id }, data: { status: "INACTIVE", isFeatured: false } });
      await audit(u.id, "vehicle.retire", "Vehicle", id, `Retired ${v.brand} ${v.model} (has booking history)`);
      refreshFleet(id);
      return { retired: true };
    }
    await db.vehicle.delete({ where: { id } });
    await audit(u.id, "vehicle.delete", "Vehicle", id, `Deleted ${v.brand} ${v.model} (${v.registrationNumber})`);
    refreshFleet();
    return { retired: false };
  });
}

export async function updateVehicleRates(id: string, rates: { hourlyRate: number; dailyRate: number; weeklyRate: number; monthlyRate: number; securityDeposit: number; extraKmCharge: number }) {
  return run(async () => {
    const u = await requireStaff("pricing:write");
    const s = z
      .object({
        hourlyRate: z.number().int().positive(),
        dailyRate: z.number().int().positive(),
        weeklyRate: z.number().int().positive(),
        monthlyRate: z.number().int().positive(),
        securityDeposit: z.number().int().min(0),
        extraKmCharge: z.number().int().min(0),
      })
      .parse(rates);
    const before = await db.vehicle.findUniqueOrThrow({ where: { id } });
    await db.vehicle.update({ where: { id }, data: s });
    await audit(u.id, "vehicle.pricing", "Vehicle", id, `Updated pricing for ${before.brand} ${before.model}`, { before: { daily: before.dailyRate }, after: { daily: s.dailyRate } });
    refreshFleet(id);
    revalidatePath("/admin/pricing");
    return null;
  });
}

export async function deleteVehicleImage(imageId: string) {
  return run(async () => {
    const u = await requireStaff("fleet:write");
    const img = await db.vehicleImage.delete({ where: { id: imageId } });
    await audit(u.id, "vehicle.image.delete", "Vehicle", img.vehicleId, "Removed a photo");
    refreshFleet(img.vehicleId);
    return null;
  });
}

export async function makePrimaryImage(imageId: string) {
  return run(async () => {
    await requireStaff("fleet:write");
    const img = await db.vehicleImage.findUniqueOrThrow({ where: { id: imageId } });
    const all = await db.vehicleImage.findMany({ where: { vehicleId: img.vehicleId }, orderBy: { sortOrder: "asc" } });
    const ordered = [img, ...all.filter((a) => a.id !== img.id)];
    await db.$transaction(ordered.map((a, i) => db.vehicleImage.update({ where: { id: a.id }, data: { sortOrder: i } })));
    refreshFleet(img.vehicleId);
    return null;
  });
}

const maintSchema = z.object({
  vehicleId: z.string(),
  title: z.string().trim().min(3).max(100),
  description: z.string().trim().max(500).optional(),
  scheduledFor: z.coerce.date(),
  cost: z.coerce.number().int().min(0).optional().or(z.literal("")),
  odometer: z.coerce.number().int().min(0).optional().or(z.literal("")),
  blockVehicle: z.string().optional(),
});

export async function addMaintenanceAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const u = await requireStaff("fleet:write");
    const p = maintSchema.safeParse(Object.fromEntries(form));
    if (!p.success) return { fieldErrors: fieldErrors(p.error) };
    const d = p.data;
    const v = await db.vehicle.findUniqueOrThrow({ where: { id: d.vehicleId } });
    await db.maintenanceRecord.create({
      data: { vehicleId: d.vehicleId, title: d.title, description: d.description || null, scheduledFor: d.scheduledFor, cost: d.cost === "" ? null : d.cost ?? null, odometer: d.odometer === "" ? null : d.odometer ?? null },
    });
    if (d.blockVehicle === "on" && v.status === "AVAILABLE") await db.vehicle.update({ where: { id: v.id }, data: { status: "MAINTENANCE" } });
    await audit(u.id, "maintenance.create", "Vehicle", v.id, `Scheduled "${d.title}" for ${v.brand} ${v.model}`);
    revalidatePath("/admin/maintenance");
    refreshFleet(v.id);
    return { ok: true, message: "Maintenance scheduled." };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateMaintenanceStatus(id: string, status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED", cost?: number) {
  return run(async () => {
    const u = await requireStaff("fleet:write");
    const m = await db.maintenanceRecord.update({
      where: { id },
      data: { status, completedAt: status === "COMPLETED" ? new Date() : null, ...(cost != null ? { cost } : {}) },
      include: { vehicle: true },
    });
    if (status === "IN_PROGRESS" && m.vehicle.status === "AVAILABLE") await db.vehicle.update({ where: { id: m.vehicleId }, data: { status: "MAINTENANCE" } });
    if (status === "COMPLETED" || status === "CANCELLED") {
      const open = await db.maintenanceRecord.count({ where: { vehicleId: m.vehicleId, status: "IN_PROGRESS" } });
      if (!open && m.vehicle.status === "MAINTENANCE") await db.vehicle.update({ where: { id: m.vehicleId }, data: { status: "AVAILABLE" } });
    }
    await audit(u.id, "maintenance.status", "Vehicle", m.vehicleId, `${m.title}: ${status}`);
    revalidatePath("/admin/maintenance");
    refreshFleet(m.vehicleId);
    return null;
  });
}

export async function upsertVehicleDocument(vehicleId: string, type: "INSURANCE" | "PUC" | "REGISTRATION" | "FITNESS" | "PERMIT", number: string, expiresAt: string) {
  return run(async () => {
    const u = await requireStaff("fleet:write");
    const date = new Date(expiresAt);
    if (Number.isNaN(date.getTime())) throw new AuthError("Enter a valid expiry date.", 403);
    await db.vehicleDocument.upsert({
      where: { vehicleId_type: { vehicleId, type } },
      create: { vehicleId, type, number: number || null, expiresAt: date },
      update: { number: number || null, expiresAt: date },
    });
    await audit(u.id, "vehicle.document", "Vehicle", vehicleId, `Updated ${type} (expires ${expiresAt})`);
    refreshFleet(vehicleId);
    return null;
  });
}
