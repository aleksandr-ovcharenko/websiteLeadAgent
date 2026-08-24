-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('dgis');

-- CreateEnum
CREATE TYPE "LeadWebsiteStatus" AS ENUM ('UNKNOWN', 'FOUND', 'NOT_FOUND');

-- CreateEnum
CREATE TYPE "LeadEnrichmentStatus" AS ENUM ('PENDING', 'SKIPPED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadAuditStatus" AS ENUM ('PENDING', 'SKIPPED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadScoreStatus" AS ENUM ('PENDING', 'SKIPPED', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadGenerationStatus" AS ENUM ('PENDING', 'SKIPPED', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "address" TEXT,
    "categories" TEXT[],
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "website" TEXT,
    "websiteDomain" TEXT,
    "websiteStatus" "LeadWebsiteStatus" NOT NULL DEFAULT 'UNKNOWN',
    "phone" TEXT,
    "sourceUrl" TEXT,
    "enrichmentStatus" "LeadEnrichmentStatus" NOT NULL DEFAULT 'PENDING',
    "auditStatus" "LeadAuditStatus" NOT NULL DEFAULT 'PENDING',
    "scoreStatus" "LeadScoreStatus" NOT NULL DEFAULT 'PENDING',
    "generationStatus" "LeadGenerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadQuery" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadQuery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_city_idx" ON "Lead"("city");

-- CreateIndex
CREATE INDEX "Lead_websiteDomain_idx" ON "Lead"("websiteDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_source_sourceId_key" ON "Lead"("source", "sourceId");

-- CreateIndex
CREATE INDEX "LeadQuery_query_idx" ON "LeadQuery"("query");

-- CreateIndex
CREATE UNIQUE INDEX "LeadQuery_leadId_query_key" ON "LeadQuery"("leadId", "query");

-- AddForeignKey
ALTER TABLE "LeadQuery" ADD CONSTRAINT "LeadQuery_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
