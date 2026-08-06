import type { PrismaClient } from "@repo/db/generated/prisma/client";
import { WikimediaClient } from "@repo/utils";
import { WikimediaClientError } from "@repo/utils";

interface BackfillResult {
  articles: number;
  processed: number;
  skipped404: number;
  failed: number;
  pageviewsWritten: number;
  oldestDate: string | null;
  newestDate: string | null;
  totalArticlesWithData: number;
}

/**
 * Backfills DAILY pageviews per article from the Wikimedia Pageviews API.
 *
 * Attribution window: for each article, we only fetch data starting from the
 * article's earliest program activity (earliest contribution by a program
 * editor, filtered by enrollment) — before that date the article was not part
 * of the program, so no need to fetch. Falls back to program.startAt when no
 * contribution exists yet.
 *
 * Writes both ALL_AGENTS (total) and USER (humans-only) rows per article/day,
 * idempotently (upsert). Checkpointed per article so long backfills survive
 * worker restarts (lease expiry).
 */
export class DailyPageviewBackfillService {
  private readonly prisma: PrismaClient;
  private readonly wikimedia: WikimediaClient;

  constructor(prisma: PrismaClient, wikimedia: WikimediaClient) {
    this.prisma = prisma;
    this.wikimedia = wikimedia;
  }

