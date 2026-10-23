import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DomainError } from "./errors";
import { db } from "./db";
import { digest } from "./crypto";
import { transaction } from "./transactions";
import { APIError } from "better-auth/api";
export function response(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export function errorResponse(error: unknown) {
  if (error instanceof DomainError)
    return response({ error: error.code }, error.status);
  if (error instanceof ZodError)
    return response(
      {
        error: "VALIDATION_FAILED",
        fields: error.issues.map((i) => ({
          field: i.path.join("."),
          code: i.code,
        })),
      },
      422,
    );
  if (error instanceof APIError)
    return response(
      { error: "INVALID_OR_EXPIRED_TOKEN" },
      error.statusCode >= 500 ? 500 : 400,
    );
  if (
    typeof error === "object" &&
    error &&
    "code" in error &&
    ["P2002", "P2003"].includes(String(error.code))
  )
    return response({ error: "CONFLICT" }, 409);
  console.error(
    JSON.stringify({
      event: "request.failed",
      errorType: error instanceof Error ? error.name : "Unknown",
    }),
  );
  return response({ error: "INTERNAL_ERROR" }, 500);
}
export function guardMutation(req: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const expected = new URL(process.env.APP_URL ?? "http://localhost:3000")
    .origin;
  if (origin !== expected) throw new DomainError("INVALID_ORIGIN", 403);
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    throw new DomainError("JSON_REQUIRED", 415);
}
export async function rateLimit(
  namespace: string,
  identifier: string,
  max: number,
  seconds: number,
) {
  const bucket = Math.floor(Date.now() / (seconds * 1000));
  const id = digest(`${namespace}:${identifier}:${bucket}`);
  await transaction(async (tx) => {
    const result = await tx.rateLimit.upsert({
      where: { id },
      create: {
        id,
        count: 1,
        expiresAt: new Date((bucket + 1) * seconds * 1000),
      },
      update: { count: { increment: 1 } },
    });
    if (result.count > max) throw new DomainError("RATE_LIMITED", 429);
  });
}
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get("content-length") ?? 0) > 65536)
    throw new DomainError("PAYLOAD_TOO_LARGE", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new DomainError("INVALID_JSON", 400);
  const parts: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 65536) {
        await reader.cancel();
        throw new DomainError("PAYLOAD_TOO_LARGE", 413);
      }
      parts.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    const value = JSON.parse(Buffer.concat(parts).toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value;
  } catch {
    throw new DomainError("INVALID_JSON", 400);
  }
}
export async function cleanupRateLimits() {
  await db.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
