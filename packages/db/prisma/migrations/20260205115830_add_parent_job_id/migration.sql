-- DropIndex
DROP INDEX "sync_jobs_isCancelled_idx";

-- AlterTable
ALTER TABLE "sync_jobs" ADD COLUMN     "parentJobId" TEXT;

-- CreateIndex
CREATE INDEX "sync_jobs_parentJobId_idx" ON "sync_jobs"("parentJobId");

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "sync_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
