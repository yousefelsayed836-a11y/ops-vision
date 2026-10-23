CREATE TABLE public."VehicleCategory" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "nameAr" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VehicleCategory_orgId_code_key" ON public."VehicleCategory"("orgId", "code");
CREATE INDEX "VehicleCategory_orgId_active_idx" ON public."VehicleCategory"("orgId", "active");
ALTER TABLE public."VehicleCategory" ADD CONSTRAINT "VehicleCategory_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES public."Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
