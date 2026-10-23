import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { hashPassword } from "better-auth/crypto";
import { db } from "../src/lib/db";
if (process.env.APP_ENV !== "development")
  throw new Error("HTTP smoke test is development-only");
const base = "http://127.0.0.1:3000";
const origin = "http://localhost:3000";
const suffix = randomUUID().slice(0, 8);
let checks = 0;
let disposableAdminId: string | undefined;
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  cookie?: string,
  status = 200,
) {
  const options: RequestInit = {
    method,
    headers: {
      ...(body !== undefined
        ? { "content-type": "application/json", origin }
        : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: "manual",
  };
  let result = await fetch(base + path, options);
  for (
    let attempt = 0;
    result.status === 429 && path === "/api/auth/sign-in/email" && attempt < 3;
    attempt++
  ) {
    const seconds = Math.max(
      1,
      Math.min(60, Number(result.headers.get("retry-after")) || 10),
    );
    console.log(`Sign-in throttle: waiting ${seconds} seconds before retry.`);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    result = await fetch(base + path, options);
  }
  assert.equal(
    result.status,
    status,
    `${method} ${path} expected ${status}, got ${result.status}`,
  );
  checks++;
  return result;
}
async function main() {
  for (const locale of ["ar", "en"]) {
    const page = await request(`/${locale}`);
    const html = await page.text();
    assert(html.includes(`lang="${locale}"`));
    assert(html.includes(`dir="${locale === "ar" ? "rtl" : "ltr"}"`));
  }
  const protectedPage = await fetch(base + "/ar/dashboard", {
    redirect: "manual",
  });
  const protectedHtml = await protectedPage.text();
  assert([200, 307].includes(protectedPage.status));
  assert(
    protectedPage.headers.get("location")?.includes("/ar/login") ||
      protectedHtml.includes("NEXT_REDIRECT"),
  );
  checks++;
  await request("/api/v1/me", "GET", undefined, undefined, 401);
  const rejected = await fetch(base + "/api/v1/applications", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://untrusted.example",
    },
    body: "{}",
  });
  assert.equal(rejected.status, 403);
  checks++;
  for (const [payload, expected] of [
    ["null", 400],
    ["x".repeat(65537), 413],
  ] as const) {
    const rejected = await fetch(base + "/api/v1/applications", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: payload,
    });
    assert.equal(rejected.status, expected);
    checks++;
  }
  const id = randomUUID();
  const email = `http-admin-${suffix}@example.test`;
  const password = randomBytes(24).toString("base64url");
  await db.user.create({
    data: {
      id,
      email,
      name: "HTTP TEST · Admin",
      emailVerified: true,
      platformRole: "SUPER_ADMIN",
      accounts: {
        create: {
          id: randomUUID(),
          accountId: id,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  disposableAdminId = id;
  const signed = await request("/api/auth/sign-in/email", "POST", {
    email,
    password,
  });
  const cookie = signed.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert(cookie.includes("session_token"));
  const userEmail = `http-owner-${suffix}@example.test`;
  const submitted = await request(
    "/api/v1/applications",
    "POST",
    {
      businessName: `HTTP TEST · ${suffix}`,
      ownerName: "HTTP TEST · Owner",
      email: userEmail,
      phone: "+201000000001",
      city: "Cairo",
      branchCount: 1,
    },
    undefined,
    201,
  );
  const app = (await submitted.json()) as { id: string };
  const approved = await request(
    `/api/v1/platform/applications/${app.id}/decision`,
    "POST",
    { status: "APPROVED", note: "Development HTTP verification" },
    cookie,
  );
  const result = (await approved.json()) as {
    orgId: string;
    invitation: { token: string };
  };
  const ownerPassword = randomBytes(24).toString("base64url");
  await request("/api/v1/activate", "POST", {
    token: result.invitation.token,
    password: ownerPassword,
  });
  await request(
    "/api/v1/activate",
    "POST",
    { token: result.invitation.token, password: ownerPassword },
    undefined,
    400,
  );
  const ownerSigned = await request("/api/auth/sign-in/email", "POST", {
    email: userEmail,
    password: ownerPassword,
  });
  const ownerCookie = ownerSigned.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  await request(
    `/api/v1/tenants/${result.orgId}/snapshot`,
    "GET",
    undefined,
    cookie,
    403,
  );
  const snapshot = (await (
    await request(
      `/api/v1/tenants/${result.orgId}/snapshot`,
      "GET",
      undefined,
      ownerCookie,
    )
  ).json()) as { branches: { id: string }[] };
  const prefix = `/api/v1/tenants/${result.orgId}`;
  const branchId = snapshot.branches[0].id;
  const bay = (await (
    await request(
      prefix + "/bays",
      "POST",
      { branchId, name: "HTTP TEST · Bay" },
      ownerCookie,
      201,
    )
  ).json()) as { id: string };
  const service = (await (
    await request(
      prefix + "/services",
      "POST",
      {
        nameAr: "اختبار HTTP",
        nameEn: "HTTP TEST service",
        price: "80.00",
        durationMinutes: 15,
      },
      ownerCookie,
      201,
    )
  ).json()) as { id: string };
  const vehicle = (await (
    await request(
      prefix + "/vehicles",
      "POST",
      { plate: `HTTP-${suffix}`, category: "SEDAN" },
      ownerCookie,
      201,
    )
  ).json()) as { id: string };
  const wash = (await (
    await request(
      prefix + "/washes",
      "POST",
      { branchId, bayId: bay.id, serviceId: service.id, vehicleId: vehicle.id },
      ownerCookie,
      201,
    )
  ).json()) as { id: string };
  await request(
    prefix + `/washes/${wash.id}/transition`,
    "POST",
    { to: "WASHING", version: 0 },
    ownerCookie,
  );
  await request(
    prefix + `/washes/${wash.id}/transition`,
    "POST",
    { to: "COMPLETED", version: 1 },
    ownerCookie,
    409,
  );
  await request(
    prefix + `/washes/${wash.id}/transition`,
    "POST",
    { to: "INSPECTION", version: 1 },
    ownerCookie,
  );
  await request(
    prefix + `/washes/${wash.id}/transition`,
    "POST",
    { to: "COMPLETED", version: 2 },
    ownerCookie,
  );
  await request(
    prefix + "/roles",
    "POST",
    { name: "HTTP Reader", permissions: ["wash.view_sessions"] },
    ownerCookie,
    201,
  );
  await request(
    prefix + "/roles",
    "POST",
    { name: "Illegal platform role", permissions: ["platform.manage_tenants"] },
    ownerCookie,
    403,
  );
  const readerEmail = `http-reader-${suffix}@example.test`;
  const readerPassword = randomBytes(24).toString("base64url");
  const readerInvite = (await (
    await request(
      prefix + "/invitations",
      "POST",
      { name: "HTTP TEST Reader", email: readerEmail, role: "HTTP Reader" },
      ownerCookie,
      201,
    )
  ).json()) as { token: string };
  await request("/api/v1/activate", "POST", {
    token: readerInvite.token,
    password: readerPassword,
  });
  const readerSigned = await request("/api/auth/sign-in/email", "POST", {
    email: readerEmail,
    password: readerPassword,
  });
  const readerCookie = readerSigned.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const restricted = (await (
    await request(prefix + "/snapshot", "GET", undefined, readerCookie)
  ).json()) as { washes: Record<string, unknown>[] };
  assert(
    restricted.washes.every(
      (w) =>
        !("price" in w) &&
        !("subtotal" in w) &&
        !("taxAmount" in w) &&
        !("discount" in w),
    ),
  );
  await request(
    prefix + "/services",
    "POST",
    {
      nameAr: "غير مسموح",
      nameEn: "Forbidden service",
      price: "1",
      durationMinutes: 1,
    },
    readerCookie,
    403,
  );
  const customerEmail = `http-customer-${suffix}@example.test`;
  const customerPassword = randomBytes(24).toString("base64url");
  const customerInvite = (await (
    await request(
      prefix + "/invitations",
      "POST",
      { name: "HTTP TEST Customer", email: customerEmail, role: "CUSTOMER" },
      ownerCookie,
      201,
    )
  ).json()) as { token: string };
  await request("/api/v1/activate", "POST", {
    token: customerInvite.token,
    password: customerPassword,
  });
  const customerSigned = await request("/api/auth/sign-in/email", "POST", {
    email: customerEmail,
    password: customerPassword,
  });
  const customerCookie = customerSigned.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const ownedVehicle = (await (
    await request(
      prefix + "/vehicles",
      "POST",
      { plate: `CUSTOMER-HTTP-${suffix}`, category: "SEDAN" },
      customerCookie,
      201,
    )
  ).json()) as { id: string };
  const bookedFor = new Date(Date.now() + 2 * 86400000);
  bookedFor.setUTCHours(9, 0, 0, 0);
  const bookingBody = {
    branchId,
    bayId: bay.id,
    serviceId: service.id,
    vehicleId: ownedVehicle.id,
    bookedFor: bookedFor.toISOString(),
  };
  const booking = (await (
    await request(
      prefix + "/bookings",
      "POST",
      bookingBody,
      customerCookie,
      201,
    )
  ).json()) as { id: string };
  await request(prefix + "/bookings", "POST", bookingBody, customerCookie, 409);
  await request(
    prefix + `/washes/${booking.id}/cancel-booking`,
    "POST",
    { version: 0 },
    customerCookie,
  );
  await request(
    prefix + `/washes/${wash.id}/receipt`,
    "GET",
    undefined,
    customerCookie,
    403,
  );
  // Explicit staff grants must protect reads as well as mutations.
  const emptyPassword = randomBytes(24).toString("base64url"),
    emptyEmail = `http-empty-${suffix}@example.test`;
  const emptyInvite = (await (
    await request(
      prefix + "/invitations",
      "POST",
      { name: "HTTP TEST Empty Staff", email: emptyEmail, permissions: [] },
      ownerCookie,
      201,
    )
  ).json()) as { token: string };
  await request("/api/v1/activate", "POST", {
    token: emptyInvite.token,
    password: emptyPassword,
  });
  const emptySigned = await request("/api/auth/sign-in/email", "POST", {
    email: emptyEmail,
    password: emptyPassword,
  });
  const emptyCookie = emptySigned.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const emptySnapshot = (await (
    await request(prefix + "/snapshot", "GET", undefined, emptyCookie)
  ).json()) as {
    members: { id: string; user: { email: string } }[];
    permissions: string[];
    washes: unknown[];
    services: unknown[];
    vehicles: unknown[];
    bays: unknown[];
    branches: unknown[];
  };
  assert.deepEqual(emptySnapshot.permissions, []);
  for (const key of [
    "washes",
    "services",
    "vehicles",
    "bays",
    "branches",
  ] as const)
    assert.equal(emptySnapshot[key].length, 0);
  await request(
    prefix + "/invitations",
    "POST",
    {
      name: "Escalation",
      email: `http-empty-child-${suffix}@example.test`,
      permissions: [],
    },
    emptyCookie,
    403,
  );
  const staffSnapshot = (await (
    await request(prefix + "/snapshot", "GET", undefined, ownerCookie)
  ).json()) as { members: { id: string; user: { email: string } }[] };
  const emptyMember = staffSnapshot.members.find(
    (m) => m.user.email === emptyEmail,
  )!;
  await request(
    prefix + `/members/${emptyMember.id}`,
    "PATCH",
    { permissions: ["wash.view_sessions"], active: true },
    ownerCookie,
  );
  await request("/api/v1/me", "GET", undefined, emptyCookie, 401);
  const platformEmail = `http-platform-staff-${suffix}@example.test`,
    platformPassword = randomBytes(24).toString("base64url");
  const platformInvite = (await (
    await request(
      "/api/v1/platform/staff",
      "POST",
      {
        name: "HTTP TEST Platform Staff",
        email: platformEmail,
        permissions: [],
      },
      cookie,
      201,
    )
  ).json()) as { token: string };
  await request("/api/v1/activate", "POST", {
    token: platformInvite.token,
    password: platformPassword,
  });
  const platformSigned = await request("/api/auth/sign-in/email", "POST", {
    email: platformEmail,
    password: platformPassword,
  });
  const platformCookie = platformSigned.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  const restrictedPlatform = (await (
    await request("/api/v1/platform", "GET", undefined, platformCookie)
  ).json()) as {
    applications: unknown[];
    organizations: unknown[];
    staff: unknown[];
    permissions: string[];
  };
  for (const key of [
    "applications",
    "organizations",
    "staff",
    "permissions",
  ] as const)
    assert.equal(restrictedPlatform[key].length, 0);
  await request(
    "/api/v1/platform/staff",
    "POST",
    {
      name: "Escalation",
      email: `http-platform-child-${suffix}@example.test`,
      permissions: [],
    },
    platformCookie,
    403,
  );
  await request(
    `/api/v1/platform/organizations/${result.orgId}`,
    "PATCH",
    { status: "SUSPENDED" },
    platformCookie,
    403,
  );
  await request(
    prefix + "/organization-settings",
    "PATCH",
    {
      name: `HTTP TEST ${suffix}`,
      currency: "EGP",
      cancellationLeadHours: 1,
      siteIp: "192.0.2.10",
    },
    ownerCookie,
  );
  await request(
    prefix + "/cameras",
    "POST",
    {
      name: "HTTP TEST IP Camera",
      branchId,
      protocol: "RTSP",
      ipAddress: "192.0.2.20",
    },
    ownerCookie,
    201,
  );
  await request(
    prefix + "/cameras",
    "POST",
    {
      name: "Invalid IP",
      branchId,
      protocol: "RTSP",
      ipAddress: "http://example.test",
    },
    ownerCookie,
    422,
  );
  const configured = (await (
    await request(prefix + "/snapshot", "GET", undefined, ownerCookie)
  ).json()) as {
    org: { siteIp: string };
    cameras: { ipAddress: string; status: string }[];
  };
  assert.equal(configured.org.siteIp, "192.0.2.10");
  assert(
    configured.cameras.some(
      (c) => c.ipAddress === "192.0.2.20" && c.status === "UNCONFIGURED",
    ),
  );
  for (const locale of ["ar", "en"]) {
    const manifest = (await (
      await request(`/apps/${locale}.webmanifest`)
    ).json()) as { start_url: string; scope: string };
    assert.equal(manifest.start_url, `/${locale}/dashboard`);
    assert.equal(manifest.scope, `/${locale}/dashboard`);
  }
  await request("/api/auth/sign-out", "POST", {}, ownerCookie);
  await request("/api/v1/me", "GET", undefined, ownerCookie, 401);
  // Remove only this script's disposable administrator; tenant test evidence remains clearly labeled.
  await db.session.deleteMany({ where: { userId: id } });
  await db.account.deleteMany({ where: { userId: id } });
  await db.user.delete({ where: { id } });
  disposableAdminId = undefined;
  console.log(
    JSON.stringify({
      result: "PASS",
      httpChecks: checks,
      credentials: "not printed",
      records: "clearly labeled development tests",
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      error instanceof assert.AssertionError
        ? error.message
        : "HTTP smoke test failed; no credentials logged",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (disposableAdminId)
      await db.user.deleteMany({
        where: {
          id: disposableAdminId,
          email: { startsWith: "http-admin-", endsWith: "@example.test" },
          name: "HTTP TEST · Admin",
        },
      });
    await db.$disconnect();
  });
