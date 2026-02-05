-- AlterTable
ALTER TABLE "sync_jobs" ADD COLUMN     "isCancelled" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "sync_jobs_isCancelled_idx" ON "sync_jobs"("isCancelled");
