import type { PrismaClient } from "@repo/db/generated/prisma/client";

type BootstrapState = {
  id: string;
  state: string;
  startedAt: Date | null;
  completedAt: Date | null;
  leaseExpiresAt: Date | null;
  rootJobId: string | null;
  failedAt: Date | null;
  failureReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type StartBootstrapResult = {
  success: boolean;
  state: BootstrapState;
};

const BOOTSTRAP_SINGLETON_ID = "singleton";
const BOOTSTRAP_ADVISORY_LOCK_KEY = 328573382;
const DEFAULT_LEASE_DURATION_MS = 48 * 60 * 60 * 1000;

export class BootstrapService {
  constructor(private readonly prisma: PrismaClient) {}

  async getState(): Promise<BootstrapState | null> {
    return this.prisma.bootstrapState.findUnique({
      where: { id: BOOTSTRAP_SINGLETON_ID },
    });
  }

  async startBootstrap(): Promise<StartBootstrapResult> {
    return this.prisma.$transaction(async (tx) => {
      const [lockResult] = await tx.$queryRaw<Array<{ acquired: boolean }>>`
        SELECT pg_try_advisory_xact_lock(${BOOTSTRAP_ADVISORY_LOCK_KEY}) AS acquired
      `;

      if (!lockResult?.acquired) {
        const state = await tx.bootstrapState.findUnique({
          where: { id: BOOTSTRAP_SINGLETON_ID },
        });
        return {
          success: false,
          state: state!,
        };
      }

      await tx.bootstrapState.upsert({
        where: { id: BOOTSTRAP_SINGLETON_ID },
        create: {
          id: BOOTSTRAP_SINGLETON_ID,
          state: "pending",
        },
        update: {},
      });

      const leaseExpiresAt = new Date(Date.now() + DEFAULT_LEASE_DURATION_MS);

      const updateResult = await tx.$executeRaw`
        UPDATE bootstrap_state
        SET state = 'running',
            "startedAt" = NOW(),
            "leaseExpiresAt" = ${leaseExpiresAt}::timestamp,
            "updatedAt" = NOW()
        WHERE id = ${BOOTSTRAP_SINGLETON_ID}
          AND state IN ('pending', 'failed')
        RETURNING *
      `;

      if (updateResult === 0) {
        const state = await tx.bootstrapState.findUnique({
          where: { id: BOOTSTRAP_SINGLETON_ID },
        });
        return {
          success: false,
          state: state!,
        };
      }

      const state = await tx.bootstrapState.findUnique({
        where: { id: BOOTSTRAP_SINGLETON_ID },
      });

      return {
        success: true,
        state: state!,
      };
    });
  }

  async failBootstrap(reason: string): Promise<void> {
    await this.prisma.bootstrapState.update({
      where: { id: BOOTSTRAP_SINGLETON_ID },
      data: {
        state: "failed",
        failedAt: new Date(),
        failureReason: reason,
        leaseExpiresAt: null,
      },
    });
  }

  async completeBootstrap(): Promise<void> {
    await this.prisma.bootstrapState.update({
      where: { id: BOOTSTRAP_SINGLETON_ID },
      data: {
        state: "completed",
        completedAt: new Date(),
        leaseExpiresAt: null,
      },
    });
  }

  async retryFailedBootstrap(): Promise<StartBootstrapResult> {
    const state = await this.getState();

    if (!state || state.state !== "failed") {
      return {
        success: false,
        state: state!,
      };
    }

    return this.startBootstrap();
  }

  async isLeaseExpired(): Promise<boolean> {
    const state = await this.getState();

    if (!state || !state.leaseExpiresAt || state.state !== "running") {
      return false;
    }

    return new Date() > state.leaseExpiresAt;
  }

  async setRootJobId(rootJobId: string): Promise<void> {
    await this.prisma.bootstrapState.update({
      where: { id: BOOTSTRAP_SINGLETON_ID },
      data: { rootJobId },
    });
  }

  async reconcileStaleRunningState(): Promise<void> {
    const state = await this.getState();

    if (!state || state.state !== "running") {
      return;
    }

    if (await this.isLeaseExpired()) {
      await this.failBootstrap("Lease expired during reconciliation");
      return;
    }

    if (!state.rootJobId) {
      return;
    }

    const rootJob = await this.prisma.syncJob.findUnique({
      where: { id: state.rootJobId },
    });

    if (!rootJob) {
      await this.failBootstrap("Root job not found during reconciliation");
      return;
    }

    if (rootJob.status === "completed") {
      await this.completeBootstrap();
    } else if (rootJob.status === "failed" || rootJob.status === "cancelled") {
      const reason = rootJob.error ?? `Root job ${rootJob.status}`;
      await this.failBootstrap(reason);
    }
  }
}
