import { db } from "./db";
import { audit, transaction, type Tx } from "./transactions";
import { assert } from "./errors";
import { branchScope, type Scope } from "./access";
import { simulationInput } from "./validation";
import type { Prisma } from "@/generated/prisma/client";

export function retryDelay(attempt: number) {
  return Math.min(3600000, 5000 * 2 ** Math.max(0, attempt - 1));
}
export async function emit(
  tx: Tx,
  data: {
    orgId: string;
    key: string;
    type: string;
    source: string;
    payload: Prisma.InputJsonValue;
  },
) {
  return tx.automationEvent.upsert({
    where: { orgId_key: { orgId: data.orgId, key: data.key } },
    create: data,
    update: {},
  });
}
export async function simulate(scope: Scope, raw: unknown) {
  const data = simulationInput.parse(raw);
  assert(
    process.env.ALLOW_SIMULATION === "true" && scope.isDemo,
    "SIMULATION_DISABLED",
    403,
  );
  return transaction(async (tx) => {
    const camera = await tx.camera.findFirst({
      where: { id: data.cameraId, orgId: scope.orgId, protocol: "SIMULATED" },
    });
    assert(camera, "NOT_FOUND", 404);
    branchScope(scope, camera.branchId);
    const existing = await tx.automationEvent.findUnique({
      where: { orgId_key: { orgId: scope.orgId, key: data.key } },
    });
    if (existing) return { event: existing, duplicate: true };
    const event = await emit(tx, {
      orgId: scope.orgId,
      key: data.key,
      type: data.type,
      source: "SIMULATED",
      payload: {
        cameraId: camera.id,
        branchId: camera.branchId,
        bayId: camera.bayId,
        confidence: data.confidence,
        trackId: data.trackId ?? null,
      },
    });
    await tx.observation.create({
      data: {
        orgId: scope.orgId,
        cameraId: camera.id,
        eventId: event.id,
        type: data.type,
        confidence: data.confidence,
        source: "SIMULATED",
        trackId: data.trackId,
        rawPayload: event.payload as Prisma.InputJsonValue,
      },
    });
    await audit(
      tx,
      scope.actor.id,
      "simulation.created",
      "automation_event",
      event.id,
      scope.orgId,
      { type: data.type },
    );
    return { event, duplicate: false };
  });
}
export async function reviewObservation(
  scope: Scope,
  id: string,
  decision: string,
  note: string,
) {
  assert(["CONFIRMED", "REJECTED"].includes(decision), "INVALID_DECISION");
  return transaction(async (tx) => {
    const observation = await tx.observation.findFirst({
      where: { id, orgId: scope.orgId },
      include: { camera: true },
    });
    assert(observation, "NOT_FOUND", 404);
    branchScope(scope, observation.camera.branchId);
    await tx.observationReview.create({
      data: {
        orgId: scope.orgId,
        observationId: id,
        actorId: scope.actor.id,
        decision,
        note,
      },
    });
    await tx.observation.update({
      where: { id },
      data: { reviewStatus: decision },
    });
    await audit(
      tx,
      scope.actor.id,
      "observation.reviewed",
      "observation",
      id,
      scope.orgId,
      { decision },
    );
    return { id, decision };
  });
}
export async function processEvent(id: string) {
  try {
    return await transaction(async (tx) => {
      // Lock the queued event in the same transaction as all effects; crashes roll back claim and effects.
      const claimed = await tx.automationEvent.updateMany({
        where: {
          id,
          status: { in: ["PENDING", "RETRY"] },
          nextAttemptAt: { lte: new Date() },
        },
        data: { status: "PROCESSING", lockedAt: new Date() },
      });
      if (!claimed.count) return { processed: false };
      const event = await tx.automationEvent.findUniqueOrThrow({
        where: { id },
        include: { org: true },
      });
      assert(
        event.source !== "SIMULATED" || event.org.isDemo,
        "SIMULATED_PRODUCTION_EVENT",
        403,
      );
      assert(event.org.status === "ACTIVE", "TENANT_SUSPENDED", 403);
      const payload = event.payload as Record<string, unknown>;
      const confidence =
        typeof payload.confidence === "number" ? payload.confidence : 1;
      const rules = await tx.automationRule.findMany({
        where: { orgId: event.orgId, trigger: event.type, enabled: true },
      });
      for (const rule of rules) {
        const existing = await tx.automationExecution.findUnique({
          where: { eventId_ruleId: { eventId: id, ruleId: rule.id } },
        });
        if (existing) continue;
        const skipped = confidence < rule.minConfidence;
        assert(
          ["CREATE_ALERT", "REQUEST_REVIEW", "RECORD_EVENT"].includes(
            rule.action,
          ),
          "UNSUPPORTED_ACTION",
        );
        if (!skipped && rule.action !== "RECORD_EVENT")
          await tx.notification.create({
            data: {
              orgId: event.orgId,
              type: rule.action,
              message: rule.message,
              permission: "tenant.manage_automation",
            },
          });
        await tx.automationExecution.create({
          data: {
            orgId: event.orgId,
            eventId: id,
            ruleId: rule.id,
            status: skipped ? "SKIPPED" : "SUCCEEDED",
            result: skipped
              ? "CONFIDENCE_BELOW_THRESHOLD"
              : `${rule.action}:${event.source}`,
          },
        });
      }
      await tx.automationEvent.update({
        where: { id },
        data: {
          status: "COMPLETED",
          processedAt: new Date(),
          lockedAt: null,
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      return { processed: true };
    });
  } catch (error) {
    const event = await db.automationEvent.findUnique({ where: { id } });
    if (!event || event.status === "COMPLETED") throw error;
    const attempts = event.attempts + 1;
    await db.automationEvent.update({
      where: { id },
      data: {
        status: attempts >= 5 ? "DEAD" : "RETRY",
        attempts,
        lockedAt: null,
        lastError:
          error instanceof Error && "code" in error
            ? String(error.code)
            : "PROCESSING_FAILED",
        nextAttemptAt: new Date(Date.now() + retryDelay(attempts)),
      },
    });
    return { processed: false, failed: true };
  }
}
export async function processDueEvents(limit = 20) {
  const events = await db.automationEvent.findMany({
    where: {
      status: { in: ["PENDING", "RETRY"] },
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const event of events) await processEvent(event.id);
  return events.length;
}
