import { getArticleInfo } from "./articles";
import { getCommonsUploads } from "./commons";
import { getUserContributions } from "./contributions";
import { getPageviews } from "./pageviews";
import { calculateRetryDelayMs, RateLimiter, type RateLimiterOptions } from "./rate-limiter";
import type {
  ArticleInfo,
  CommonsUpload,
  GetUserContributionsOptions,
  PageviewData,
  UserContribution,
} from "./types";

const DEFAULT_USER_AGENT = "OKA-Stats/1.0 (https://oka.wiki; contact@oka.wiki)";
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface WikimediaClientConfig {
  baseUrl: string;
  userAgent?: string;
  maxRetries?: number;
  requestTimeoutMs?: number;
  rateLimiter?: RateLimiter;
  rateLimiterOptions?: RateLimiterOptions;
}

export interface WikimediaApiError {
  code: string;
  info: string;
}

export class WikimediaClientError extends Error {
  status: number;
  url: string;
  apiError?: WikimediaApiError;

  constructor(
    message: string,
    options: { status: number; url: string; apiError?: WikimediaApiError },
  ) {
    super(message);
    this.name = "WikimediaClientError";
    this.status = options.status;
    this.url = options.url;
    this.apiError = options.apiError;
  }
}

type WikimediaErrorResponse = {
  error?: WikimediaApiError;
};

export class WikimediaClient {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly rateLimiter: RateLimiter;
  private readonly maxRetries: number;
  private readonly requestTimeoutMs: number;

  constructor(config: WikimediaClientConfig) {
    this.baseUrl = config.baseUrl;
    this.userAgent = config.userAgent ?? DEFAULT_USER_AGENT;
    this.rateLimiter = config.rateLimiter ?? new RateLimiter(config.rateLimiterOptions);
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.requestTimeoutMs = config.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  }

  async request<T>(
    endpoint: string,
    params: Record<string, string | number | boolean | undefined> = {},
  ): Promise<T> {
    const url = new URL(endpoint, this.baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) {
        continue;
      }

      url.searchParams.set(key, String(value));
    }

    return this.rateLimiter.schedule(async () => {
      const response = await this.fetchWithRetry(url.toString(), {
        headers: {
          "User-Agent": this.userAgent,
          "Api-User-Agent": this.userAgent,
        },
      });

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = undefined;
      }

      if (!response.ok) {
        throw new WikimediaClientError("Wikimedia API request failed", {
          status: response.status,
          url: url.toString(),
        });
      }

      const errorResponse = payload as WikimediaErrorResponse;
      if (errorResponse?.error) {
        throw new WikimediaClientError("Wikimedia API error", {
          status: response.status,
          url: url.toString(),
          apiError: errorResponse.error,
        });
      }

      return payload as T;
    }) as Promise<T>;
  }

  async getUserContributions(
    username: string,
    options?: GetUserContributionsOptions,
  ): Promise<UserContribution[]> {
    return getUserContributions(this, username, options);
  }

  async getArticleInfo(title: string): Promise<ArticleInfo | null> {
    return getArticleInfo(this, title);
  }

  async getPageviews(
    article: string,
    project: string,
    startDate: string,
    endDate: string,
    agentType?: import("./pageviews").PageviewAgentType,
  ): Promise<PageviewData[]> {
    return getPageviews(this, article, project, startDate, endDate, agentType);
  }

  async getCommonsUploads(username: string): Promise<CommonsUpload[]> {
    return getCommonsUploads(this, username);
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  private async fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    let attempt = 0;

    while (true) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.requestTimeoutMs);

      let response: Response;
      try {
        response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
      } catch (error) {
        clearTimeout(timeoutHandle);
        if (attempt >= this.maxRetries) {
          throw error;
        }
        const delayMs = calculateRetryDelayMs(attempt, null);
        await sleep(delayMs);
        attempt += 1;
        continue;
      }

      clearTimeout(timeoutHandle);

      if (response.status !== 429) {
        return response;
      }

      if (attempt >= this.maxRetries) {
        return response;
      }

      const delayMs = calculateRetryDelayMs(attempt, response.headers.get("retry-after"));
      await sleep(delayMs);
      attempt += 1;
    }
  }
}
