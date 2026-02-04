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

export type OutreachArticle = {
  id: string;
  title: string;
  language: string;
  project: string;
  url: string;
  characterSum: number;
  referencesCount: number;
  isNewArticle: boolean;
  rating: string | null;
  pageviews: Array<{
    cumulativeViews: number;
    snapshotDate: string;
  }>;
  editors?: OutreachArticleEditor[];
};

export type PaginationMetadata = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type ArticlesResponse = {
  articles: OutreachArticle[];
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
}): Promise<ArticlesResponse> => {
  const queryString = new URLSearchParams();
  if (params?.page) queryString.set("page", String(params.page));
  if (params?.limit) queryString.set("limit", String(params.limit));
  if (params?.search) queryString.set("search", params.search);
  if (params?.wiki) queryString.set("wiki", params.wiki);

  const query = queryString.toString();
  const path = `/outreach/articles/db${query ? `?${query}` : ""}`;

  return apiFetch<ArticlesResponse>(path);
};

export const fetchArticleStats = async (): Promise<ArticleStats> => {
  return apiFetch<ArticleStats>("/outreach/articles/stats");
};
