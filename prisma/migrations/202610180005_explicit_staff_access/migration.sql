ALTER TABLE "User" ADD COLUMN "platformPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "platformCreatedBy" TEXT;
CREATE INDEX "User_platformCreatedBy_idx" ON "User"("platformCreatedBy");
