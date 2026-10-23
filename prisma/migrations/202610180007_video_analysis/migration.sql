CREATE TABLE "VideoAnalysis" (
"id" TEXT PRIMARY KEY, "orgId" TEXT NOT NULL, "branchId" TEXT NOT NULL, "cameraId" TEXT,
"createdBy" TEXT NOT NULL, "sourceName" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
"sourceSha256" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'QUEUED', "config" JSONB NOT NULL DEFAULT '{}',
"result" JSONB, "errorCode" TEXT, "attempts" INTEGER NOT NULL DEFAULT 0, "lockedAt" TIMESTAMPTZ,
"createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" TIMESTAMPTZ,
CONSTRAINT "VideoAnalysis_org_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT,
CONSTRAINT "VideoAnalysis_branch_fkey" FOREIGN KEY ("branchId","orgId") REFERENCES "Branch"("id","orgId") ON DELETE RESTRICT,
CONSTRAINT "VideoAnalysis_camera_fkey" FOREIGN KEY ("cameraId","orgId") REFERENCES "Camera"("id","orgId") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "VideoAnalysis_storageKey_key" ON "VideoAnalysis"("storageKey");
CREATE UNIQUE INDEX "VideoAnalysis_id_orgId_key" ON "VideoAnalysis"("id","orgId");
CREATE INDEX "VideoAnalysis_orgId_createdAt_idx" ON "VideoAnalysis"("orgId","createdAt");
CREATE INDEX "VideoAnalysis_status_createdAt_idx" ON "VideoAnalysis"("status","createdAt");
CREATE TABLE "VideoAnalysisReview" (
"id" TEXT PRIMARY KEY, "analysisId" TEXT NOT NULL, "orgId" TEXT NOT NULL, "trackId" TEXT NOT NULL,
"actorId" TEXT NOT NULL, "category" TEXT NOT NULL DEFAULT 'UNKNOWN', "size" TEXT NOT NULL DEFAULT 'UNKNOWN',
"serviceId" TEXT, "washed" BOOLEAN, "note" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "VideoAnalysisReview_analysis_fkey" FOREIGN KEY ("analysisId","orgId") REFERENCES "VideoAnalysis"("id","orgId") ON DELETE RESTRICT,
CONSTRAINT "VideoAnalysisReview_service_fkey" FOREIGN KEY ("serviceId","orgId") REFERENCES "WashService"("id","orgId") ON DELETE RESTRICT
);
CREATE INDEX "VideoAnalysisReview_orgId_analysisId_trackId_createdAt_idx" ON "VideoAnalysisReview"("orgId","analysisId","trackId","createdAt");
