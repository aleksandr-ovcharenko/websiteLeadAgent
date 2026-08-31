-- CreateTable
CREATE TABLE "ActivityEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "module" TEXT NOT NULL,
    "eventType" TEXT,
    "message" TEXT NOT NULL,
    "stage" TEXT,
    "runId" TEXT,
    "discoveryRunId" TEXT,
    "pipelineRunId" TEXT,
    "leadId" TEXT,
    "siteId" TEXT,
    "demoVariantId" TEXT,
    "durationMs" INTEGER,
    "details" JSONB DEFAULT '{}',
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "rawError" TEXT,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityEvent_timestamp_idx" ON "ActivityEvent"("timestamp");

-- CreateIndex
CREATE INDEX "ActivityEvent_level_idx" ON "ActivityEvent"("level");

-- CreateIndex
CREATE INDEX "ActivityEvent_module_idx" ON "ActivityEvent"("module");

-- CreateIndex
CREATE INDEX "ActivityEvent_runId_idx" ON "ActivityEvent"("runId");

-- CreateIndex
CREATE INDEX "ActivityEvent_leadId_idx" ON "ActivityEvent"("leadId");

-- CreateIndex
CREATE INDEX "ActivityEvent_siteId_idx" ON "ActivityEvent"("siteId");

-- CreateIndex
CREATE INDEX "ActivityEvent_demoVariantId_idx" ON "ActivityEvent"("demoVariantId");
