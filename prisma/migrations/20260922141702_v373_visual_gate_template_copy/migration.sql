-- AlterEnum
ALTER TYPE "RedesignStage" ADD VALUE 'VISUAL_VALIDATED';

-- AlterTable
ALTER TABLE "NewsPost" ADD COLUMN     "fieldProvenance" JSONB;

-- AlterTable
ALTER TABLE "Page" ADD COLUMN     "fieldProvenance" JSONB;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "fieldProvenance" JSONB;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "fieldProvenance" JSONB;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "fieldProvenance" JSONB;

-- AlterTable
ALTER TABLE "SiteSettings" ADD COLUMN     "fieldProvenance" JSONB,
ADD COLUMN     "templateCopy" JSONB DEFAULT '{}';

-- AlterTable
ALTER TABLE "Vacancy" ADD COLUMN     "fieldProvenance" JSONB;
