"use server";

import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { env, emailEnabled } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getCurrentUser, clientIp } from "@/lib/auth/session";
import { consumeLinkToken, consumeOtp, issueLinkToken, issueOtp } from "@/lib/auth/tokens";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { notify, notifyAdmins } from "@/lib/notify";
import { safeNext } from "@/lib/utils";
import { fieldErrors, loginSchema, registerSchema, resetSchema, type ActionState } from "@/lib/validators";

// Constant-time-ish dummy hash so unknown accounts take as long as known ones.
const DUMMY_HASH = "$2b$12$84BBV4/6h82SXTtcXp2Tau2tuiBTWIgpCZ6rzDJwwlxJR0uckodK.";


async function makeReferralCode(name: string) {
  const stem = name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 5).padEnd(3, "X");
  for (;;) {
    const code = `${stem}${randomInt(100, 999)}`;
    if (!(await db.user.findUnique({ where: { referralCode: code } }))) return code;
  }
}

async function sendOtpEmail(user: { id: string; email: string; name: string }) {
  const code = await issueOtp(user.id);
  await sendEmail({
    to: user.email,
    subject: `${code} is your MyDrivez verification code`,
    heading: "Verify your email",
    body: `<p>Hi ${user.name.split(" ")[0]}, use this code to verify your email:</p><p style="font-size:30px;font-weight:700;letter-spacing:.3em;color:#101820">${code}</p><p>It expires in 15 minutes.</p>`,
  });
  return code;
}

export async function registerAction(_: ActionState, form: FormData): Promise<ActionState> {
  if (!(await rateLimit(`register:${await clientIp()}`, 8, 3600))) return { error: "Too many sign-up attempts. Please try again later." };
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const [byEmail, byPhone] = await Promise.all([
    db.user.findUnique({ where: { email: d.email } }),
    db.user.findUnique({ where: { phone: d.phone } }),
  ]);
  if (byEmail) return { fieldErrors: { email: "An account with this email already exists." } };
  if (byPhone) return { fieldErrors: { phone: "This mobile number is already registered." } };

  let referredById: string | null = null;
  if (d.referralCode) {
    const ref = await db.user.findUnique({ where: { referralCode: d.referralCode } });
    if (!ref) return { fieldErrors: { referralCode: "We couldn't find that referral code." } };
    referredById = ref.id;
  }

  const user = await db.user.create({
    data: {
      name: d.name,
      email: d.email,
      phone: d.phone,
      passwordHash: await hashPassword(d.password),
      role: "CUSTOMER",
      referralCode: await makeReferralCode(d.name),
      referredById,
      customerProfile: { create: {} },
    },
  });

  await sendOtpEmail(user);
  await notify({ userId: user.id, type: "WELCOME", title: "Welcome to MyDrivez 👋", body: "Your account is ready. Verify your email and upload your licence to book faster.", link: "/dashboard/documents" });
  await notifyAdmins({ type: "NEW_CUSTOMER", title: "New customer registered", body: `${user.name} (${user.email}) just signed up.`, link: `/admin/customers/${user.id}` });

  await createSession(user, false);
  redirect(`/verify-email?next=${encodeURIComponent(safeNext(form.get("next"), "/dashboard"))}`);
}

export async function loginAction(_: ActionState, form: FormData): Promise<ActionState> {
  return doLogin(form, "customer");
}

export async function adminLoginAction(_: ActionState, form: FormData): Promise<ActionState> {
  return doLogin(form, "admin");
}

async function doLogin(form: FormData, portal: "customer" | "admin"): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const { identifier, password, remember } = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimit(`login:${ip}`, 20, 900)) || !(await rateLimit(`login:${identifier.toLowerCase()}`, 8, 900)))
    return { error: "Too many sign-in attempts. Please wait 15 minutes and try again." };

  const isEmail = identifier.includes("@");
  const phone = identifier.replace(/[\s-]/g, "");
  const user = await db.user.findFirst({
    where: isEmail ? { email: identifier.toLowerCase() } : { phone: phone.startsWith("+91") ? phone : `+91${phone}` },
  });
  const ok = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) return { error: "Incorrect email/mobile or password." };
  if (user.status === "SUSPENDED") return { error: "This account is suspended. Please contact support." };

  if (portal === "admin" && user.role === "CUSTOMER") return { error: "This portal is for MyDrivez staff only." };
  if (portal === "customer" && user.role !== "CUSTOMER") return { error: "Staff accounts sign in through the admin portal at /admin/login." };

  await createSession(user, remember === "on");
  redirect(safeNext(form.get("next"), portal === "admin" ? "/admin" : "/dashboard"));
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  redirect(user && user.role !== "CUSTOMER" ? "/admin/login" : "/");
}

export async function verifyOtpAction(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { fieldErrors: { code: "Enter the 6-digit code" } };
  const res = await consumeOtp(user.id, code);
  if (!res.ok) return { fieldErrors: { code: res.error } };
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  redirect(safeNext(form.get("next"), "/dashboard"));
}

export async function resendOtpAction(): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." };
  if (!(await rateLimit(`otp:${user.id}`, 3, 600))) return { error: "Please wait a few minutes before requesting another code." };
  const code = await sendOtpEmail(user);
  // Demo mode with no email provider: surface the code on screen so the flow can be tested.
  if (!emailEnabled && env.demoMode) return { ok: true, message: `Demo mode: your code is ${code}` };
  return { ok: true, message: "A new code is on its way." };
}

export async function forgotPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { fieldErrors: { email: "Enter a valid email" } };
  if (!(await rateLimit(`forgot:${await clientIp()}`, 5, 900))) return { error: "Too many requests. Try again later." };
  const user = await db.user.findUnique({ where: { email } });
  let demoLink: string | undefined;
  if (user && user.status === "ACTIVE") {
    const token = await issueLinkToken(user.id, "PASSWORD_RESET", 30);
    const url = `${env.appUrl}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: "Reset your MyDrivez password",
      heading: "Reset your password",
      body: "<p>Someone (hopefully you) asked to reset your password. This link expires in 30 minutes.</p>",
      cta: { label: "Choose a new password", url },
    });
    if (!emailEnabled && env.demoMode) demoLink = `/reset-password?token=${token}`;
  }
  // Same response whether or not the account exists (no user enumeration).
  return { ok: true, message: "If an account exists for that email, a reset link has been sent.", data: demoLink ? { demoLink } : undefined };
}

export async function resetPasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const userId = await consumeLinkToken(parsed.data.token, "PASSWORD_RESET");
  if (!userId) return { error: "This reset link is invalid or has expired. Request a new one." };
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  await db.session.deleteMany({ where: { userId } }); // sign out everywhere
  await notify({ userId, type: "SECURITY", title: "Password changed", body: "Your password was reset. If this wasn't you, contact support immediately." });
  redirect("/login?reset=1");
}
