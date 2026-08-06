type ApiError = {
  code: string;
  message: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: ApiError;
};

export type Editor = {
  id: string;
  username: string;
  isActive: boolean;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type OutreachArticleEditor = {
  id: string;
  isAuthor: boolean;
  createdAt: string;
  editor: Editor;
};

export const apiFetch = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    ...init,
  });

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    const message = payload.error?.message ?? "Request failed";
    throw new Error(message);
  }

  return payload.data;
};

export const createEditor = (data: { username: string }) =>
  apiFetch<Editor>("/editors", {
    method: "POST",
    body: JSON.stringify(data),
  });

export const bulkImportEditors = (usernames: string[]) =>
  apiFetch<{
    created: number;
    skipped: number;
    errors: number;
    details: Array<{ username: string; status: string; error?: string }>;
  }>("/editors/bulk", {
    method: "POST",
    body: JSON.stringify({ usernames }),
  });

export type SyncStatus = {
  local: {
    editorsCount: number;
    articlesCount: number;
    articlesCreated: number;
    characterSum: number;
    wordsAdded: number;
    referencesAdded: number;
    pageviews: number;
    commonsUploads: number;
  };
  external: {
    editorsCount: number;
    articlesCount: number;
    articlesCreated: number;
    totalEdits: number;
    wordsAdded: number;
    referencesAdded: number;
    pageviews: number;
    commonsUploads: number;
  } | null;
  lastSync: {
    jobType: string;
    completedAt: string;
    metadata: Record<string, unknown>;
  } | null;
  deltas: {
    editors: number;
    articles: number;
    articlesCreated: number;
    wordsAdded: number;
    referencesAdded: number;
    pageviews: number;
    commonsUploads: number;
  } | null;
  jobs: {
    active: Array<{
      id: string;
      jobType: string;
      status: string;
      createdAt: string;
      startedAt?: string | null;
      metadata?: Record<string, unknown> | null;
    }>;
    latestByType: Array<{
      id: string;
      jobType: string;
      status: string;
      createdAt: string;
      startedAt?: string | null;
      completedAt?: string | null;
      error?: string | null;
      metadata?: Record<string, unknown> | null;
    }>;
  };
  sources: {
    localSyncStatusApi: string;
    outreachCourseApi: string;
    outreachCoursePage: string;
  };
  raw: {
    local: {
      editorsCount: number;
      articlesCount: number;
      articlesCreated: number;
      wordsAdded: number;
      referencesAdded: number;
      pageviews: number;
      commonsUploads: number;
      commonsUploadsComparable?: number;
    };
    external: Record<string, unknown> | null;
  };
  syncHealth: {
    staleHours: number | null;
    hasActiveJobs: boolean;
    latestFailedJobs: string[];
  };
  syncRequired: boolean;
};

export const fetchSyncStatus = () => apiFetch<SyncStatus>("/stats/sync-status");

// Article source enum (unified across MediaWiki and Outreach articles)
export enum ArticleSource {
  MEDIAWIKI = "MEDIAWIKI",
  OUTREACH_DASHBOARD = "OUTREACH_DASHBOARD",
}

// Pageview type enum for daily vs cumulative data
export enum PageviewType {
  DAILY = "DAILY",
  CUMULATIVE = "CUMULATIVE",
}

// Unified Article type supporting both MediaWiki and Outreach Dashboard articles
export type Article = {
  id: string;
  title: string;
  wikiProject?: string;
  language?: string;
  project?: string;
  url?: string;
  pageId?: number; // MediaWiki page ID
  outreachId?: number; // Outreach Dashboard article ID
  characterSum: number;
  referencesCount: number;
  isNewArticle: boolean;
  rating?: string | null;
  source: ArticleSource | "MEDIAWIKI" | "OUTREACH_DASHBOARD";
  pageviews: Array<{
    cumulativeViews?: number | null;
    date: string;
    views?: number;
    type?: PageviewType | "DAILY" | "CUMULATIVE";
  }>;
  editors?: OutreachArticleEditor[];
};

// Backward compatibility alias
export type OutreachArticle = Article;