  async backfillAll(jobId: string): Promise<BackfillResult> {
    const program = await this.prisma.program.findFirst({ where: { slug: "OKA" } });
    if (!program) throw new Error("OKA program not found; run program_sync first");

    // All articles tagged to the program with a pageId (needed for the API).
    const articles = await this.prisma.article.findMany({
      where: { programId: program.id, pageId: { not: null } },
      select: { id: true, title: true, wikiProject: true },
      orderBy: { title: "asc" },
    });

    // Article -> earliest program activity (contribution by enrolled editor).
    const contributionRows = await this.prisma.contribution.findMany({
      where: { article: { programId: program.id } },
      select: { articleId: true, editTimestamp: true, editorId: true },
    });
    const enrolledAtByEditor = new Map<string, Date>();
    const members = await this.prisma.programMember.findMany({
      where: { programId: program.id, isActive: true },
      select: { editorId: true, enrolledAt: true },
    });
    for (const m of members) {
      const cur = enrolledAtByEditor.get(m.editorId);
      if (!cur || m.enrolledAt < cur) enrolledAtByEditor.set(m.editorId, m.enrolledAt);
    }
    const earliestByArticle = new Map<string, Date>();
    for (const row of contributionRows) {
      const enrolledAt = enrolledAtByEditor.get(row.editorId);
      if (!enrolledAt || row.editTimestamp < enrolledAt) continue; // pre-join, ignore
      const cur = earliestByArticle.get(row.articleId);
      if (!cur || row.editTimestamp < cur) earliestByArticle.set(row.articleId, row.editTimestamp);
    }

    // Resume support: job metadata stores processed article count.
    const job = await this.prisma.syncJob.findUnique({ where: { id: jobId } });
    const startIdx = job?.metadata && typeof job.metadata === "object"
      ? Number((job.metadata as { processedArticles?: unknown }).processedArticles ?? 0)
      : 0;

    const now = new Date();
    const todayStr = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}`;

    const result: BackfillResult = {
      articles: articles.length,
      processed: 0,
      skipped404: 0,
      failed: 0,
      pageviewsWritten: 0,
      oldestDate: null,
      newestDate: null,
      totalArticlesWithData: 0,
    };

    let processedCount = startIdx;
    const remaining = articles.slice(startIdx);

    // Worker pool with bounded concurrency; per-article errors recorded, 429/5xx
    // retried with backoff. Progress checkpointed every N articles.
    const CONCURRENCY = 5;
    let nextIndex = 0;
    let inFlight = 0;
    let shouldStop = false;
    let cooldownUntil = 0; // epoch ms — pause then resume instead of stopping

    const processArticle = async (article: (typeof articles)[number]): Promise<void> => {
      // Cutoff: earliest program activity, else program start.
      const cutoff = earliestByArticle.get(article.id) ?? program.startAt;
      const cutoffStr = `${cutoff.getUTCFullYear()}${String(cutoff.getUTCMonth() + 1).padStart(2, "0")}${String(cutoff.getUTCDate()).padStart(2, "0")}`;

      let articleHasData = false;
      let oldest: string | null = null;
      let newest: string | null = null;

      for (const agentType of ["all-agents", "user"] as const) {
        let pageviews: Array<{ date: string; views: number }>;
        try {
          pageviews = await this.withRetry(() =>
            this.wikimedia.getPageviews(
              article.title,
              toPageviewsProject(article.wikiProject),
              cutoffStr,
              todayStr,
              agentType,
            ),
          );
        } catch (error) {
          if (error instanceof WikimediaClientError && error.status === 404) {
            result.skipped404 += 1;
            continue;
          }
          if (error instanceof WikimediaClientError && (error.status === 429 || error.status >= 500)) {
            console.warn(`[DailyBackfill] transient ${error.status} on ${article.title}; cooldown 60s`);
            // Pause (cooldown) then resume — do NOT stop the whole backfill.
            cooldownUntil = Date.now() + 60_000;
            shouldStop = true;
            return;
          }
          result.failed += 1;
          console.warn(`[DailyBackfill] failed ${article.title}: ${error instanceof Error ? error.message : String(error)}`);
          continue;
        }

        for (const item of pageviews) {
          await this.prisma.pageview.upsert({
            where: {
              articleId_date_type_agentType: {
                articleId: article.id,
                date: parsePageviewDate(item.date),
                type: "DAILY",
                agentType: agentType === "user" ? "USER" : "ALL_AGENTS",
              },
            },
            create: {
              articleId: article.id,
              date: parsePageviewDate(item.date),
              type: "DAILY",
              agentType: agentType === "user" ? "USER" : "ALL_AGENTS",
              views: item.views,
            },
            update: { views: item.views },
          });
          result.pageviewsWritten += 1;
          articleHasData = true;
          if (!oldest || item.date < oldest) oldest = item.date;
          if (!newest || item.date > newest) newest = item.date;
        }
      }

      if (articleHasData) {
        result.totalArticlesWithData += 1;
        if (!result.oldestDate || (oldest && oldest < result.oldestDate)) result.oldestDate = oldest;
        if (!result.newestDate || (newest && newest > result.newestDate)) result.newestDate = newest;
      }

      processedCount += 1;
      result.processed += 1;
    };

    while (nextIndex < remaining.length) {
      // If in cooldown (transient 429/5xx), wait for it to expire then resume.
      if (shouldStop) {
        if (Date.now() < cooldownUntil) {
          await sleep(5_000);
          continue;
        }
        console.warn(`[DailyBackfill] cooldown over — resuming from index ${nextIndex}`);
        shouldStop = false;
      }
      // Fill up to CONCURRENCY in-flight tasks.
      while (inFlight < CONCURRENCY && nextIndex < remaining.length && !shouldStop) {
        const article = remaining[nextIndex];
        nextIndex += 1;
        inFlight += 1;
        processArticle(article).finally(() => {
          inFlight -= 1;
        });
      }
      await sleep(50);
      if (inFlight === 0 && nextIndex < remaining.length && !shouldStop) {
        // progress checkpoint every ~25 articles
        if (processedCount % 25 < CONCURRENCY) {
          await this.prisma.syncJob.update({
            where: { id: jobId },
            data: { metadata: { ...(job?.metadata as object ?? {}), processedArticles: processedCount } as never },
          });
        }
      }
    }
    // Wait for all in-flight to settle.
    while (inFlight > 0) await sleep(50);

    // Final checkpoint.
    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: { metadata: { ...(job?.metadata as object ?? {}), processedArticles: processedCount } as never },
    });

    return result;
  }

  /** Retry a fetch up to 5 times with exponential backoff on 429/5xx. */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await fn();
      } catch (error) {
        attempt += 1;
        if (
          error instanceof WikimediaClientError &&
          (error.status === 429 || error.status >= 500) &&
          attempt <= 5
        ) {
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw error;
      }
    }
  }
}

function parsePageviewDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00Z`);
}

const toPageviewsProject = (wikiProject: string) => wikiProject.replace(/\.org$/, "");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
