import { db } from "./db";
import { assert } from "./errors";
import { transaction, audit } from "./transactions";
import { branchScope, type Scope } from "./access";
import { z } from "zod";
export async function feedback(scope: Scope, washId: string, raw: unknown) {
  assert(scope.role === "CUSTOMER", "FORBIDDEN", 403);
  const data = z
    .object({
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(1000).default(""),
    })
    .parse(raw);
  return transaction(async (tx) => {
    const wash = await tx.wash.findFirst({
      where: { id: washId, orgId: scope.orgId, customerUserId: scope.actor.id },
    });
    assert(wash, "NOT_FOUND", 404);
    assert(
      ["COMPLETED", "DELIVERED"].includes(wash.status),
      "SESSION_NOT_COMPLETED",
      409,
    );
    const result = await tx.feedback.upsert({
      where: { washId },
      create: {
        ...data,
        washId,
        orgId: scope.orgId,
        customerUserId: scope.actor.id,
      },
      update: data,
    });
    await audit(
      tx,
      scope.actor.id,
      "customer.feedback_saved",
      "feedback",
      result.id,
      scope.orgId,
    );
    return result;
  });
}
export async function receipt(scope: Scope, washId: string) {
  const wash = await db.wash.findFirst({
    where: { id: washId, orgId: scope.orgId },
    include: {
      vehicle: true,
      payments: true,
      org: { select: { name: true } },
      branch: { select: { name: true, city: true } },
    },
  });
  assert(wash, "NOT_FOUND", 404);
  branchScope(scope, wash.branchId);
  assert(
    scope.role === "CUSTOMER"
      ? wash.customerUserId === scope.actor.id
      : scope.permissions.includes("finance.view_revenue"),
    "FORBIDDEN",
    403,
  );
  assert(
    wash.paymentStatus === "PAID" && wash.payments.length,
    "RECEIPT_UNAVAILABLE",
    409,
  );
  return {
    number: `OV-${wash.id.slice(0, 8).toUpperCase()}`,
    organization: wash.org.name,
    branch: wash.branch.name,
    city: wash.branch.city,
    serviceAr: wash.serviceNameAr,
    serviceEn: wash.serviceNameEn,
    subtotal: wash.subtotal.toString(),
    discount: wash.discount.toString(),
    tax: wash.taxAmount.toString(),
    total: wash.price.toString(),
    currency: wash.currency,
    payment: {
      method: wash.payments[0].method,
      reference: wash.payments[0].reference,
      receivedAt: wash.payments[0].createdAt,
    },
    status: "PAID",
    fiscalCertification: false,
  };
}
