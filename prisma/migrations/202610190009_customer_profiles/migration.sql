CREATE TABLE "CustomerProfile" (
"id" TEXT PRIMARY KEY,"orgId" TEXT NOT NULL,"name" TEXT NOT NULL,"phone" TEXT NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMPTZ NOT NULL,
CONSTRAINT "CustomerProfile_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "CustomerProfile_id_orgId_key" ON "CustomerProfile"("id","orgId");
CREATE UNIQUE INDEX "CustomerProfile_orgId_phone_key" ON "CustomerProfile"("orgId","phone");
CREATE INDEX "CustomerProfile_orgId_createdAt_idx" ON "CustomerProfile"("orgId","createdAt");
ALTER TABLE "Wash" ADD COLUMN "customerProfileId" TEXT;
ALTER TABLE "Wash" ADD CONSTRAINT "Wash_customerProfileId_orgId_fkey" FOREIGN KEY ("customerProfileId","orgId") REFERENCES "CustomerProfile"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;
