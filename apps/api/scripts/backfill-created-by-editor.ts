import { PrismaClient } from "@repo/db";

const prisma = new PrismaClient();

async function backfillCreatedByEditor() {
  console.log("Starting backfill of createdByEditorId...");

  // Find all creation contributions
  const creationContributions = await prisma.contribution.findMany({
    where: { isCreation: true },
    select: {
      articleId: true,
      editorId: true,
    },
  });

  console.log(`Found ${creationContributions.length} creation contributions`);

  let updated = 0;
  let skipped = 0;

  for (const contrib of creationContributions) {
    const article = await prisma.article.findUnique({
      where: { id: contrib.articleId },
      select: { id: true, createdByEditorId: true, title: true },
    });

    if (!article) {
      console.log(`Article not found: ${contrib.articleId}`);
      skipped++;
      continue;
    }

    if (article.createdByEditorId) {
      // Already has creator, skip
      skipped++;
      continue;
    }

    // Update article with creator
    await prisma.article.update({
      where: { id: article.id },
      data: { createdByEditorId: contrib.editorId },
    });

    updated++;
    console.log(`Updated: ${article.title} -> Editor ${contrib.editorId}`);
  }

  console.log(`\nBackfill complete:`);
  console.log(`  Updated: ${updated} articles`);
  console.log(`  Skipped: ${skipped} articles`);
}

backfillCreatedByEditor()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
