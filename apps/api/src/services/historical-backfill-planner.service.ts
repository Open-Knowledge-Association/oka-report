import type { Prisma, PrismaClient } from "@repo/db/generated/prisma/client";

const WIKIMEDIA_PAGEVIEWS_START_YEAR = 2015;
const CURRENT_YEAR_REFRESH_DAYS = 7;

type JobMetadata = Record<string, unknown>;

const metadataOf = (value: unknown): JobMetadata =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JobMetadata) : {};

export class HistoricalBackfillPlanner {
  constructor(private readonly prisma: PrismaClient) {}

  async queueNextYear() {
    const active = await this.prisma.syncJob.findFirst({
      where: {
        status: { in: ["pending", "running"] },
        jobType: {
          in: [
            "full",
            "editors",
            "outreach_articles",
            "contributions",
            "pageviews",
            "commons",
            "historical_pageviews",
            "history_backfill",
          ],
        },
      },
      select: { id: true, jobType: true },
    });
    if (active) return { queued: false, reason: "active_job", job: active } as const;

    const [firstContribution, firstArticle] = await Promise.all([
      this.prisma.contribution.findFirst({
        orderBy: { editTimestamp: "asc" },
        select: { editTimestamp: true },
      }),
      this.prisma.article.findFirst({
        where: { articleCreatedAt: { not: null } },
        orderBy: { articleCreatedAt: "asc" },
        select: { articleCreatedAt: true },
      }),
    ]);
    const earliest = [firstContribution?.editTimestamp, firstArticle?.articleCreatedAt]
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    if (!earliest) return { queued: false, reason: "no_activity" } as const;

    const currentYear = new Date().getUTCFullYear();
    const firstYear = Math.max(WIKIMEDIA_PAGEVIEWS_START_YEAR, earliest.getUTCFullYear());
    const completed = await this.prisma.syncJob.findMany({
      where: { jobType: "historical_pageviews", status: "completed" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true, metadata: true },
    });

    for (let year = firstYear; year <= currentYear; year += 1) {
      const endExclusive = new Date(Date.UTC(year + 1, 0, 1));
      const eligibleArticles = await this.prisma.article.count({
        where: {
          pageId: { not: null },
          OR: [{ articleCreatedAt: { lt: endExclusive } }, { articleCreatedAt: null }],
        },
      });
      if (eligibleArticles === 0) continue;

      const latest = completed.find((job) => Number(metadataOf(job.metadata).year) === year);
      const metadata = metadataOf(latest?.metadata);
      const processed = Number(metadata.processedArticles ?? metadata.processed ?? 0);
      const failed = Number(metadata.failed ?? 0);
      const freshCurrentYear =
        year === currentYear &&
        latest?.completedAt &&
        Date.now() - latest.completedAt.getTime() < CURRENT_YEAR_REFRESH_DAYS * 86_400_000;
      const complete = processed >= eligibleArticles && failed === 0;
      if (complete && (year < currentYear || freshCurrentYear)) continue;

      const job = await this.prisma.syncJob.create({
        data: {
          jobType: "historical_pageviews",
          status: "pending",
          metadata: {
            year,
            expectedArticles: eligibleArticles,
            reason: complete ? "refresh_current_year" : "fill_historical_gap",
          } satisfies Prisma.InputJsonObject,
        },
      });
      return { queued: true, year, job } as const;
    }

    return { queued: false, reason: "complete" } as const;
  }

  async queueSnapshotRebuild(year: number, sourceJobId: string) {
    const existing = await this.prisma.syncJob.findMany({
      where: {
        jobType: "history_backfill",
        status: { in: ["pending", "running", "completed"] },
      },
      select: { id: true, metadata: true },
    });
    const duplicate = existing.find(
      (job) => metadataOf(job.metadata).historicalSourceJobId === sourceJobId,
    );
    if (duplicate) return duplicate;

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const end =
      year === currentYear
        ? new Date(Date.UTC(year, now.getUTCMonth(), Math.max(1, now.getUTCDate() - 1)))
        : new Date(Date.UTC(year, 11, 31));
    return this.prisma.syncJob.create({
      data: {
        jobType: "history_backfill",
        status: "pending",
        metadata: {
          startDate: new Date(Date.UTC(year, 0, 1)).toISOString(),
          endDate: end.toISOString(),
          year,
          historicalSourceJobId: sourceJobId,
          reason: "post_historical_pageviews",
        } satisfies Prisma.InputJsonObject,
      },
    });
  }
}