export type PaginationMetadata = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ArticlesResponse = {
  articles: Article[];
  pagination: PaginationMetadata;
};

export type ArticleStats = {
  totalArticles: number;
  totalPageviews: number;
  uniqueWikis: number;
  wikiStats: Array<{
    wiki: string;
    count: number;
    pageviews: number;
  }>;
};

export const fetchOutreachArticles = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  wiki?: string;
  source?: ArticleSource | "MEDIAWIKI" | "OUTREACH_DASHBOARD";
  wikiProject?: string;
}): Promise<ArticlesResponse> => {
  const queryString = new URLSearchParams();
  if (params?.page) queryString.set("page", String(params.page));
  if (params?.limit) queryString.set("limit", String(params.limit));
  if (params?.search) queryString.set("search", params.search);
  if (params?.wiki) queryString.set("wiki", params.wiki);
  if (params?.source) queryString.set("source", params.source);
  if (params?.wikiProject) queryString.set("wikiProject", params.wikiProject);

  const query = queryString.toString();
  const path = `/articles${query ? `?${query}` : ""}`;

  return apiFetch<ArticlesResponse>(path);
};

export const fetchArticleStats = async (): Promise<ArticleStats> => {
  return apiFetch<ArticleStats>("/articles/stats");
};

export type DailyHistoryPoint = {
  date: string;
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
  articlesEdited: number;
  editors: number;
  referencesAdded: number;
  commonsUploads: number;
  delta?: Record<string, number>;
};

export type EditorDailyHistoryPoint = {
  date: string;
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  referencesAdded: number;
  commonsUploads: number;
  delta?: Record<string, number>;
};

export type ArticleDailyHistoryPoint = {
  date: string;
  pageviews: number;
  characterSum: number;
  referencesCount: number;
  delta?: Record<string, number>;
};

const buildHistoryQuery = (params: Record<string, string | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  return query.toString();
};


export const fetchEditorHistory = async (params: {
  editorId: string;
  startDate?: string;
  endDate?: string;
  withDelta?: boolean;
}): Promise<{ editorId: string; series: EditorDailyHistoryPoint[] }> => {
  const query = buildHistoryQuery({
    editorId: params.editorId,
    startDate: params.startDate,
    endDate: params.endDate,
    withDelta: params.withDelta ? "true" : undefined,
  });
  return apiFetch<{ editorId: string; series: EditorDailyHistoryPoint[] }>(
    `/stats/editors/history${query ? `?${query}` : ""}`,
  );
};

export const fetchArticleHistory = async (params: {
  articleId: string;
  startDate?: string;
  endDate?: string;
  withDelta?: boolean;
}): Promise<{ articleId: string; series: ArticleDailyHistoryPoint[] }> => {
  const query = buildHistoryQuery({
    articleId: params.articleId,
    startDate: params.startDate,
    endDate: params.endDate,
    withDelta: params.withDelta ? "true" : undefined,
  });
  return apiFetch<{ articleId: string; series: ArticleDailyHistoryPoint[] }>(
    `/stats/articles/history${query ? `?${query}` : ""}`,
  );
};


