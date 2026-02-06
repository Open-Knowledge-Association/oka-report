-- AlterTable
ALTER TABLE "scheduler_settings" ADD COLUMN     "disabledReason" TEXT;

-- CreateTable
CREATE TABLE "scheduler_setting_events" (
    "id" TEXT NOT NULL,
    "schedulerId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "reason" TEXT,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheduler_setting_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheduler_setting_events_schedulerId_idx" ON "scheduler_setting_events"("schedulerId");

-- CreateIndex
CREATE INDEX "scheduler_setting_events_createdAt_idx" ON "scheduler_setting_events"("createdAt");
