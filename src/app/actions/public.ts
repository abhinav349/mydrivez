"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clientIp, getCurrentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { notifyAdmins } from "@/lib/notify";
import { contactSchema, fieldErrors, type ActionState } from "@/lib/validators";

export async function subscribeNewsletter(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 160) return { error: "Enter a valid email address." };
  if (!(await rateLimit(`newsletter:${await clientIp()}`, 5, 3600))) return { error: "Please try again later." };
  await db.newsletterSubscriber.upsert({ where: { email }, create: { email }, update: {} });
  return { ok: true, message: "You're on the list. Watch your inbox for weekend deals." };
}

export async function submitContact(_: ActionState, form: FormData): Promise<ActionState> {
  if (form.get("website")) return { ok: true, message: "Thanks!" }; // honeypot
  const parsed = contactSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!(await rateLimit(`contact:${await clientIp()}`, 5, 3600))) return { error: "Too many messages. Please try again later." };
  await db.contactMessage.create({ data: parsed.data });
  await notifyAdmins({ type: "CONTACT", title: `New enquiry: ${parsed.data.subject}`, body: `${parsed.data.name} <${parsed.data.email}>`, link: "/admin/support?tab=enquiries" });
  return { ok: true, message: "Thanks for reaching out. Our team will get back to you within 2 working hours." };
}

/** Toggle a car in the wishlist. Returns the new state. */
export async function toggleWishlist(vehicleId: string): Promise<{ ok: boolean; saved?: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "login" };
  if (user.role !== "CUSTOMER") return { ok: false, error: "Only customers can save cars." };
  const existing = await db.wishlist.findUnique({ where: { userId_vehicleId: { userId: user.id, vehicleId } } });
  if (existing) {
    await db.wishlist.delete({ where: { id: existing.id } });
  } else {
    const v = await db.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } });
    if (!v) return { ok: false, error: "Car not found." };
    await db.wishlist.create({ data: { userId: user.id, vehicleId } });
  }
  revalidatePath("/dashboard/wishlist");
  return { ok: true, saved: !existing };
}
