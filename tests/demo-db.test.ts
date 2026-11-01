// Verifies the zero-setup demo database: PGlite + real migration + demo seed behave like Postgres.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../prisma/demo-data";

test("demo database: migrate, seed and query", { timeout: 120_000 }, async () => {
  const dir = path.join(process.cwd(), "prisma", "migrations");
  const sql = readdirSync(dir)
    .filter((d) => !d.includes("."))
    .map((d) => readFileSync(path.join(dir, d, "migration.sql"), "utf8"))
    .join("\n");
  const started = Date.now();
  const pg = new PGlite({ extensions: { btree_gist } });
  await pg.exec(sql);
  const db = new PrismaClient({ adapter: new PrismaPGlite(pg) as never });
  const counts = await seedDemoData(db, () => {});
  console.log("seeded in", Date.now() - started, "ms", counts);
  assert.equal(counts.vehicles, 15);
  assert.ok(counts.bookings > 300);

  const v = await db.vehicle.findFirst({ include: { images: true, location: { include: { city: true } } } });
  assert.ok(v && v.images.length > 0 && v.location.city.name);

  const rl = await db.$queryRaw<{ count: number }[]>`INSERT INTO "RateLimit" ("key","count","windowStart") VALUES ('k',1,${new Date()})
    ON CONFLICT ("key") DO UPDATE SET "count"="RateLimit"."count"+1 RETURNING "count"`;
  assert.equal(Number(rl[0]!.count), 1);

  const b = await db.booking.findFirstOrThrow({ where: { status: "CONFIRMED" } });
  await assert.rejects(
    db.booking.create({
      data: { code: "T-1", userId: b.userId, vehicleId: b.vehicleId, pickupLocationId: b.pickupLocationId, startAt: b.startAt, endAt: b.endAt, blockedUntil: b.blockedUntil, status: "AWAITING_PAYMENT" },
    }),
    (e: Error) => e.message.includes("booking_no_overlap") || e.message.includes("23P01"),
  );

  const agg = await db.bookingPricing.aggregate({ _sum: { rentalTotal: true } });
  assert.ok((agg._sum.rentalTotal ?? 0) > 0);
  const groups = await db.booking.groupBy({ by: ["status"], _count: true });
  assert.ok(groups.length >= 4);
  const json = await db.bookingPricing.findFirstOrThrow({ select: { lineItems: true } });
  assert.ok(Array.isArray(json.lineItems));
  const file = await db.storedFile.findFirstOrThrow({ where: { kind: "DOCUMENT" } });
  assert.equal(Buffer.from(file.data!).subarray(0, 4).toString(), "%PDF");
  const u = await db.user.findFirstOrThrow({ where: { email: "priya@example.com" } });
  assert.ok(u.createdAt instanceof Date);
  const updated = await db.coupon.updateMany({ where: { code: "WEEKEND15" }, data: { usedCount: { increment: 1 } } });
  assert.equal(updated.count, 1);
  await db.$disconnect();
  await pg.close();
});
