import { createRequire } from "node:module";
import "dotenv/config";

const require = createRequire(new URL(`file://${process.cwd()}/`));
const { PrismaClient } = require("../generated/prisma/client") as {
  PrismaClient: new (...args: any[]) => any;
};

const prisma = new PrismaClient();

const ARTICLE_SOURCE_MEDIAWIKI = "MEDIAWIKI";
const ARTICLE_SOURCE_OUTREACH = "OUTREACH_DASHBOARD";
const PAGEVIEW_TYPE_DAILY = "DAILY";
const PAGEVIEW_TYPE_CUMULATIVE = "CUMULATIVE";

const normalizeWikiProject = (language: string, project: string): string =>
  `${language}.${project}.org`;

async function main() {
  console.log("Starting unified articles migration...");

  const articlesBefore = await prisma.article.count();
  const outreachBefore = await prisma.outreachArticle.count();
  console.log(`Before: ${articlesBefore} articles, ${outreachBefore} outreach articles`);

  await prisma.$transaction(async (tx: any) => {
    const txAny = tx as any;

    await txAny.article.updateMany({
      where: { source: null as any },
      data: { source: ARTICLE_SOURCE_MEDIAWIKI },
    });
    console.log("Updated existing articles with source=MEDIAWIKI");

    await txAny.pageview.updateMany({
      where: { type: null as any },
      data: { type: PAGEVIEW_TYPE_DAILY },
    });
    console.log("Updated existing pageviews with type=DAILY");

    const outreachArticles = await tx.outreachArticle.findMany({
      include: { pageviews: true, editors: true },
    });

    for (const oa of outreachArticles) {
      const wikiProject = normalizeWikiProject(oa.language, oa.project);

      const existing = await txAny.article.findFirst({
        where: { wikiProject, title: oa.title },
      });

      if (existing) {
        await txAny.article.update({
          where: { id: existing.id },
          data: {
            outreachId: oa.outreachId,
            url: oa.url,
            characterSum: oa.characterSum,
            referencesCount: oa.referencesCount,
            isNewArticle: oa.isNewArticle,
            rating: oa.rating,
          },
        });

        for (const editor of oa.editors) {
          await txAny.articleEditor.upsert({
            where: {
              articleId_editorId: {
                articleId: existing.id,
                editorId: editor.editorId,
              },
            },
            create: {
              articleId: existing.id,
              editorId: editor.editorId,
              isAuthor: editor.isAuthor,
            },
            update: { isAuthor: editor.isAuthor },
          });
        }

        for (const pv of oa.pageviews) {
          await txAny.pageview.create({
            data: {
              articleId: existing.id,
              date: pv.snapshotDate,
              views: 0,
              type: PAGEVIEW_TYPE_CUMULATIVE,
              cumulativeViews: pv.cumulativeViews,
            },
          });
        }
      } else {
        const newArticle = await txAny.article.create({
          data: {
            pageId: 0,
            title: oa.title,
            wikiProject,
            source: ARTICLE_SOURCE_OUTREACH,
            outreachId: oa.outreachId,
            url: oa.url,
            characterSum: oa.characterSum,
            referencesCount: oa.referencesCount,
            isNewArticle: oa.isNewArticle,
            rating: oa.rating,
          },
        });

        for (const editor of oa.editors) {
          await txAny.articleEditor.create({
            data: {
              articleId: newArticle.id,
              editorId: editor.editorId,
              isAuthor: editor.isAuthor,
            },
          });
        }

        for (const pv of oa.pageviews) {
          await txAny.pageview.create({
            data: {
              articleId: newArticle.id,
              date: pv.snapshotDate,
              views: 0,
              type: PAGEVIEW_TYPE_CUMULATIVE,
              cumulativeViews: pv.cumulativeViews,
            },
          });
        }
      }
    }

    console.log(`Migrated ${outreachArticles.length} outreach articles`);
  });

  const articlesAfter = await prisma.article.count();
  const articleEditors = await (prisma as any).articleEditor.count();
  console.log(`After: ${articlesAfter} articles, ${articleEditors} article-editor relations`);
  console.log("Migration complete!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
