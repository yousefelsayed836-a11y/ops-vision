import { db } from "./db";
import type { Prisma } from "@/generated/prisma/client";
export type Tx = Prisma.TransactionClient;
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(fn, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (error) {
      if (
        attempt < 3 &&
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2034"
      )
        continue;
      throw error;
    }
  }
}
export async function audit(
  tx: Tx,
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  orgId?: string,
  metadata: Prisma.InputJsonValue = {},
) {
  await tx.auditLog.create({
    data: { actorId, action, entityType, entityId, orgId, metadata },
  });
}
