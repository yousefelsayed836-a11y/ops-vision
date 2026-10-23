CREATE TABLE "CustomerTracking" (
"id" TEXT PRIMARY KEY,"orgId" TEXT NOT NULL,"washId" TEXT NOT NULL,"passwordHash" TEXT NOT NULL,
"sessionHash" TEXT,"sessionExpiresAt" TIMESTAMPTZ,"expiresAt" TIMESTAMPTZ NOT NULL,"revokedAt" TIMESTAMPTZ,
"createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "CustomerTracking_washId_orgId_fkey" FOREIGN KEY ("washId","orgId") REFERENCES "Wash"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE INDEX "CustomerTracking_orgId_washId_idx" ON "CustomerTracking"("orgId","washId");
