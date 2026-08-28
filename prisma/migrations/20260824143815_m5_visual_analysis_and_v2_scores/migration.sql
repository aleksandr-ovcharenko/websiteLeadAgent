-- CreateEnum
CREATE TYPE "ManualReviewStatus" AS ENUM ('UNREVIEWED', 'GOOD', 'BAD', 'UNSURE');

-- CreateEnum
CREATE TYPE "VisualAnalysisStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "businessConfidenceScore" INTEGER,
ADD COLUMN     "leadScoreV2" INTEGER,
ADD COLUMN     "manualReviewNote" TEXT,
ADD COLUMN     "manualReviewStatus" "ManualReviewStatus" NOT NULL DEFAULT 'UNREVIEWED',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "scoreDetailsV2" JSONB,
ADD COLUMN     "technicalQualityScore" INTEGER,
ADD COLUMN     "visualQualityScore" INTEGER;

-- CreateTable
CREATE TABLE "VisualAnalysis" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "status" "VisualAnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "modernity" INTEGER NOT NULL,
    "visualQuality" INTEGER NOT NULL,
    "mobileUX" INTEGER NOT NULL,
    "trust" INTEGER NOT NULL,
    "ctaQuality" INTEGER NOT NULL,
    "contentStructure" INTEGER NOT NULL,
    "visualHierarchy" INTEGER NOT NULL,
    "brandConsistency" INTEGER NOT NULL,
    "redesignPotential" INTEGER NOT NULL,
    "problems" JSONB NOT NULL,
    "strengths" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "usage" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisualAnalysis_leadId_key" ON "VisualAnalysis"("leadId");

-- AddForeignKey
ALTER TABLE "VisualAnalysis" ADD CONSTRAINT "VisualAnalysis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
