ALTER TABLE "sync_jobs" ADD COLUMN "leaseOwner" TEXT;
ALTER TABLE "sync_jobs" ADD COLUMN "leaseVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sync_jobs" ADD COLUMN "heartbeatAt" TIMESTAMP(3);
ALTER TABLE "sync_jobs" ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);
CREATE INDEX "sync_jobs_leaseExpiresAt_idx" ON "sync_jobs"("leaseExpiresAt");
