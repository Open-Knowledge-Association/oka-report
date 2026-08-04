import { prisma } from "./index";

type Article = { id: string; title: string; wikiProject: string };
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBatch(project: string, articles: Article[]) {
  const [language, site] = project.split(".");
  if (!language || !site) return new Map<string, number>();
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "info",
    titles: articles.map((article) => article.title).join("|"),
  });
  for (let attempt = 0; attempt < 7; attempt++) {
    const response = await fetch(`https://${language}.${site}.org/w/api.php?${params}`, {
      headers: { "User-Agent": "OKA-Report/1.0 (data verification)" },
    });
    if (response.ok) {
      const body = (await response.json()) as {
        query?: { pages?: Array<{ title: string; pageid?: number; missing?: boolean }> };
      };
      return new Map(
        (body.query?.pages ?? [])
          .filter((page) => !page.missing && typeof page.pageid === "number")
          .map((page) => [page.title.replaceAll(" ", "_"), page.pageid!]),
      );
    }
    if (response.status === 429 || response.status >= 500) {
      await sleep(Math.min(60000, 3000 * (attempt + 1)));
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
  let updated = 0,
    missing = 0,
    errors = 0;
  const groups = new Map<string, Article[]>();
  for (const article of articles) {
    const group = groups.get(article.wikiProject) ?? [];
    group.push(article);
    groups.set(article.wikiProject, group);
  }
  for (const [project, projectArticles] of groups) {
    for (let offset = 0; offset < projectArticles.length; offset += 50) {
      const batch = projectArticles.slice(offset, offset + 50);
      try {
        const pageIds = await fetchBatch(project, batch);
        for (const article of batch) {
          const pageId = pageIds.get(article.title.replaceAll(" ", "_"));
          if (pageId == null) {
            missing++;
            continue;
          }
          try {
            await prisma.article.update({ where: { id: article.id }, data: { pageId } });
            updated++;
          } catch (error) {
            errors++;
            console.error(
              `[pageid] conflict ${article.title}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      } catch (error) {
        errors += batch.length;
        console.error(
          `[pageid] batch ${project} ${offset}/${projectArticles.length}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      console.log(
        `[pageid] ${Math.min(offset + 50, projectArticles.length)}/${projectArticles.length} project=${project} updated=${updated} missing=${missing} errors=${errors}`,
      );
      await sleep(1000);
    }
  }
  console.log(JSON.stringify({ total: articles.length, updated, missing, errors }));
  await prisma.$disconnect();
}
main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
