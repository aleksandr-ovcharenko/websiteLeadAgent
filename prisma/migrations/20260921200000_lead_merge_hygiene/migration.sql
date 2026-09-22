-- CreateEnum
CREATE TYPE "LeadMergeStatus" AS ENUM ('NONE', 'MERGED', 'BLOCKED_FOR_MANUAL_MERGE');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "duplicateGroupKey" TEXT,
ADD COLUMN     "mergeStatus" "LeadMergeStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "mergedIntoLeadId" TEXT;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_mergedIntoLeadId_fkey" FOREIGN KEY ("mergedIntoLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

