-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadSource" ADD VALUE 'manual';
ALTER TYPE "LeadSource" ADD VALUE 'osm';
ALTER TYPE "LeadSource" ADD VALUE 'ddg';
ALTER TYPE "LeadSource" ADD VALUE 'yandex';

-- AlterEnum
ALTER TYPE "PageStatus" ADD VALUE 'ARCHIVED';

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "auditErrorMessage" TEXT,
ADD COLUMN     "websiteIneligibilityReason" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "showInFooter" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showInHeader" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showOnHomepage" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "target" TEXT,
ADD COLUMN     "targetType" TEXT;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectStatus" TEXT;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "preferredDemoVariantId" TEXT;

-- AlterTable
ALTER TABLE "SiteBuild" ADD COLUMN     "demoVariantId" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "contacts" JSONB DEFAULT '{}',
ADD COLUMN     "language" TEXT,
ADD COLUMN     "previewUrl" TEXT,
ADD COLUMN     "timezone" TEXT;

-- CreateTable
CREATE TABLE "DemoVariant" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" TEXT,
    "name" TEXT,
    "previewToken" TEXT NOT NULL,
    "status" "SiteStatus" NOT NULL DEFAULT 'DRAFT',
    "themeConfig" JSONB DEFAULT '{}',
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoVariantScreenshot" (
    "id" TEXT NOT NULL,
    "demoVariantId" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "siteUpdatedAt" TIMESTAMP(3) NOT NULL,
    "buildId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoVariantScreenshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacancy" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "requirements" TEXT,
    "conditions" TEXT,
    "contact" TEXT,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryRun" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "requestedProvider" TEXT,
    "query" TEXT NOT NULL,
    "topic" TEXT,
    "location" TEXT,
    "limit" INTEGER NOT NULL DEFAULT 50,
    "maxPages" INTEGER,
    "providerOptions" JSONB DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "leadIds" TEXT[],
    "collected" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryProviderConfig" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "defaults" JSONB DEFAULT '{}',
    "lastTestAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultProvider" TEXT NOT NULL DEFAULT 'dgis',
    "query" TEXT NOT NULL,
    "queries" TEXT[],
    "defaultLocation" TEXT,
    "defaultLimit" INTEGER NOT NULL DEFAULT 50,
    "defaultMaxPages" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoveryPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoverySetting" (
    "id" TEXT NOT NULL,
    "value" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscoverySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationRun" (
    "id" TEXT NOT NULL,
    "operationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "entityType" TEXT,
    "entityId" TEXT,
    "leadId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "result" JSONB,
    "error" JSONB,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationEvent" (
    "id" TEXT NOT NULL,
    "operationRunId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "stage" TEXT,
    "message" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DemoVariant_previewToken_key" ON "DemoVariant"("previewToken");

-- CreateIndex
CREATE UNIQUE INDEX "DemoVariantScreenshot_demoVariantId_key" ON "DemoVariantScreenshot"("demoVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "Vacancy_siteId_slug_key" ON "Vacancy"("siteId", "slug");

-- CreateIndex
CREATE INDEX "DiscoveryRun_provider_idx" ON "DiscoveryRun"("provider");

-- CreateIndex
CREATE INDEX "DiscoveryRun_status_idx" ON "DiscoveryRun"("status");

-- CreateIndex
CREATE INDEX "DiscoveryRun_createdAt_idx" ON "DiscoveryRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoveryProviderConfig_providerId_key" ON "DiscoveryProviderConfig"("providerId");

-- CreateIndex
CREATE INDEX "DiscoveryProviderConfig_providerId_idx" ON "DiscoveryProviderConfig"("providerId");

-- CreateIndex
CREATE INDEX "DiscoveryProviderConfig_enabled_idx" ON "DiscoveryProviderConfig"("enabled");

-- CreateIndex
CREATE INDEX "DiscoveryPreset_enabled_idx" ON "DiscoveryPreset"("enabled");

-- CreateIndex
CREATE INDEX "OperationRun_operationId_idx" ON "OperationRun"("operationId");

-- CreateIndex
CREATE INDEX "OperationRun_status_idx" ON "OperationRun"("status");

-- CreateIndex
CREATE INDEX "OperationRun_entityType_entityId_idx" ON "OperationRun"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "OperationRun_leadId_idx" ON "OperationRun"("leadId");

-- CreateIndex
CREATE INDEX "OperationRun_createdAt_idx" ON "OperationRun"("createdAt");

-- CreateIndex
CREATE INDEX "OperationEvent_operationRunId_idx" ON "OperationEvent"("operationRunId");

-- CreateIndex
CREATE INDEX "OperationEvent_createdAt_idx" ON "OperationEvent"("createdAt");

-- CreateIndex
CREATE INDEX "SiteBuild_demoVariantId_idx" ON "SiteBuild"("demoVariantId");

-- AddForeignKey
ALTER TABLE "DemoVariant" ADD CONSTRAINT "DemoVariant_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoVariantScreenshot" ADD CONSTRAINT "DemoVariantScreenshot_demoVariantId_fkey" FOREIGN KEY ("demoVariantId") REFERENCES "DemoVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vacancy" ADD CONSTRAINT "Vacancy_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteBuild" ADD CONSTRAINT "SiteBuild_demoVariantId_fkey" FOREIGN KEY ("demoVariantId") REFERENCES "DemoVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationEvent" ADD CONSTRAINT "OperationEvent_operationRunId_fkey" FOREIGN KEY ("operationRunId") REFERENCES "OperationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
