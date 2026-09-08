-- CreateEnum
CREATE TYPE "PermissionScope" AS ENUM ('GLOBAL', 'PRODUCT', 'SITE');

-- CreateEnum
CREATE TYPE "SecurityAssetType" AS ENUM ('APP', 'TEMPLATE', 'SITEBUILD', 'WORKER');

-- CreateEnum
CREATE TYPE "SecurityAuditStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "SecurityEventLevel" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SecurityFindingCategory" AS ENUM ('AUTHN', 'AUTHZ', 'INJECTION', 'SSRF', 'XSS', 'CSRF', 'SECRETS', 'DEPENDENCY', 'CONFIG', 'PRIVACY', 'AIAGENT', 'WORKER', 'SHOWCASE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SecurityFindingEnvironment" AS ENUM ('RUNTIME', 'DEV', 'BUILD', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SecurityFindingReachability" AS ENUM ('REACHABLE', 'NOT_REACHABLE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SecurityFindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');

-- CreateEnum
CREATE TYPE "SecurityFindingStatus" AS ENUM ('OPEN', 'FIXING', 'RESOLVED', 'FALSEPOSITIVE', 'ACCEPTEDRISK');

-- CreateEnum
CREATE TYPE "SiteUserRole" AS ENUM ('ADMIN', 'EDITOR');

-- AlterEnum
ALTER TYPE "ContentSourceType" ADD VALUE 'GENERATED';

-- AlterTable
ALTER TABLE "DemoVariant" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT;

-- AlterTable
ALTER TABLE "LighthouseReport" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "error" JSONB,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'SUCCESS';

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT;

-- AlterTable
ALTER TABLE "Menu" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT;

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT;

-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT,
ADD COLUMN     "manualModifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT,
ADD COLUMN     "manualModifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT,
ADD COLUMN     "manualModifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT,
ADD COLUMN     "manualModifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SiteBuild" ADD COLUMN     "dependencySnapshotId" TEXT;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT,
ADD COLUMN     "manualModifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SiteUser" DROP COLUMN "role",
ADD COLUMN     "role" "SiteUserRole" NOT NULL DEFAULT 'EDITOR';

-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN     "generatedByDemoVariantId" TEXT,
ADD COLUMN     "generatedByRunId" TEXT,
ADD COLUMN     "manualModifiedAt" TIMESTAMP(3),
ADD COLUMN     "sourceType" "ContentSourceType" NOT NULL DEFAULT 'IMPORTED';

-- DropEnum
DROP TYPE "UserRole";

-- CreateTable
CREATE TABLE "DependencyInSnapshot" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "dependencyId" TEXT NOT NULL,
    "path" TEXT,
    "isDirect" BOOLEAN NOT NULL DEFAULT false,
    "isDev" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DependencyInSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "product" TEXT,
    "scopeType" "PermissionScope",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "coverImageId" TEXT,
    "category" TEXT,
    "price" TEXT,
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "sourceUrl" TEXT,
    "sourceType" "ContentSourceType" NOT NULL DEFAULT 'IMPORTED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "generatedByRunId" TEXT,
    "generatedByDemoVariantId" TEXT,
    "manualModifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isGlobal" BOOLEAN NOT NULL DEFAULT false,
    "isSite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "scope" "PermissionScope" NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAffect" (
    "id" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "assetType" "SecurityAssetType" NOT NULL,
    "assetId" TEXT NOT NULL,
    "assetName" TEXT,

    CONSTRAINT "SecurityAffect_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityAudit" (
    "id" TEXT NOT NULL,
    "scanner" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "SecurityAuditStatus" NOT NULL DEFAULT 'PENDING',
    "statusMessage" TEXT,
    "commitSha" TEXT,
    "buildId" TEXT,
    "target" TEXT,
    "rawResult" JSONB,
    "summary" JSONB,

    CONSTRAINT "SecurityAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityDependency" (
    "id" TEXT NOT NULL,
    "ecosystem" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "alias" TEXT,
    "isDev" BOOLEAN NOT NULL DEFAULT false,
    "isDirect" BOOLEAN NOT NULL DEFAULT false,
    "cves" JSONB,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCheckedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityDependencySnapshot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "commitSha" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityDependencySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" "SecurityEventLevel" NOT NULL,
    "category" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "actorType" TEXT,
    "actorId" TEXT,
    "target" TEXT,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "dismissedAt" TIMESTAMP(3),
    "dismissedBy" TEXT,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityFinding" (
    "id" TEXT NOT NULL,
    "auditId" TEXT,
    "product" TEXT NOT NULL,
    "generatedSiteId" TEXT,
    "severity" "SecurityFindingSeverity" NOT NULL,
    "category" "SecurityFindingCategory" NOT NULL,
    "scanner" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "ruleId" TEXT,
    "fingerprint" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "cwe" TEXT,
    "cve" TEXT,
    "dependencyId" TEXT,
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL,
    "status" "SecurityFindingStatus" NOT NULL DEFAULT 'OPEN',
    "remediationNote" TEXT,
    "fixedVersion" TEXT,
    "assignedTo" TEXT,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "environment" "SecurityFindingEnvironment" NOT NULL DEFAULT 'UNKNOWN',
    "reachability" "SecurityFindingReachability" NOT NULL DEFAULT 'UNKNOWN',
    "canonicalId" TEXT,

    CONSTRAINT "SecurityFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityGate" (
    "id" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "openCritical" INTEGER NOT NULL DEFAULT 0,
    "openHigh" INTEGER NOT NULL DEFAULT 0,
    "openMedium" INTEGER NOT NULL DEFAULT 0,
    "openLow" INTEGER NOT NULL DEFAULT 0,
    "blockedReason" TEXT,
    "acceptedHigh" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,

    CONSTRAINT "SecurityGate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityScannerConfig" (
    "id" TEXT NOT NULL,
    "scanner" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "schedule" TEXT,
    "config" JSONB,
    "lastRunAt" TIMESTAMP(3),

    CONSTRAINT "SecurityScannerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "siteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DependencyInSnapshot_snapshotId_dependencyId_key" ON "DependencyInSnapshot"("snapshotId" ASC, "dependencyId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Permission_name_key" ON "Permission"("name" ASC);

-- CreateIndex
CREATE INDEX "Product_generatedByDemoVariantId_idx" ON "Product"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "Product_generatedByRunId_idx" ON "Product"("generatedByRunId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Product_siteId_slug_key" ON "Product"("siteId" ASC, "slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ProductMedia_productId_mediaId_key" ON "ProductMedia"("productId" ASC, "mediaId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name" ASC);

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_scope_key" ON "RolePermission"("roleId" ASC, "permissionId" ASC, "scope" ASC);

-- CreateIndex
CREATE INDEX "SecurityAffect_assetType_assetId_idx" ON "SecurityAffect"("assetType" ASC, "assetId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityAffect_findingId_assetType_assetId_key" ON "SecurityAffect"("findingId" ASC, "assetType" ASC, "assetId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityDependency_ecosystem_name_version_key" ON "SecurityDependency"("ecosystem" ASC, "name" ASC, "version" ASC);

-- CreateIndex
CREATE INDEX "SecurityEvent_category_idx" ON "SecurityEvent"("category" ASC);

-- CreateIndex
CREATE INDEX "SecurityEvent_level_idx" ON "SecurityEvent"("level" ASC);

-- CreateIndex
CREATE INDEX "SecurityEvent_timestamp_idx" ON "SecurityEvent"("timestamp" ASC);

-- CreateIndex
CREATE INDEX "SecurityFinding_canonicalId_idx" ON "SecurityFinding"("canonicalId" ASC);

-- CreateIndex
CREATE INDEX "SecurityFinding_category_idx" ON "SecurityFinding"("category" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityFinding_fingerprint_key" ON "SecurityFinding"("fingerprint" ASC);

-- CreateIndex
CREATE INDEX "SecurityFinding_product_idx" ON "SecurityFinding"("product" ASC);

-- CreateIndex
CREATE INDEX "SecurityFinding_scanner_canonicalId_idx" ON "SecurityFinding"("scanner" ASC, "canonicalId" ASC);

-- CreateIndex
CREATE INDEX "SecurityFinding_scanner_idx" ON "SecurityFinding"("scanner" ASC);

-- CreateIndex
CREATE INDEX "SecurityFinding_severity_idx" ON "SecurityFinding"("severity" ASC);

-- CreateIndex
CREATE INDEX "SecurityFinding_status_idx" ON "SecurityFinding"("status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityScannerConfig_scanner_key" ON "SecurityScannerConfig"("scanner" ASC);

-- CreateIndex
CREATE INDEX "UserRole_siteId_idx" ON "UserRole"("siteId" ASC);

-- CreateIndex
CREATE INDEX "UserRole_userId_idx" ON "UserRole"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_roleId_siteId_key" ON "UserRole"("userId" ASC, "roleId" ASC, "siteId" ASC);

-- CreateIndex
CREATE INDEX "Media_generatedByDemoVariantId_idx" ON "Media"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "Media_generatedByRunId_idx" ON "Media"("generatedByRunId" ASC);

-- CreateIndex
CREATE INDEX "Menu_generatedByDemoVariantId_idx" ON "Menu"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "Menu_generatedByRunId_idx" ON "Menu"("generatedByRunId" ASC);

-- CreateIndex
CREATE INDEX "MenuItem_generatedByDemoVariantId_idx" ON "MenuItem"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "MenuItem_generatedByRunId_idx" ON "MenuItem"("generatedByRunId" ASC);

-- CreateIndex
CREATE INDEX "NewsPost_generatedByDemoVariantId_idx" ON "NewsPost"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "NewsPost_generatedByRunId_idx" ON "NewsPost"("generatedByRunId" ASC);

-- CreateIndex
CREATE INDEX "Page_generatedByDemoVariantId_idx" ON "Page"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "Page_generatedByRunId_idx" ON "Page"("generatedByRunId" ASC);

-- CreateIndex
CREATE INDEX "Project_generatedByDemoVariantId_idx" ON "Project"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "Project_generatedByRunId_idx" ON "Project"("generatedByRunId" ASC);

-- CreateIndex
CREATE INDEX "Service_generatedByDemoVariantId_idx" ON "Service"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "Service_generatedByRunId_idx" ON "Service"("generatedByRunId" ASC);

-- CreateIndex
CREATE INDEX "SiteBuild_dependencySnapshotId_idx" ON "SiteBuild"("dependencySnapshotId" ASC);

-- CreateIndex
CREATE INDEX "SiteSettings_generatedByDemoVariantId_idx" ON "SiteSettings"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "SiteSettings_generatedByRunId_idx" ON "SiteSettings"("generatedByRunId" ASC);

-- CreateIndex
CREATE INDEX "Vacancy_generatedByDemoVariantId_idx" ON "Vacancy"("generatedByDemoVariantId" ASC);

-- CreateIndex
CREATE INDEX "Vacancy_generatedByRunId_idx" ON "Vacancy"("generatedByRunId" ASC);

-- AddForeignKey
ALTER TABLE "DependencyInSnapshot" ADD CONSTRAINT "DependencyInSnapshot_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "SecurityDependency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DependencyInSnapshot" ADD CONSTRAINT "DependencyInSnapshot_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SecurityDependencySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_coverImageId_fkey" FOREIGN KEY ("coverImageId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityAffect" ADD CONSTRAINT "SecurityAffect_findingId_fkey" FOREIGN KEY ("findingId") REFERENCES "SecurityFinding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "SecurityAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityFinding" ADD CONSTRAINT "SecurityFinding_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "SecurityDependency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteBuild" ADD CONSTRAINT "SiteBuild_dependencySnapshotId_fkey" FOREIGN KEY ("dependencySnapshotId") REFERENCES "SecurityDependencySnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

