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

type OutreachArticleRow = {
  id: string;
  outreachId: number;
  title: string;
  language: string;
  project: string;
  url: string;
  characterSum: number;
  referencesCount: number;
  isNewArticle: boolean;
  rating: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type OutreachPageviewRow = {
  id: string;
  outreachArticleId: string;
  snapshotDate: Date;
  cumulativeViews: number;
  createdAt: Date;
};

type OutreachEditorRow = {
  id: string;
  outreachArticleId: string;
  editorId: string;
  createdAt: Date;
};

const numberFromCount = (value: unknown): number => {
  if (typeof value === "bigint") {
    return Number(value);
  }
  return Number(value ?? 0);
};

const groupBy = <T>(rows: T[], getKey: (row: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = getKey(row);
    const existing = map.get(key);
    if (existing) {
      existing.push(row);
    } else {
      map.set(key, [row]);
    }
  }
  return map;
};

async function main() {
  console.log("Starting unified articles migration...");

  const result = await prisma.$transaction(async (tx: any) => {
    const articlesBefore = await tx.article.count();
    const pageviewsBefore = await tx.pageview.count();
    const articleEditorsBefore = await tx.articleEditor.count();

    const [{ count: outreachBeforeRaw }] = await tx.$queryRaw<
      Array<{ count: bigint | number | string }>
    >`SELECT COUNT(*)::bigint as count FROM outreach_articles`;
    const [{ count: outreachPageviewsBeforeRaw }] = await tx.$queryRaw<
      Array<{ count: bigint | number | string }>
    >`SELECT COUNT(*)::bigint as count FROM outreach_article_pageviews`;
    const [{ count: outreachEditorsBeforeRaw }] = await tx.$queryRaw<
      Array<{ count: bigint | number | string }>
    >`SELECT COUNT(*)::bigint as count FROM outreach_article_editors`;

    const outreachBefore = numberFromCount(outreachBeforeRaw);
    const outreachPageviewsBefore = numberFromCount(outreachPageviewsBeforeRaw);
    const outreachEditorsBefore = numberFromCount(outreachEditorsBeforeRaw);

    console.log(
      `Before: ${articlesBefore} articles, ${outreachBefore} outreach articles, ${pageviewsBefore} pageviews, ${articleEditorsBefore} article-editor relations`,
    );

    const articlesUpdated = await tx.article.updateMany({
      data: { source: ARTICLE_SOURCE_MEDIAWIKI },
    });
    console.log(`Updated ${articlesUpdated.count} articles with source=MEDIAWIKI`);

    const pageviewsUpdated = await tx.pageview.updateMany({
      where: { type: null as any },
      data: { type: PAGEVIEW_TYPE_DAILY },
    });
    if (pageviewsUpdated.count > 0) {
      console.log(`Updated ${pageviewsUpdated.count} pageviews with type=DAILY`);
    }

    const outreachArticles = await tx.$queryRaw<OutreachArticleRow[]>`
      SELECT * FROM outreach_articles ORDER BY "createdAt" ASC
    `;
    const outreachPageviews = await tx.$queryRaw<OutreachPageviewRow[]>`
      SELECT * FROM outreach_article_pageviews
    `;
    const outreachEditors = await tx.$queryRaw<OutreachEditorRow[]>`
      SELECT * FROM outreach_article_editors
    `;

    const pageviewsByOutreachId = groupBy(outreachPageviews, (row) => row.outreachArticleId);
    const editorsByOutreachId = groupBy(outreachEditors, (row) => row.outreachArticleId);

    let processedArticles = 0;
    let matchedArticles = 0;
    let createdArticles = 0;
    let processedPageviews = 0;
    let processedEditors = 0;

    for (const outreachArticle of outreachArticles) {
      const wikiProject = normalizeWikiProject(outreachArticle.language, outreachArticle.project);

      const existing = await tx.article.findFirst({
        where: { wikiProject, title: outreachArticle.title },
      });

      let articleId: string;

      if (existing) {
        matchedArticles += 1;
        articleId = existing.id;
        await tx.article.update({
          where: { id: articleId },
          data: {
            outreachId: outreachArticle.outreachId,
            url: outreachArticle.url,
            characterSum: outreachArticle.characterSum,
            referencesCount: outreachArticle.referencesCount,
            isNewArticle: outreachArticle.isNewArticle,
            rating: outreachArticle.rating,
            source: ARTICLE_SOURCE_OUTREACH,
          },
        });
      } else {
        createdArticles += 1;
        const created = await tx.article.create({
          data: {
            pageId: null,
            title: outreachArticle.title,
            wikiProject,
            source: ARTICLE_SOURCE_OUTREACH,
            outreachId: outreachArticle.outreachId,
            url: outreachArticle.url,
            characterSum: outreachArticle.characterSum,
            referencesCount: outreachArticle.referencesCount,
            isNewArticle: outreachArticle.isNewArticle,
            rating: outreachArticle.rating,
          },
        });
        articleId = created.id;
      }

      const articleEditors = editorsByOutreachId.get(outreachArticle.id) ?? [];
      for (const editor of articleEditors) {
        await tx.articleEditor.upsert({
          where: {
            articleId_editorId: {
              articleId,
              editorId: editor.editorId,
            },
          },
          create: {
            articleId,
            editorId: editor.editorId,
            isAuthor: false,
          },
          update: {},
        });
        processedEditors += 1;
      }

      const articlePageviews = pageviewsByOutreachId.get(outreachArticle.id) ?? [];
      for (const pageview of articlePageviews) {
        await tx.pageview.upsert({
          where: {
            articleId_date: {
              articleId,
              date: pageview.snapshotDate,
            },
          },
          create: {
            articleId,
            date: pageview.snapshotDate,
            type: PAGEVIEW_TYPE_CUMULATIVE,
            views: pageview.cumulativeViews,
            cumulativeViews: pageview.cumulativeViews,
          },
          update: {
            type: PAGEVIEW_TYPE_CUMULATIVE,
            views: pageview.cumulativeViews,
            cumulativeViews: pageview.cumulativeViews,
          },
        });
        processedPageviews += 1;
      }

      processedArticles += 1;
      if (processedArticles % 100 === 0 || processedArticles === outreachArticles.length) {
        console.log(`Processed ${processedArticles}/${outreachArticles.length} outreach articles`);
      }
    }

    const articlesAfter = await tx.article.count();
    const pageviewsAfter = await tx.pageview.count();
    const articleEditorsAfter = await tx.articleEditor.count();

    const expectedArticlesAfter = articlesBefore + createdArticles;

    if (processedArticles !== outreachBefore) {
      throw new Error(
        `Outreach article count mismatch: expected ${outreachBefore}, processed ${processedArticles}`,
      );
    }
    if (processedPageviews !== outreachPageviewsBefore) {
      throw new Error(
        `Outreach pageview count mismatch: expected ${outreachPageviewsBefore}, processed ${processedPageviews}`,
      );
    }
    if (processedEditors !== outreachEditorsBefore) {
      throw new Error(
        `Outreach editor count mismatch: expected ${outreachEditorsBefore}, processed ${processedEditors}`,
      );
    }
    if (articlesAfter !== expectedArticlesAfter) {
      throw new Error(
        `Article count mismatch: expected ${expectedArticlesAfter}, got ${articlesAfter}`,
      );
    }

    return {
      articlesBefore,
      outreachBefore,
      pageviewsBefore,
      articleEditorsBefore,
      matchedArticles,
      createdArticles,
      processedArticles,
      processedPageviews,
      processedEditors,
      articlesAfter,
      pageviewsAfter,
      articleEditorsAfter,
    };
  });

  console.log("Migration summary:");
  console.log(
    `Articles: ${result.articlesBefore} -> ${result.articlesAfter} (created ${result.createdArticles}, matched ${result.matchedArticles})`,
  );
  console.log(
    `Pageviews: ${result.pageviewsBefore} -> ${result.pageviewsAfter} (processed ${result.processedPageviews})`,
  );
  console.log(
    `Article editors: ${result.articleEditorsBefore} -> ${result.articleEditorsAfter} (processed ${result.processedEditors})`,
  );
  console.log("Migration complete!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
