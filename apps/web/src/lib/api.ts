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

export const fetchEditors = () => apiFetch<Editor[]>("/editors");

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

export const fetchOverallStats = () =>
  apiFetch<{
    totals: { editorsCount: number; articlesCreated: number; edits: number; pageviews: number };
    byWikiProject: Array<{
      wikiProject: string;
      edits: number;
      articlesCreated: number;
      pageviews: number;
    }>;
  }>("/stats/overall");

export const fetchEditorStats = () =>
  apiFetch<
    Array<{
      editorId: string;
      username: string;
      edits: number;
      articlesCreated: number;
      articlesModified: number;
      pageviews: number;
    }>
  >("/stats/editors");

export type DashboardStats = {
  editorsCount: number;
  articlesCreated: number;
  articlesEdited: number;
  totalEdits: number;
  wordsAdded: number;
  referencesAdded: number;
  pageviews: number;
  commonsUploads: number;
};

export const fetchDashboardStats = () => apiFetch<DashboardStats>("/stats/dashboard");

export type EditorsListStats = {
  id: string;
  username: string;
  characterSum: number;
  referencesCount: number;
  uploadsCount: number;
};

export const fetchEditorsListStats = () => apiFetch<EditorsListStats[]>("/stats/editors-list");

export type SyncStatus = {
  local: {
    editorsCount: number;
    articlesCount: number;
    articlesCreated: number;
    characterSum: number;
    wordsAdded: number;
    referencesAdded: number;
    pageviews: number;
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
  syncRequired: boolean;
};

export const fetchSyncStatus = () => apiFetch<SyncStatus>("/stats/sync-status");

export const fetchOutreachCourse = () =>
  apiFetch<{ course: any }>("/outreach/course?school=OKA&slug=OKA");

export type OutreachUser = {
  id: number;
  username: string;
  character_sum_ms: number;
  character_sum_us: number;
  character_sum_draft: number;
  references_count: number;
  total_uploads: number;
  contribution_url: string;
  role: number;
  enrolled_at: string;
};

export const fetchOutreachUsers = async () => {
  const data = await apiFetch<{ course: { users: OutreachUser[] } }>(
    "/outreach/users?school=OKA&slug=OKA",
  );
  return data.course.users;
};

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

export const fetchStatsHistory = async (params: {
  startDate?: string;
  endDate?: string;
  wikiProject?: string;
  source?: ArticleSource | "MEDIAWIKI" | "OUTREACH_DASHBOARD";
  withDelta?: boolean;
}): Promise<{ series: DailyHistoryPoint[] }> => {
  const query = buildHistoryQuery({
    startDate: params.startDate,
    endDate: params.endDate,
    wikiProject: params.wikiProject,
    source: params.source,
    withDelta: params.withDelta ? "true" : undefined,
  });
  return apiFetch<{ series: DailyHistoryPoint[] }>(`/stats/history${query ? `?${query}` : ""}`);
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

export type AnnualStats = {
  year: number;
  byWikiProject: Array<{
    wikiProject: string;
    edits: number;
    wordsAdded: number;
    pageviews: number;
    articlesCreated: number;
    articlesEdited: number;
    editors: number;
    referencesAdded: number;
    commonsUploads: number;
  }>;
  totals: {
    edits: number;
    wordsAdded: number;
    pageviews: number;
    articlesCreated: number;
    articlesEdited: number;
    editors: number;
    referencesAdded: number;
    commonsUploads: number;
  };
  yoy?: {
    articlesCreated: { current: number; previous: number; changePercent: number };
    pageviews: { current: number; previous: number; changePercent: number };
    wordsAdded: { current: number; previous: number; changePercent: number };
  };
};

export type TopArticle = {
  rank: number;
  title: string;
  wikiProject: string;
  totalPageviews: number;
  articleId: string;
};

export type TopArticlesResponse = {
  year: number;
  wikiProject: string | null;
  articles: TopArticle[];
  totalCount: number;
};

export const fetchAnnualStats = async (params: {
  year: number;
  wikiProject?: string;
  includeYoY?: boolean;
}): Promise<AnnualStats> => {
  const query = new URLSearchParams();
  query.set("year", String(params.year));
  if (params.wikiProject) query.set("wikiProject", params.wikiProject);
  if (params.includeYoY) query.set("includeYoY", "true");

  return apiFetch<AnnualStats>(`/stats/annual?${query.toString()}`);
};

export const fetchTopArticles = async (params: {
  year: number;
  wikiProject?: string;
  limit?: number;
}): Promise<TopArticlesResponse> => {
  const query = new URLSearchParams();
  query.set("year", String(params.year));
  if (params.wikiProject) query.set("wikiProject", params.wikiProject);
  if (params.limit) query.set("limit", String(params.limit));

  return apiFetch<TopArticlesResponse>(`/stats/top-articles?${query.toString()}`);
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

export type MonthlyStats = {
  year: number;
  month: number;
  byWikiProject: Array<{
    wikiProject: string;
    edits: number;
    wordsAdded: number;
    pageviews: number;
    articlesCreated: number;
    articlesEdited: number;
    editors: number;
    referencesAdded: number;
    commonsUploads: number;
  }>;
  totals: {
    edits: number;
    wordsAdded: number;
    pageviews: number;
    articlesCreated: number;
    articlesEdited: number;
    editors: number;
    referencesAdded: number;
    commonsUploads: number;
  };
  mom?: {
    articlesCreated: { current: number; previous: number; changePercent: number };
    pageviews: { current: number; previous: number; changePercent: number };
    wordsAdded: { current: number; previous: number; changePercent: number };
  };
};

export const fetchMonthlyStats = async (params: {
  year: number;
  month: number;
  wikiProject?: string;
  includeMoM?: boolean;
}): Promise<MonthlyStats> => {
  const query = new URLSearchParams();
  query.set("year", String(params.year));
  query.set("month", String(params.month));
  if (params.wikiProject) query.set("wikiProject", params.wikiProject);
  if (params.includeMoM) query.set("includeMoM", "true");

  return apiFetch<MonthlyStats>(`/stats/monthly?${query.toString()}`);
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
