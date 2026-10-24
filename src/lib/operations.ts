import { audit, transaction, type Tx } from "./transactions";
import { assert } from "./errors";
import { branchScope, type Scope } from "./access";
import { createWashInput, vehicleInput } from "./validation";
import { emit } from "./automation";
import { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import {builtinVehicleCategories} from "./catalog";

import { validTransition } from "./domain";
export { transitions, validTransition, times } from "./domain";
async function reservationConflict(
  tx: Tx,
  orgId: string,
  bayId: string,
  start: Date,
  end: Date,
  exclude?: string,
) {
  const conflict = await tx.wash.findFirst({
    where: {
      orgId,
      bayId,
      id: exclude ? { not: exclude } : undefined,
      bookedFor: { lt: end },
      reservedUntil: { gt: start },
      status: { notIn: ["CANCELLED", "COMPLETED", "DELIVERED"] },
    },
  });
  assert(!conflict, "RESERVATION_CONFLICT", 409);
}
async function claimBay(
  tx: Tx,
  scope: Scope,
  branchId: string,
  bayId: string,
  washId: string,
  estimatedMinutes: number,
) {
  const bay = await tx.washBay.findFirst({
    where: { id: bayId, orgId: scope.orgId, branchId },
  });
  assert(bay, "NOT_FOUND", 404);
  const now = new Date();
  await reservationConflict(
    tx,
    scope.orgId,
    bayId,
    now,
    new Date(now.getTime() + estimatedMinutes * 60000),
    washId,
  );
  const claimed = await tx.washBay.updateMany({
    where: {
      id: bayId,
      orgId: scope.orgId,
      branchId,
      status: "AVAILABLE",
      activeWashId: null,
    },
    data: { status: "OCCUPIED", activeWashId: washId },
  });
  assert(claimed.count === 1, "BAY_UNAVAILABLE", 409);
}
export async function createVehicle(scope: Scope, raw: unknown) {
  const data = vehicleInput.parse(raw);
  const plate = data.plate ?? `AUTO-${randomUUID().replaceAll('-', '')}`;
  return transaction(async (tx) => {
    assert(builtinVehicleCategories.includes(data.category as (typeof builtinVehicleCategories)[number])||!!(await tx.vehicleCategory.findFirst({where:{orgId:scope.orgId,code:data.category,active:true}})),"INVALID_CATEGORY",422);
    const vehicle = await tx.vehicle.create({
      data: {
        ...data,
        plate,
        orgId: scope.orgId,
        customerUserId: scope.role === "CUSTOMER" ? scope.actor.id : undefined,
      },
    });
    await audit(
      tx,
      scope.actor.id,
      "vehicle.created",
      "vehicle",
      vehicle.id,
      scope.orgId,
    );
    return vehicle;
  });
}
export async function createWash(scope: Scope, raw: unknown, startImmediately=false) {
  assert(!startImmediately||scope.permissions.includes('wash.start_session'),'FORBIDDEN',403);
  const data = createWashInput.parse(raw);
  assert(!startImmediately||(data.bayId&&!data.bookedFor),'BAY_REQUIRED',422);
  branchScope(scope, data.branchId);
  return transaction(async (tx) => {
    const [branch, service, vehicle, org] = await Promise.all([
      tx.branch.findFirst({
        where: { id: data.branchId, orgId: scope.orgId, active: true },
      }),
      tx.washService.findFirst({
        where: { id: data.serviceId, orgId: scope.orgId, active: true },
      }),
      tx.vehicle.findFirst({
        where: { id: data.vehicleId, orgId: scope.orgId },
      }),
      tx.organization.findUnique({ where: { id: scope.orgId } }),
    ]);
    assert(branch && service && vehicle && org, "NOT_FOUND", 404);
    assert(org.status==='ACTIVE','ACCOUNT_UNAVAILABLE',403);
    assert(
      service.category === "ALL" || service.category === vehicle.category,
      "SERVICE_CATEGORY_MISMATCH",
    );
    assert(
      scope.role !== "CUSTOMER" || vehicle.customerUserId === scope.actor.id,
      "FORBIDDEN",
      403,
    );
    assert(
      scope.role !== "CUSTOMER" || data.bookedFor,
      "BOOKING_REQUIRED",
      403,
    );
    const pricing = await tx.servicePricingRule.findMany({
      where: {
        orgId: scope.orgId,
        serviceId: service.id,
        category: { in: [vehicle.category, "ALL"] },
        size: { in: [vehicle.size, "ALL"] },
      },
    });
    pricing.sort(
      (a, b) =>
        Number(b.category !== "ALL") * 2 +
        Number(b.size !== "ALL") -
        (Number(a.category !== "ALL") * 2 + Number(a.size !== "ALL")),
    );
    const subtotal = pricing[0]?.price ?? service.price;
    const serviceMinutes = pricing[0]?.durationMinutes ?? service.durationMinutes;
    const discount = new Prisma.Decimal(data.discount);
    assert(discount.lte(subtotal), "DISCOUNT_EXCEEDS_TOTAL");
    assert(
      discount.isZero() ||
        scope.permissions.includes("finance.manage_payments"),
      "FORBIDDEN",
      403,
    );
    const taxable = subtotal.minus(discount);
    const taxAmount = new Prisma.Decimal(0);
    const price = taxable;
    const start = data.bookedFor ? new Date(data.bookedFor) : undefined;
    const end = start
      ? new Date(start.getTime() + serviceMinutes * 60000)
      : undefined;
    if (start && end) {
      assert(data.bayId, "BAY_REQUIRED");
      assert(
        start.getTime() >= Date.now() + 60000 &&
          start.getTime() < Date.now() + 90 * 86400000,
        "INVALID_BOOKING_TIME",
      );
      const bay = await tx.washBay.findFirst({
        where: { id: data.bayId, orgId: scope.orgId, branchId: data.branchId },
      });
      assert(
        bay && !["MAINTENANCE", "DISABLED"].includes(bay.status),
        "BAY_UNAVAILABLE",
        409,
      );
      const clock = (date: Date) =>
        new Intl.DateTimeFormat("en-GB", {
          timeZone: branch.timezone,
          hourCycle: "h23",
          hour: "2-digit",
          minute: "2-digit",
        }).format(date);
      const day = (date: Date) =>
        new Intl.DateTimeFormat("en-CA", {
          timeZone: branch.timezone,
          dateStyle: "short",
        }).format(date);
      assert(
        day(start) === day(end) &&
          clock(start) >= branch.opensAt &&
          clock(end) <= branch.closesAt,
        "OUTSIDE_OPERATING_HOURS",
      );
      await reservationConflict(tx, scope.orgId, data.bayId, start, end);
    }
    const wash = await tx.wash.create({
      data: {
        orgId: scope.orgId,
        branchId: data.branchId,
        serviceId: service.id,
        vehicleId: vehicle.id,
        customerUserId: vehicle.customerUserId,
        price,
        subtotal,
        discount,
        taxAmount,
        currency: org.currency,
        serviceNameAr: service.nameAr,
        serviceNameEn: service.nameEn,
        estimatedMinutes: serviceMinutes,
        notes: data.notes,
        status: start ? "BOOKED" : startImmediately ? "WASHING" : data.bayId ? "ASSIGNED" : "CHECKED_IN",
        startedAt: startImmediately ? new Date() : undefined,
        checkedInAt: start ? null : new Date(),
        bookedFor: start,
        reservedUntil: end,
        bayId: data.bayId,
        assignedAt: data.bayId && !start ? new Date() : undefined,
      },
    });
    if (data.bayId && !start)
      await claimBay(
        tx,
        scope,
        data.branchId,
        data.bayId,
        wash.id,
        serviceMinutes,
      );
    await tx.washHistory.create({
      data: {
        orgId: scope.orgId,
        washId: wash.id,
        toStatus: wash.status,
        actorId: scope.actor.id,
      },
    });
    await audit(
      tx,
      scope.actor.id,
      "wash.created",
      "wash",
      wash.id,
      scope.orgId,
    );
    await emit(tx, {
      orgId: scope.orgId,
      key: `wash-created:${wash.id}`,
      type: "wash.session_created",
      source: "BUSINESS",
      payload: { washId: wash.id, branchId: wash.branchId },
    });
    if(startImmediately)await emit(tx,{orgId:scope.orgId,key:`wash-started:${wash.id}`,type:'wash.started',source:'BUSINESS',payload:{washId:wash.id,branchId:wash.branchId,bayId:wash.bayId}});
    return wash;
  });
}
export async function transitionWash(
  scope: Scope,
  id: string,
  to: string,
  version: number,
  bayId?: string,
) {
  return transaction(async (tx) => {
    const wash = await tx.wash.findFirst({ where: { id, orgId: scope.orgId } });
    assert(wash, "NOT_FOUND", 404);
    branchScope(scope, wash.branchId);
    const permission =
      scope.role === "CUSTOMER"
        ? "customers.self"
        : to === "CANCELLED"
          ? "wash.cancel_session"
          : to === "PAUSED"
            ? "wash.pause_session"
            : ["COMPLETED", "DELIVERED", "INSPECTION"].includes(to)
              ? "wash.complete_session"
              : "wash.start_session";
    assert(scope.permissions.includes(permission), "FORBIDDEN", 403);
    assert(validTransition(wash.status, to), "INVALID_TRANSITION", 409);
    assert(wash.version === version, "STALE_VERSION", 409);
    if (scope.role === "CUSTOMER") {
      assert(
        wash.customerUserId === scope.actor.id &&
          wash.status === "BOOKED" &&
          to === "CANCELLED",
        "FORBIDDEN",
        403,
      );
      const org = await tx.organization.findUniqueOrThrow({
        where: { id: scope.orgId },
      });
      assert(
        wash.bookedFor &&
          wash.bookedFor.getTime() - Date.now() >=
            org.cancellationLeadHours * 3600000,
        "CANCELLATION_WINDOW_CLOSED",
        409,
      );
    }
    const now = new Date();
    const assignedBay = bayId ?? wash.bayId;
    if(to==='WASHING'&&!wash.bayId){assert(assignedBay,'BAY_REQUIRED',422);await claimBay(tx,scope,wash.branchId,assignedBay,id,wash.estimatedMinutes);}
    if (to === "ASSIGNED") {
      assert(assignedBay, "BAY_REQUIRED");
      await claimBay(
        tx,
        scope,
        wash.branchId,
        assignedBay,
        id,
        wash.estimatedMinutes,
      );
    }
    const updated = await tx.wash.updateMany({
      where: { id, orgId: scope.orgId, version },
      data: {
        status: to,
        version: { increment: 1 },
        checkedInAt: to === "CHECKED_IN" ? now : undefined,
        bayId: to === "ASSIGNED" || (to=== "WASHING"&&!wash.bayId) ? assignedBay : undefined,
        assignedAt: to === "ASSIGNED" || (to=== "WASHING"&&!wash.bayId) ? now : undefined,
        startedAt: to === "WASHING" && !wash.startedAt ? now : undefined,
        completedAt: to === "COMPLETED" ? now : undefined,
        deliveredAt: to === "DELIVERED" ? now : undefined,
      },
    });
    assert(updated.count === 1, "STALE_VERSION", 409);
    if (to === "COMPLETED" && wash.paymentStatus !== "PAID") {
      await tx.payment.create({data:{orgId:scope.orgId,washId:id,amount:wash.price,currency:wash.currency,method:"AUTO_COMPLETION",recordedBy:scope.actor.id}});
      await tx.wash.update({where:{id},data:{paymentStatus:"PAID"}});
    }
    if (["COMPLETED", "CANCELLED"].includes(to) && wash.bayId)
      await tx.washBay.updateMany({
        where: { id: wash.bayId, orgId: scope.orgId, activeWashId: id },
        data: { status: "AVAILABLE", activeWashId: null },
      });
    if (["COMPLETED", "CANCELLED"].includes(to))
      await tx.washWorker.updateMany({
        where: { washId: id, orgId: scope.orgId, endedAt: null },
        data: { endedAt: now },
      });
    await tx.washHistory.create({
      data: {
        orgId: scope.orgId,
        washId: id,
        fromStatus: wash.status,
        toStatus: to,
        actorId: scope.actor.id,
      },
    });
    await audit(
      tx,
      scope.actor.id,
      "wash.transition",
      "wash",
      id,
      scope.orgId,
      { from: wash.status, to },
    );
    await emit(tx, {
      orgId: scope.orgId,
      key: `wash:${id}:${version + 1}`,
      type: `wash.${to.toLowerCase()}`,
      source: "BUSINESS",
      payload: { washId: id, branchId: wash.branchId },
    });
    return { id, status: to, version: version + 1 };
  });
}
export async function assignWorker(
  scope: Scope,
  washId: string,
  employeeUserId: string,
) {
  assert(scope.permissions.includes("wash.assign_workers"), "FORBIDDEN", 403);
  return transaction(async (tx) => {
    const [wash, employee] = await Promise.all([
      tx.wash.findFirst({ where: { id: washId, orgId: scope.orgId } }),
      tx.membership.findUnique({
        where: { userId_orgId: { userId: employeeUserId, orgId: scope.orgId } },
      }),
    ]);
    assert(
      wash && employee?.active && employee.role !== "CUSTOMER",
      "NOT_FOUND",
      404,
    );
    branchScope(scope, wash.branchId);
    assert(
      !employee.branchId || employee.branchId === wash.branchId,
      "FORBIDDEN",
      403,
    );
    assert(
      !["COMPLETED", "DELIVERED", "CANCELLED"].includes(wash.status),
      "SESSION_FINALIZED",
      409,
    );
    const existing = await tx.washWorker.findFirst({
      where: { orgId: scope.orgId, washId, employeeUserId, endedAt: null },
    });
    if (existing) return existing;
    const assignment = await tx.washWorker.create({
      data: { orgId: scope.orgId, washId, employeeUserId },
    });
    await audit(
      tx,
      scope.actor.id,
      "wash.worker_assigned",
      "wash",
      washId,
      scope.orgId,
      { employeeUserId },
    );
    return assignment;
  });
}
export async function recordCashPayment(
  scope: Scope,
  washId: string,
  reference: string,
) {
  assert(
    scope.permissions.includes("finance.manage_payments"),
    "FORBIDDEN",
    403,
  );
  assert(!scope.isDemo, "DEMO_PAYMENTS_DISABLED", 403);
  return transaction(async (tx) => {
    const wash = await tx.wash.findFirst({
      where: { id: washId, orgId: scope.orgId },
    });
    assert(wash, "NOT_FOUND", 404);
    branchScope(scope, wash.branchId);
    assert(wash.status !== "CANCELLED", "SESSION_CANCELLED", 409);
    const existing = await tx.payment.findFirst({
      where: { orgId: scope.orgId, reference },
    });
    if (existing) {
      assert(existing.washId === washId, "REFERENCE_CONFLICT", 409);
      return existing;
    }
    assert(wash.paymentStatus !== "PAID", "ALREADY_PAID", 409);
    const payment = await tx.payment.create({
      data: {
        orgId: scope.orgId,
        washId,
        amount: wash.price,
        currency: wash.currency,
        method: "CASH",
        reference,
        recordedBy: scope.actor.id,
      },
    });
    await tx.wash.update({
      where: { id: washId },
      data: { paymentStatus: "PAID" },
    });
    await audit(
      tx,
      scope.actor.id,
      "payment.cash_recorded",
      "payment",
      payment.id,
      scope.orgId,
    );
    return payment;
  });
}
