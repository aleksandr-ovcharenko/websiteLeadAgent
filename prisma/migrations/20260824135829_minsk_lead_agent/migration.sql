-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "leadScore" INTEGER,
ADD COLUMN     "scoreDetails" JSONB,
ADD COLUMN     "scoredAt" TIMESTAMP(3);
