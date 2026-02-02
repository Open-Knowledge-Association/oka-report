type Task = () => Promise<unknown>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RateLimiterOptions {
  delayMs?: number;
}

export class RateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private running = false;
  private readonly delayMs: number;

  constructor(options: RateLimiterOptions = {}) {
    this.delayMs = options.delayMs ?? 100;
  }

  schedule(task: Task): Promise<unknown> {
    return new Promise<unknown>((resolve, reject) => {
      const taskWrapper: () => Promise<void> = async () => {
        try {
          resolve(await task());
        } catch (error) {
          reject(error);
        }
      };
      this.queue.push(taskWrapper);
      void this.run();
    });
  }

  private async run() {
    if (this.running) {
      return;
    }

    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (!task) {
        continue;
      }

      await task();

      if (this.delayMs > 0) {
        await sleep(this.delayMs);
      }
    }

    this.running = false;
  }
}

export const calculateRetryDelayMs = (
  attempt: number,
  retryAfterHeader?: string | null,
) => {
  if (retryAfterHeader) {
    const retryAfterSeconds = Number(retryAfterHeader);
    if (!Number.isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
      return retryAfterSeconds * 1000;
    }
  }

  const baseDelayMs = 500;
  return baseDelayMs * Math.pow(2, attempt);
};
