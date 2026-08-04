import { prisma } from "./index";

type Article = { id: string; title: string; wikiProject: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const parseProject = (wikiProject: string) => {
  const [language, project] = wikiProject.split(".");
  return { language, project };
};

async function lookup(article: Article): Promise<number | null> {
  const { language, project } = parseProject(article.wikiProject);
  if (!language || !project) return null;
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    titles: article.title,
    prop: "info",
    formatversion: "2",
  });
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(`https://${language}.${project}.org/w/api.php?${params}`, {
      headers: { "User-Agent": "OKA-Report/1.0 (data verification)" },
    });
    if (response.ok) {
      const body = (await response.json()) as {
        query?: { pages?: Array<{ pageid?: number; missing?: boolean }> };
      };
      const page = body.query?.pages?.[0];
      return page && !page.missing && typeof page.pageid === "number" ? page.pageid : null;
    }
    if (response.status === 429 || response.status >= 500) {
      await sleep(Math.min(30000, 2000 * (attempt + 1)));
      continue;
    }
    throw new Error(`HTTP ${response.status}`);
  }
  throw new Error("HTTP retry limit exceeded");
}

async function main() {
  const articles = await prisma.article.findMany({
    where: { source: "OUTREACH_DASHBOARD", pageId: null },
    select: { id: true, title: true, wikiProject: true },
    orderBy: { id: "asc" },
  });
  let processed = 0,
    updated = 0,
    missing = 0,
    conflicts = 0,
    errors = 0;
  let cursor = 0;
  const concurrency = 2;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= articles.length) return;
      const article = articles[index];
      if (!article) return;
      try {
        const pageId = await lookup(article);
        if (pageId == null) missing++;
        else {
          try {
            await prisma.article.update({ where: { id: article.id }, data: { pageId } });
            updated++;
          } catch (error) {
            conflicts++;
            console.error(
              `[pageid] conflict ${article.id} ${article.title}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      } catch (error) {
        errors++;
        console.error(
          `[pageid] error ${article.id} ${article.title}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      processed++;
      if (processed % 25 === 0 || processed === articles.length) {
        console.log(
          `[pageid] ${processed}/${articles.length} updated=${updated} missing=${missing} conflicts=${conflicts} errors=${errors}`,
        );
      }
      await sleep(1000);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(
    JSON.stringify({ total: articles.length, processed, updated, missing, conflicts, errors }),
  );
  await prisma.$disconnect();
}
main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