export const downloadAnnualReport = async (params: {
  year: number;
  format: "pdf" | "csv" | "json";
  wikiProject?: string;
}): Promise<Blob> => {
  const query = new URLSearchParams();
  query.set("year", String(params.year));
  query.set("format", params.format);
  if (params.wikiProject) query.set("wikiProject", params.wikiProject);

  const response = await fetch(`/api/stats/annual/export?${query.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to download report");
  }
  return response.blob();
};

export const downloadMonthlyReport = async (params: {
  year: number;
  month: number;
  format: "pdf" | "csv" | "json";
  wikiProject?: string;
}): Promise<Blob> => {
  const query = new URLSearchParams();
  query.set("year", String(params.year));
  query.set("month", String(params.month));
  query.set("format", params.format);
  if (params.wikiProject) query.set("wikiProject", params.wikiProject);

  const response = await fetch(`/api/stats/monthly/export?${query.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to download report");
  }
  return response.blob();
};

export type SchedulerJob = {
  id: string;
  name: string;
  type: "cron" | "startup";
  schedule: string;
  enabled: boolean;
  disabledReason?: string | null;
  description: string;
  params?: Record<string, string>;
  triggers?: Array<{
    method: "POST" | "GET";
    path: string;
    payload?: Record<string, string | number | boolean | null>;
  }>;
};

export type SchedulerInfo = {
  timezone: string;
  jobs: SchedulerJob[];
};

export const fetchSchedulerInfo = async (): Promise<SchedulerInfo> => {
  return apiFetch<SchedulerInfo>("/scheduler");
};

export const updateSchedulerSetting = async (id: string, enabled: boolean) => {
  return apiFetch<{ id: string; enabled: boolean }>(`/scheduler/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ enabled }),
  });
};

export const updateSchedulerSettingWithReason = async (
  id: string,
  enabled: boolean,
  reason?: string,
) => {
  return apiFetch<{ id: string; enabled: boolean; disabledReason?: string | null }>(
    `/scheduler/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({ enabled, reason }),
    },
  );
};

export type SchedulerEvent = {
  id: string;
  schedulerId: string;
  enabled: boolean;
  reason?: string | null;
  source?: string | null;
  createdAt: string;
};

export const fetchSchedulerEvents = async (id: string, limit = 20) => {
  return apiFetch<{ events: SchedulerEvent[] }>(`/scheduler/${id}/events?limit=${limit}`);
};

export type SchedulerRunLog = {
  id: string;
  jobType: string;
  status: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
};

export const fetchSchedulerLogs = async (id: string, limit = 20) => {
  return apiFetch<{ logs: SchedulerRunLog[] }>(`/scheduler/${id}/logs?limit=${limit}`);
};

/** OKA program start (2022-05-06) — earliest possible snapshot period. */
export const PROGRAM_START_DATE = "2022-05-06";

// --- Snapshot-based report API (daily-first layered rollups) ---

export type SnapshotTotals = {
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  editors: number;
  refsAdded: number;
  viewsTotal: number;
  viewsActive: number;
  commonsUploads: number;
};

export type SnapshotPeriodPoint = SnapshotTotals & {
  periodStart: string;
  periodEnd: string;
};

export type SnapshotReport = {
  granularity: "DAY" | "MONTH" | "YEAR";
  periodStart: string;
  periodEnd: string;
  totals: SnapshotTotals;
  byPeriod: SnapshotPeriodPoint[];
  topArticles: Array<{
    articleId: string;
    title: string;
    wikiProject: string;
    edits: number;
    viewsTotal: number;
  }>;
};

export type ArticleActivityDetail = {
  articleId: string;
  title: string;
  wikiProject: string;
  edits: number;
  wordsAdded: number;
  isCreated: boolean;
  viewsTotal: number;
  viewsActive: number;
  refsAdded: number;
};

export type EditorActivityDetail = {
  editorId: string;
  username: string;
  edits: number;
  wordsAdded: number;
  articlesCreated: number;
  articlesEdited: number;
  commonsUploads: number;
  hasActivity: boolean;
};

export const fetchSnapshotReport = (
  granularity: "DAY" | "MONTH" | "YEAR",
  start: string,
  end: string,
  wikiProject?: string,
) => {
  const params = new URLSearchParams({ granularity, start, end });
  if (wikiProject) params.set("wikiProject", wikiProject);
  return apiFetch<SnapshotReport>(`/stats/snapshot/report?${params.toString()}`);
};


export const fetchSnapshotEditors = (
  granularity: "DAY" | "MONTH" | "YEAR",
  start: string,
  end: string,
) => {
  const params = new URLSearchParams({ granularity, start, end });
  return apiFetch<EditorActivityDetail[]>(`/stats/snapshot/editors?${params.toString()}`);
};

export const fetchSnapshotDaily = (start: string, end: string) => {
  const params = new URLSearchParams({ start, end });
  return apiFetch<SnapshotPeriodPoint[]>(`/stats/snapshot/daily?${params.toString()}`);
};