-- CreateEnum
CREATE TYPE "DiscoveryDecision" AS ENUM ('ACCEPT', 'REJECT', 'UNCERTAIN');

-- AlterTable
ALTER TABLE "DiscoveryRun" ADD COLUMN     "intent" TEXT,
ADD COLUMN     "rejectedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "uncertainCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DiscoveryCandidate" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "companyName" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "canonicalDomain" TEXT,
    "registrableDomain" TEXT,
    "website" TEXT,
    "websiteDomain" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "categories" TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sourceUrl" TEXT,
    "decision" "DiscoveryDecision" NOT NULL DEFAULT 'UNCERTAIN',
    "reason" TEXT,
    "confidence" DOUBLE PRECISION,
    "matchedConcepts" TEXT[],
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_runId_idx" ON "DiscoveryCandidate"("runId");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_leadId_idx" ON "DiscoveryCandidate"("leadId");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_canonicalDomain_idx" ON "DiscoveryCandidate"("canonicalDomain");

-- CreateIndex
CREATE INDEX "DiscoveryCandidate_decision_idx" ON "DiscoveryCandidate"("decision");

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_runId_fkey" FOREIGN KEY ("runId") REFERENCES "DiscoveryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryCandidate" ADD CONSTRAINT "DiscoveryCandidate_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

