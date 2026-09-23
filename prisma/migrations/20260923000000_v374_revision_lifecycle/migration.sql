-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('GENERATING', 'QA_FAILED', 'REVIEW_READY', 'PUBLISHED', 'ARCHIVED');

-- AlterEnum
ALTER TYPE "RedesignStage" ADD VALUE 'QA_FAILED';

-- AlterTable
ALTER TABLE "DemoVariant" ADD COLUMN     "activeRevisionId" TEXT;

-- AlterTable
ALTER TABLE "RedesignRun" ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "canonicalDomain" TEXT,
ADD COLUMN     "consolidationLog" JSONB,
ADD COLUMN     "mergedIntoSiteId" TEXT;

-- CreateTable
CREATE TABLE "SiteRevision" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "basedOnRevisionId" TEXT,
    "generatedByRunId" TEXT,
    "contentSnapshot" JSONB,
    "contentHash" TEXT,
    "routeManifest" JSONB,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT,
    "status" "RevisionStatus" NOT NULL DEFAULT 'GENERATING',
    "failureReason" TEXT,
    "currentStage" "RedesignStage",
    "stageCheckpoints" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevisionScreenshot" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "viewport" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "url" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentHash" TEXT,
    "buildId" TEXT,
    "current" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevisionScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SiteRevision_siteId_idx" ON "SiteRevision"("siteId");

-- CreateIndex
CREATE INDEX "SiteRevision_status_idx" ON "SiteRevision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SiteRevision_variantId_version_key" ON "SiteRevision"("variantId", "version");

-- CreateIndex
CREATE INDEX "RevisionScreenshot_revisionId_idx" ON "RevisionScreenshot"("revisionId");

-- CreateIndex
CREATE INDEX "Site_canonicalDomain_idx" ON "Site"("canonicalDomain");

-- CreateIndex
CREATE INDEX "Site_mergedIntoSiteId_idx" ON "Site"("mergedIntoSiteId");

-- AddForeignKey
ALTER TABLE "SiteRevision" ADD CONSTRAINT "SiteRevision_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "DemoVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteRevision" ADD CONSTRAINT "SiteRevision_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevisionScreenshot" ADD CONSTRAINT "RevisionScreenshot_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "SiteRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

