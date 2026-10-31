"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCustomer, getCurrentUser } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { storeFile, UploadError } from "@/lib/storage";
import { rateLimit } from "@/lib/rate-limit";
import { notify, notifyAdmins } from "@/lib/notify";
import { randomCode } from "@/lib/auth/tokens";
import { changePasswordSchema, fieldErrors, profileSchema, ticketSchema, type ActionState } from "@/lib/validators";

export async function uploadDocumentAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await requireCustomer();
    if (!(await rateLimit(`upload:${user.id}`, 20, 3600))) return { error: "Upload limit reached. Try again later." };
    const type = String(form.get("type"));
    if (!["DRIVING_LICENSE", "GOVERNMENT_ID", "OTHER"].includes(type)) return { error: "Choose a document type." };
    const documentNumber = String(form.get("documentNumber") ?? "").trim().toUpperCase().slice(0, 30);
    if (type !== "OTHER" && documentNumber.length < 4) return { fieldErrors: { documentNumber: "Enter the document number" } };
    const expiry = String(form.get("expiresAt") ?? "");
    const stored = await storeFile(form.get("file") as File, { ownerId: user.id, kind: "DOCUMENT" });
    // Replace any non-verified document of the same type.
    await db.customerDocument.deleteMany({ where: { userId: user.id, type: type as "OTHER", status: { not: "VERIFIED" } } });
    await db.customerDocument.create({
      data: {
        userId: user.id,
        type: type as "DRIVING_LICENSE",
        documentNumber: documentNumber || null,
        fileId: stored.id,
        expiresAt: expiry ? new Date(expiry) : null,
      },
    });
    await notifyAdmins({ type: "DOCUMENT_UPLOADED", title: "Document awaiting verification", body: `${user.name} uploaded a ${type.replace("_", " ").toLowerCase()}.`, link: "/admin/verifications" });
    revalidatePath("/dashboard/documents");
    return { ok: true, message: "Uploaded. We'll verify it within a few hours." };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
}

export async function updateProfileAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCustomer();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  const clash = await db.user.findFirst({ where: { phone: d.phone, id: { not: user.id } } });
  if (clash) return { fieldErrors: { phone: "This number is linked to another account." } };
  await db.user.update({
    where: { id: user.id },
    data: {
      name: d.name,
      phone: d.phone,
      customerProfile: {
        upsert: {
          create: {},
          update: {
            dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
            addressLine1: d.addressLine1 || null,
            addressLine2: d.addressLine2 || null,
            city: d.city || null,
            state: d.state || null,
            pincode: d.pincode || null,
            licenseNumber: d.licenseNumber || null,
            licenseExpiry: d.licenseExpiry ? new Date(d.licenseExpiry) : null,
            licenseState: d.licenseState || null,
            emergencyName: d.emergencyName || null,
            emergencyPhone: d.emergencyPhone || null,
          },
        },
      },
    },
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved." };
}

export async function uploadAvatarAction(_: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await requireCustomer();
    if (!(await rateLimit(`upload:${user.id}`, 20, 3600))) return { error: "Upload limit reached." };
    const stored = await storeFile(form.get("file") as File, { ownerId: user.id, kind: "AVATAR" });
    await db.user.update({ where: { id: user.id }, data: { avatarUrl: stored.url } });
    revalidatePath("/dashboard", "layout");
    return { ok: true, message: "Photo updated." };
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Please sign in again." };
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) return { fieldErrors: { currentPassword: "Current password is incorrect" } };
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await notify({ userId: me.id, type: "SECURITY", title: "Password changed", body: "Your password was changed. If this wasn't you, contact support immediately." });
  return { ok: true, message: "Password updated." };
}

export async function markNotificationsReadAction(ids?: string[]) {
  const me = await getCurrentUser();
  if (!me) return;
  await db.notification.updateMany({ where: { userId: me.id, readAt: null, ...(ids ? { id: { in: ids } } : {}) }, data: { readAt: new Date() } });
  revalidatePath("/dashboard", "layout");
  revalidatePath("/admin", "layout");
}

export async function createTicketAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCustomer();
  if (!(await rateLimit(`ticket:${user.id}`, 6, 3600))) return { error: "You've opened several tickets recently. Please wait a bit." };
  const parsed = ticketSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;
  let bookingId: string | null = null;
  if (d.bookingId) {
    const b = await db.booking.findFirst({ where: { id: d.bookingId, userId: user.id }, select: { id: true } });
    bookingId = b?.id ?? null;
  }
  const t = await db.supportTicket.create({
    data: {
      code: randomCode("TKT", 5),
      userId: user.id,
      subject: d.subject,
      category: d.category,
      priority: d.priority,
      bookingId,
      messages: { create: { authorId: user.id, body: d.message } },
    },
  });
  await notifyAdmins({ type: "NEW_TICKET", title: `New ${d.priority.toLowerCase()} priority ticket`, body: `${user.name}: ${d.subject}`, link: `/admin/support/${t.id}` });
  revalidatePath("/dashboard/support");
  return { ok: true, message: "Ticket created", data: { id: t.id } };
}

export async function replyTicketAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireCustomer();
  const ticketId = String(form.get("ticketId"));
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 2) return { error: "Write a message first." };
  const t = await db.supportTicket.findFirst({ where: { id: ticketId, userId: user.id } });
  if (!t) return { error: "Ticket not found." };
  if (t.status === "CLOSED") return { error: "This ticket is closed. Open a new one if you still need help." };
  await db.supportMessage.create({ data: { ticketId, authorId: user.id, body: body.slice(0, 3000) } });
  await db.supportTicket.update({ where: { id: ticketId }, data: { status: "OPEN" } });
  if (t.assignedToId) await notify({ userId: t.assignedToId, type: "TICKET_REPLY", title: `Customer replied on ${t.code}`, body: body.slice(0, 120), link: `/admin/support/${t.id}` });
  revalidatePath(`/dashboard/support/${ticketId}`);
  return { ok: true };
}
