-- CreateEnum
CREATE TYPE "Granularity" AS ENUM ('MONTH', 'YEAR');

-- CreateTable
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL,
    "granularity" "Granularity" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "programId" TEXT,
    "wikiProject" TEXT,
    "edits" INTEGER NOT NULL,
    "wordsAdded" INTEGER NOT NULL,
    "pageviews" INTEGER NOT NULL,
    "articlesCreated" INTEGER NOT NULL,
    "articlesEdited" INTEGER NOT NULL,
    "editors" INTEGER NOT NULL,
    "commonsUploads" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshots_granularity_periodStart_programId_wikiPr_key" ON "metric_snapshots"("granularity", "periodStart", "programId", "wikiProject");
CREATE INDEX "metric_snapshots_granularity_periodStart_idx" ON "metric_snapshots"("granularity", "periodStart");
CREATE INDEX "metric_snapshots_programId_granularity_periodStart_idx" ON "metric_snapshots"("programId", "granularity", "periodStart");
CREATE INDEX "metric_snapshots_wikiProject_granularity_periodStart_idx" ON "metric_snapshots"("wikiProject", "granularity", "periodStart");

-- AddForeignKey
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
