import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import type { TokenType } from "@prisma/client";
import { db } from "@/lib/db";

export function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

/** 6-digit OTP for email verification. Only the hash is stored. */
export async function issueOtp(userId: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.verificationToken.deleteMany({ where: { userId, type: "EMAIL_VERIFY" } });
  await db.verificationToken.create({
    data: { userId, type: "EMAIL_VERIFY", tokenHash: sha256(`${userId}:${code}`), expiresAt: new Date(Date.now() + 15 * 60_000) },
  });
  return code;
}

export async function consumeOtp(userId: string, code: string) {
  const token = await db.verificationToken.findFirst({
    where: { userId, type: "EMAIL_VERIFY", usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!token || token.expiresAt < new Date()) return { ok: false as const, error: "Code expired. Request a new one." };
  if (token.attempts >= 5) return { ok: false as const, error: "Too many attempts. Request a new code." };
  if (token.tokenHash !== sha256(`${userId}:${code}`)) {
    await db.verificationToken.update({ where: { id: token.id }, data: { attempts: { increment: 1 } } });
    return { ok: false as const, error: "That code isn't right." };
  }
  await db.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return { ok: true as const };
}

/** Long random link token for password reset. */
export async function issueLinkToken(userId: string, type: TokenType, ttlMinutes: number) {
  const raw = randomBytes(32).toString("base64url");
  await db.verificationToken.deleteMany({ where: { userId, type } });
  await db.verificationToken.create({
    data: { userId, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
  });
  return raw;
}

export async function consumeLinkToken(raw: string, type: TokenType) {
  const token = await db.verificationToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!token || token.type !== type || token.usedAt || token.expiresAt < new Date()) return null;
  await db.verificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  return token.userId;
}

export function randomCode(prefix: string, len = 6) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += alphabet[randomInt(0, alphabet.length)];
  return `${prefix}-${s}`;
}
