import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { SESSION_COOKIE, readSessionToken, signSession } from "./jwt";
import { hasPermission, type Permission } from "./permissions";

const DAY = 86_400_000;

export async function createSession(user: { id: string; role: "CUSTOMER" | "STAFF" | "ADMIN" }, remember: boolean) {
  const expiresAt = new Date(Date.now() + (remember ? 30 : 1) * DAY);
  const h = await headers();
  const session = await db.session.create({
    data: {
      userId: user.id,
      expiresAt,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
    },
  });
  const token = await signSession({ sid: session.id, uid: user.id, role: user.role }, expiresAt);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: remember ? expiresAt : undefined,
  });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
}

export async function destroySession() {
  const jar = await cookies();
  const claims = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (claims) await db.session.deleteMany({ where: { id: claims.sid } });
  jar.delete(SESSION_COOKIE);
}

/**
 * Resolve the signed-in user from the DB on every request. The JWT only identifies the
 * session; revocation, suspension and role changes take effect immediately.
 */
export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const claims = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const session = await db.session.findUnique({
    where: { id: claims.sid },
    include: { user: { include: { adminProfile: true } } },
  });
  if (!session || session.expiresAt < new Date() || session.userId !== claims.uid) return null;
  const u = session.user;
  if (u.status !== "ACTIVE") return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    avatarUrl: u.avatarUrl,
    emailVerified: Boolean(u.emailVerifiedAt),
    permissions: u.adminProfile?.permissions ?? [],
    isDemo: u.isDemo,
  };
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403,
  ) {
    super(message);
  }
}

/** For server components/pages: redirect when not allowed. */
export async function requireCustomerPage(next = "/dashboard") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (user.role !== "CUSTOMER") redirect("/admin");
  return user;
}

export async function requireStaffPage(perm?: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role === "CUSTOMER") redirect("/dashboard");
  if (perm && !hasPermission(user.role, user.permissions, perm)) redirect("/admin?denied=1");
  return user;
}

/** For server actions / route handlers: throw instead of redirecting. */
export async function requireCustomer() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in to continue.", 401);
  if (user.role !== "CUSTOMER") throw new AuthError("This action is only available to customers.", 403);
  return user;
}

export async function requireStaff(perm?: Permission) {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in.", 401);
  if (user.role === "CUSTOMER") throw new AuthError("Forbidden.", 403);
  if (perm && !hasPermission(user.role, user.permissions, perm)) throw new AuthError("You don't have permission for this action.", 403);
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in.", 401);
  if (user.role !== "ADMIN") throw new AuthError("Only administrators can do this.", 403);
  return user;
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}
