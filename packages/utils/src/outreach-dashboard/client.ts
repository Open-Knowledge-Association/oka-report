import type { CourseData, UserData, UploadData, ArticleData } from "./types";

const DEFAULT_USER_AGENT = "OKAStatsBot/1.0 (https://oka.wiki/stats; tech@oka.wiki)";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 180_000; // articles.json can be a large (~20 MB) upstream response
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface OutreachDashboardClientConfig {
  baseUrl: string;
  userAgent?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface OutreachDashboardApiError {
  error?: string;
  message?: string;
}

export class OutreachDashboardClientError extends Error {
  status: number;
  url: string;
  apiError?: OutreachDashboardApiError;

  constructor(
    message: string,
    options: {
      status: number;
      url: string;
      apiError?: OutreachDashboardApiError;
    },
  ) {
    super(message);
    this.name = "OutreachDashboardClientError";
    this.status = options.status;
    this.url = options.url;
    this.apiError = options.apiError;
  }
}

export class OutreachDashboardClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;

  constructor(config: OutreachDashboardClientConfig) {
    this.baseUrl = config.baseUrl;
    this.userAgent = config.userAgent ?? DEFAULT_USER_AGENT;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async request<T>(endpoint: string): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);

    const response = await this.fetchWithRetry(url.toString(), {
      headers: {
        "User-Agent": this.userAgent,
      },
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }

    if (!response.ok) {
      throw new OutreachDashboardClientError(
        `Outreach Dashboard API request failed (HTTP ${response.status})`,
        {
          status: response.status,
          url: url.toString(),
        },
      );
    }

    const errorResponse = payload as OutreachDashboardApiError;
    if (errorResponse?.error || errorResponse?.message) {
      throw new OutreachDashboardClientError("Outreach Dashboard API error", {
        status: response.status,
        url: url.toString(),
        apiError: errorResponse,
      });
    }

    return payload as T;
  }

  async getCourse(school: string, slug: string): Promise<CourseData> {
    return this.request<CourseData>(`/courses/${school}/${slug}/course.json`);
  }

  async getUsers(school: string, slug: string): Promise<UserData> {
    return this.request<UserData>(`/courses/${school}/${slug}/users.json`);
  }

  async getUploads(school: string, slug: string): Promise<UploadData> {
    return this.request<UploadData>(`/courses/${school}/${slug}/uploads.json`);
  }

  async getArticles(school: string, slug: string): Promise<ArticleData> {
    return this.request<ArticleData>(`/courses/${school}/${slug}/articles.json`);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let attempt = 0;

    while (true) {
      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        if (attempt >= this.maxRetries) {
          throw error;
        }
        await sleep(this.calculateRetryDelayMs(attempt, null));
        attempt += 1;
        continue;
      }

      const retryableStatus = response.status === 429 || response.status >= 500;
      if (!retryableStatus) {
        return response;
      }

      if (attempt >= this.maxRetries) {
        return response;
      }

      const retryAfter = response.headers.get("retry-after");
      const delayMs = this.calculateRetryDelayMs(attempt, retryAfter);
      await sleep(delayMs);
      attempt += 1;
    }
  }

  private calculateRetryDelayMs(attempt: number, retryAfterHeader: string | null): number {
    if (retryAfterHeader) {
      const retryAfter = parseInt(retryAfterHeader, 10);
      if (!Number.isNaN(retryAfter)) {
        return retryAfter * 1000;
      }
    }

    const baseDelay = 1000;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * exponentialDelay * 0.1;
    return exponentialDelay + jitter;
  }
}
