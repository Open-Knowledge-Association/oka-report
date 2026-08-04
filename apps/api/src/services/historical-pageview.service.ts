import type { PrismaClient } from "@repo/db/generated/prisma/client";
import { WikimediaClient, WikimediaClientError } from "@repo/utils";

export class HistoricalPageviewService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly wikimedia: WikimediaClient,
  ) {}

  async syncYear(year: number, jobId: string) {
    const start = `${year}0101`;
    const now = new Date();
    const end = year === now.getUTCFullYear()
      ? `${year}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`
      : `${year}1231`;
    const articles = await this.prisma.article.findMany({
      where: { pageId: { not: null } },
      orderBy: { id: "asc" },
      select: { id: true, title: true, wikiProject: true },
    });
    const job = await this.prisma.syncJob.findUnique({ where: { id: jobId }, select: { metadata: true } });
    const metadata = job?.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata) ? job.metadata as Record<string, unknown> : {};
    let processed = Math.max(0, Math.min(articles.length, Number(metadata.processedArticles ?? 0)));
    let success = Number(metadata.success ?? 0);
    let notFound = Number(metadata.notFound ?? 0);
    let failed = Number(metadata.failed ?? 0);
    const checkpoint = async (stage: string) => {
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: { metadata: { year, totalArticles: articles.length, processedArticles: processed, success, notFound, failed, stage } },
      });
    };
    await checkpoint(`Historical pageviews ${year} (0/${articles.length})`);
    for (const article of articles.slice(processed)) {
      try {
        const project = article.wikiProject.replace(".org", "");
        const items = await this.wikimedia.getPageviews(article.title, project, start, end, "all-agents", "monthly");
        for (const item of items) {
          const periodStart = new Date(`${item.date}T00:00:00.000Z`);
          const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0));
          await this.prisma.historicalPageview.upsert({
            where: { articleId_periodStart_granularity_agentType: { articleId: article.id, periodStart, granularity: "MONTHLY", agentType: "ALL_AGENTS" } },
            create: { articleId: article.id, periodStart, periodEnd, granularity: "MONTHLY", agentType: "ALL_AGENTS", views: item.views, status: "SUCCESS" },
            update: { periodEnd, views: item.views, status: "SUCCESS", error: null, fetchedAt: new Date() },
          });
        }
        success += 1;
      } catch (error) {
        if (error instanceof WikimediaClientError && error.status === 404) notFound += 1;
        else failed += 1;
      }
      processed += 1;
      if (processed % 10 === 0 || processed === articles.length) await checkpoint(`Historical pageviews ${year} (${processed}/${articles.length})`);
    }
    await checkpoint(`Completed historical pageviews ${year}`);
    return { totalArticles: articles.length, processed, success, notFound, failed };
  }
}
