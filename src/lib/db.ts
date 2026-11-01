import "server-only";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Database client.
 *
 * - DATABASE_URL set   → regular PostgreSQL (Neon, Supabase, RDS…). This is the production setup.
 * - DATABASE_URL unset → DEMO DATABASE: an in-memory Postgres (PGlite) inside the server process,
 *   built from the real migrations and filled with demo data on first use. Zero setup, but data
 *   resets whenever the server restarts and isn't shared between server instances.
 *   To go live, add DATABASE_URL (then `prisma migrate deploy`) — nothing else changes.
 */

export const usingDemoDatabase = !process.env.DATABASE_URL?.trim();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function migrationSql() {
  const dir = path.join(process.cwd(), "prisma", "migrations");
  return readdirSync(dir)
    .filter((d) => !d.includes("."))
    .sort()
    .map((d) => readFileSync(path.join(dir, d, "migration.sql"), "utf8"))
    .join("\n");
}

// Process-wide: Next.js can load this module once per route bundle, so module-level state would
// give each route its own database. globalThis guarantees one shared demo database per process.
const demoState = globalThis as unknown as { __mydrivezDemoDb?: Promise<PrismaClient> | null };

function initDemoDatabase() {
  return (demoState.__mydrivezDemoDb ??= (async () => {
    const started = Date.now();
    // Imported lazily so deployments with a real database never load PGlite.
    const { PGlite } = await import("@electric-sql/pglite");
    const { btree_gist } = await import("@electric-sql/pglite/contrib/btree_gist");
    const { PrismaPGlite } = await import("pglite-prisma-adapter");
    const pg = new PGlite({ extensions: { btree_gist } });
    await pg.exec(migrationSql());
    // The adapter is typed against Prisma 6.10 driver-adapter-utils; it is runtime-compatible with 6.19 (see tests/demo-db.test.ts).
    const client = new PrismaClient({ adapter: new PrismaPGlite(pg) as never });
    const { seedDemoData } = await import("../../prisma/demo-data");
    await seedDemoData(client, () => {});
    console.info(`[demo-db] in-memory demo database ready in ${Date.now() - started}ms`);
    return client;
  })().catch((e) => {
    demoState.__mydrivezDemoDb = null; // retry on the next request
    throw e;
  }));
}

type AnyFn = (...a: unknown[]) => Promise<unknown>;

/** A PrismaClient look-alike whose calls wait for the demo database before running. */
function createDemoClient(): PrismaClient {
  const run = (fn: (c: Record<string, unknown>) => Promise<unknown>) => initDemoDatabase().then((c) => fn(c as unknown as Record<string, unknown>));
  return new Proxy({} as PrismaClient, {
    get(_, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined;
      // Array transactions: items are already running; await them together (no atomicity in demo mode).
      if (prop === "$transaction")
        return (arg: unknown, opts?: unknown) =>
          Array.isArray(arg) ? Promise.all(arg) : run((c) => (c.$transaction as AnyFn)(arg, opts));
      if (prop.startsWith("$")) return (...a: unknown[]) => run((c) => (c[prop] as AnyFn)(...a));
      return new Proxy(
        {},
        { get: (__, op) => (typeof op === "string" ? (...a: unknown[]) => run((c) => ((c[prop] as Record<string, AnyFn>)[op] as AnyFn)(...a)) : undefined) },
      );
    },
  });
}

export const db =
  globalForPrisma.prisma ??
  (usingDemoDatabase
    ? createDemoClient()
    : new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] }));

// One client per process (also in production) — avoids duplicate pools / demo databases per route bundle.
globalForPrisma.prisma = db;
