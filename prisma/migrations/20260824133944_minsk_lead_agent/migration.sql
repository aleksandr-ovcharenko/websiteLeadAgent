-- CreateTable
CREATE TABLE "LighthouseReport" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "reportPath" TEXT NOT NULL,
    "performance" INTEGER NOT NULL,
    "accessibility" INTEGER NOT NULL,
    "seo" INTEGER NOT NULL,
    "bestPractices" INTEGER NOT NULL,
    "lcp" DOUBLE PRECISION,
    "cls" DOUBLE PRECISION,
    "inp" DOUBLE PRECISION,
    "fcp" DOUBLE PRECISION,
    "tbt" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LighthouseReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LighthouseReport_leadId_key" ON "LighthouseReport"("leadId");

-- AddForeignKey
ALTER TABLE "LighthouseReport" ADD CONSTRAINT "LighthouseReport_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
