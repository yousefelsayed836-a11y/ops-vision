CREATE TABLE "CameraVisit" (
 "id" TEXT PRIMARY KEY,"orgId" TEXT NOT NULL,"branchId" TEXT NOT NULL,"bayId" TEXT NOT NULL,"cameraId" TEXT,"analysisId" TEXT NOT NULL,"streamKey" TEXT NOT NULL,"episodeKey" TEXT NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'IN_BAY',"replay" BOOLEAN NOT NULL DEFAULT true,"enteredSeconds" DOUBLE PRECISION NOT NULL,"exitedSeconds" DOUBLE PRECISION,"occupancySeconds" DOUBLE PRECISION,"enteredAt" TIMESTAMP(3),"exitedAt" TIMESTAMP(3),"entryConfidence" DOUBLE PRECISION NOT NULL,"exitConfidence" DOUBLE PRECISION,"vehicleClass" TEXT NOT NULL DEFAULT 'UNKNOWN',"category" TEXT NOT NULL DEFAULT 'UNKNOWN',"categorySource" TEXT NOT NULL DEFAULT 'UNRESOLVED',"washStatus" TEXT NOT NULL DEFAULT 'UNCONFIRMED',"reviewedBy" TEXT,"reviewedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
 FOREIGN KEY ("bayId","orgId") REFERENCES "WashBay"("id","orgId") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CameraVisit_timing" CHECK ("enteredSeconds">=0 AND ("exitedSeconds" IS NULL OR "exitedSeconds">="enteredSeconds")),
 CONSTRAINT "CameraVisit_confidence" CHECK ("entryConfidence" BETWEEN 0 AND 1 AND ("exitConfidence" IS NULL OR "exitConfidence" BETWEEN 0 AND 1))
);
CREATE UNIQUE INDEX "CameraVisit_orgId_episodeKey_key" ON "CameraVisit"("orgId","episodeKey");
CREATE INDEX "CameraVisit_orgId_branchId_createdAt_idx" ON "CameraVisit"("orgId","branchId","createdAt");
CREATE INDEX "CameraVisit_orgId_streamKey_status_idx" ON "CameraVisit"("orgId","streamKey","status");
