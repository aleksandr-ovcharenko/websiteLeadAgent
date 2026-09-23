-- AlterTable
ALTER TABLE "DiscoveryCandidate" ADD COLUMN     "enrichmentAttempts" JSONB,
ADD COLUMN     "websiteSource" TEXT;

-- AlterTable
ALTER TABLE "DiscoveryRun" ADD COLUMN     "reasonBreakdown" JSONB;
