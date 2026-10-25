CREATE TABLE "ContractAcceptance" (
"id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "userId" TEXT NOT NULL, "version" TEXT NOT NULL,
"signerName" TEXT NOT NULL, "signerEmail" TEXT NOT NULL, "organizationName" TEXT NOT NULL,
"terms" JSONB NOT NULL, "termsHash" TEXT NOT NULL, "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "ContractAcceptance_pkey" PRIMARY KEY ("id"),
CONSTRAINT "ContractAcceptance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
CONSTRAINT "ContractAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE);
CREATE UNIQUE INDEX "ContractAcceptance_orgId_userId_version_key" ON "ContractAcceptance"("orgId","userId","version");
CREATE INDEX "ContractAcceptance_orgId_acceptedAt_idx" ON "ContractAcceptance"("orgId","acceptedAt");
