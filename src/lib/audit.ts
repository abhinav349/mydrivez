import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { clientIp } from "./auth/session";

export async function audit(
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  metadata?: Prisma.InputJsonValue,
) {
  await db.adminActivityLog.create({
    data: { actorId, action, entityType, entityId, summary, metadata, ip: await clientIp() },
  });
}
