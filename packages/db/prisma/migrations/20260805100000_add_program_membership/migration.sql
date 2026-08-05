-- Add Program and ProgramMember models; link articles to a program.
-- Attribution: contributions before a member's enrolledAt are excluded from
-- program metrics (enforced in sync + aggregation layers, not here).

-- CreateTable
CREATE TABLE "programs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "school" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'outreach_dashboard',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "program_members" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "editorId" TEXT NOT NULL,
    "enrolledAt" TIMESTAMP(3) NOT NULL,
    "externalId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "program_members_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "articles" ADD COLUMN "programId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "programs_name_key" ON "programs"("name");
CREATE UNIQUE INDEX "programs_slug_key" ON "programs"("slug");
CREATE UNIQUE INDEX "program_members_programId_editorId_key" ON "program_members"("programId", "editorId");
CREATE INDEX "program_members_editorId_idx" ON "program_members"("editorId");
CREATE INDEX "program_members_programId_isActive_idx" ON "program_members"("programId", "isActive");
CREATE INDEX "articles_programId_idx" ON "articles"("programId");
CREATE INDEX "contributions_editorId_editTimestamp_idx" ON "contributions"("editorId", "editTimestamp");
CREATE INDEX "contributions_articleId_editTimestamp_idx" ON "contributions"("articleId", "editTimestamp");

-- AddForeignKey
ALTER TABLE "program_members" ADD CONSTRAINT "program_members_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "program_members" ADD CONSTRAINT "program_members_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "editors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "articles" ADD CONSTRAINT "articles_programId_fkey" FOREIGN KEY ("programId") REFERENCES "programs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
