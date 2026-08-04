import { describe, expect, it, mock } from "bun:test";
import type { PrismaClient } from "@repo/db/generated/prisma/client";
import { HistoricalBackfillPlanner } from "../historical-backfill-planner.service";

describe("HistoricalBackfillPlanner", () => {
  it("does not queue while a historical job is active", async () => {
    const create = mock(() => Promise.resolve({ id: "unexpected" }));
    const prisma = {
      syncJob: {
        findFirst: async () => ({ id: "active", jobType: "historical_pageviews" }),
        create,
      },
    } as unknown as PrismaClient;

    const result = await new HistoricalBackfillPlanner(prisma).queueNextYear();

    expect(result.queued).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });

  it("queues the oldest incomplete year", async () => {
    const create = mock((args: unknown) => Promise.resolve({ id: "historical-1", args }));
    const prisma = {
      syncJob: {
        findFirst: async () => null,
        findMany: async () => [],
        create,
      },
      contribution: {
        findFirst: async () => ({ editTimestamp: new Date("2023-02-01T00:00:00Z") }),
      },
      article: {
        findFirst: async () => ({ articleCreatedAt: new Date("2022-05-01T00:00:00Z") }),
        count: async () => 12,
      },
    } as unknown as PrismaClient;

    const result = await new HistoricalBackfillPlanner(prisma).queueNextYear();

    expect(result.queued).toBe(true);
    if (result.queued) expect(result.year).toBe(2022);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("deduplicates snapshot rebuilds by historical source job", async () => {
    const create = mock(() => Promise.resolve({ id: "unexpected" }));
    const prisma = {
      syncJob: {
        findMany: async () => [
          { id: "existing", metadata: { historicalSourceJobId: "historical-1" } },
        ],
        create,
      },
    } as unknown as PrismaClient;

    const result = await new HistoricalBackfillPlanner(prisma).queueSnapshotRebuild(
      2024,
      "historical-1",
    );

    expect(result.id).toBe("existing");
    expect(create).not.toHaveBeenCalled();
  });
});
