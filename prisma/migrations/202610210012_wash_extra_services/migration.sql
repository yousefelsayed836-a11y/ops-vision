CREATE TABLE "WashExtraService" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "washId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "price" DECIMAL(12,2) NOT NULL,
  "durationMinutes" INTEGER NOT NULL,
  "addedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WashExtraService_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WashExtraService_orgId_washId_createdAt_idx" ON "WashExtraService"("orgId","washId","createdAt");
ALTER TABLE "WashExtraService" ADD CONSTRAINT "WashExtraService_washId_orgId_fkey" FOREIGN KEY ("washId","orgId") REFERENCES "Wash"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WashExtraService" ADD CONSTRAINT "WashExtraService_serviceId_orgId_fkey" FOREIGN KEY ("serviceId","orgId") REFERENCES "WashService"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE;
