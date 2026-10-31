import "server-only";
import { db } from "./db";
import { env } from "./env";
import { sendEmail } from "./email";

/**
 * Notification hub. Every notification lands in the in-app center; optional channels
 * (email today, SMS/WhatsApp via adapters) are fanned out best-effort and never block the caller.
 */

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  channels?: ("email" | "sms" | "whatsapp")[];
};

type ChannelAdapter = (user: { email: string; phone: string | null; name: string }, n: NotifyInput) => Promise<void>;

const adapters: Record<"email" | "sms" | "whatsapp", ChannelAdapter> = {
  email: async (user, n) => {
    await sendEmail({
      to: user.email,
      subject: n.title,
      heading: n.title,
      body: `<p>Hi ${user.name.split(" ")[0]},</p><p>${n.body}</p>`,
      cta: n.link ? { label: "Open MyDrivez", url: `${env.appUrl}${n.link}` } : undefined,
    });
  },
  // Integration points: wire Twilio / Gupshup / Meta Cloud API here once credentials exist.
  sms: async (user, n) => {
    if (!env.sms.twilioSid || !user.phone) return;
    await twilioSend(user.phone, `${n.title}: ${n.body}`, env.sms.twilioFrom);
  },
  whatsapp: async (user, n) => {
    if (!env.sms.twilioSid || !env.sms.whatsappFrom || !user.phone) return;
    await twilioSend(`whatsapp:${user.phone}`, `*${n.title}*\n${n.body}`, `whatsapp:${env.sms.whatsappFrom}`);
  },
};

async function twilioSend(to: string, body: string, from?: string) {
  if (!from) return;
  const auth = Buffer.from(`${env.sms.twilioSid}:${env.sms.twilioToken}`).toString("base64");
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.sms.twilioSid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  }).catch((e) => console.error("[sms] failed", e));
}

export async function notify(n: NotifyInput) {
  await db.notification.create({
    data: { userId: n.userId, type: n.type, title: n.title, body: n.body, link: n.link },
  });
  if (n.channels?.length) {
    const user = await db.user.findUnique({ where: { id: n.userId }, select: { email: true, phone: true, name: true } });
    if (user) {
      await Promise.allSettled(n.channels.map((c) => adapters[c](user, n)));
    }
  }
}

/** Fan out to every admin and staff member. */
export async function notifyAdmins(n: Omit<NotifyInput, "userId">) {
  const admins = await db.user.findMany({ where: { role: { in: ["ADMIN", "STAFF"] }, status: "ACTIVE" }, select: { id: true } });
  if (!admins.length) return;
  await db.notification.createMany({
    data: admins.map((a) => ({ userId: a.id, type: n.type, title: n.title, body: n.body, link: n.link })),
  });
}
