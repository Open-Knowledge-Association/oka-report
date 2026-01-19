-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'viewer';

-- CreateTable
CREATE TABLE "editors" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "wikimediaUserId" INTEGER,
    "displayName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "pageId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "wikiProject" TEXT NOT NULL,
    "createdByEditorId" TEXT,
    "articleCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contributions" (
    "id" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "revisionId" INTEGER NOT NULL,
    "parentId" INTEGER,
    "bytesChanged" INTEGER NOT NULL,
    "wordsAdded" INTEGER NOT NULL DEFAULT 0,
    "isCreation" BOOLEAN NOT NULL DEFAULT false,
    "editTimestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pageviews" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "views" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pageviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commons_uploads" (
    "id" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commons_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "editors_username_key" ON "editors"("username");

-- CreateIndex
CREATE UNIQUE INDEX "articles_pageId_wikiProject_key" ON "articles"("pageId", "wikiProject");

-- CreateIndex
CREATE INDEX "contributions_editorId_idx" ON "contributions"("editorId");

-- CreateIndex
CREATE INDEX "contributions_articleId_idx" ON "contributions"("articleId");

-- CreateIndex
CREATE INDEX "contributions_editTimestamp_idx" ON "contributions"("editTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "contributions_revisionId_articleId_key" ON "contributions"("revisionId", "articleId");

-- CreateIndex
CREATE INDEX "pageviews_date_idx" ON "pageviews"("date");

-- CreateIndex
CREATE UNIQUE INDEX "pageviews_articleId_date_key" ON "pageviews"("articleId", "date");

-- CreateIndex
CREATE INDEX "commons_uploads_editorId_idx" ON "commons_uploads"("editorId");

-- CreateIndex
CREATE UNIQUE INDEX "commons_uploads_fileName_key" ON "commons_uploads"("fileName");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_jobType_idx" ON "sync_jobs"("jobType");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_createdByEditorId_fkey" FOREIGN KEY ("createdByEditorId") REFERENCES "editors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "editors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contributions" ADD CONSTRAINT "contributions_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pageviews" ADD CONSTRAINT "pageviews_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "articles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commons_uploads" ADD CONSTRAINT "commons_uploads_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "editors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
