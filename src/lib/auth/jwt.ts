// Edge-safe token helpers (used by middleware and server code). No Node-only imports here.
// Deep imports keep jose's JWE/deflate code (DecompressionStream) out of the Edge middleware bundle.
import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const SESSION_COOKIE = "mdz_session";

export type SessionClaims = {
  sid: string;
  uid: string;
  role: "CUSTOMER" | "STAFF" | "ADMIN";
};

const DEV_SECRET = "dev-only-insecure-secret-change-me-please-32chars";

/** Checked per call (never at import) so builds work without secrets, but production never falls back to the dev key. */
function key() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET is not set. Add it in your hosting environment variables (32+ random characters).");
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  if (secret.length < 32 && process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET is too short. Use at least 32 random characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(claims: SessionClaims, expiresAt: Date) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .setIssuer("mydrivez")
    .sign(key());
}

export async function readSessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: "mydrivez", algorithms: ["HS256"] });
    if (typeof payload.sid !== "string" || typeof payload.uid !== "string" || typeof payload.role !== "string") return null;
    return { sid: payload.sid, uid: payload.uid, role: payload.role as SessionClaims["role"] };
  } catch {
    return null;
  }
}
