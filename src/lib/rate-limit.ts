import "server-only";
import { db } from "./db";

/**
 * Fixed-window rate limiter backed by Postgres so limits hold across serverless instances.
 * Returns true when the request is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const now = new Date();
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${windowStart})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."windowStart" = ${windowStart} THEN "RateLimit"."count" + 1 ELSE 1 END,
      "windowStart" = ${windowStart}
    RETURNING "count"`;
  return (rows[0]?.count ?? 0) <= limit;
}
