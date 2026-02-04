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
  id: number;
  title: string;
  language: string;
  project: string;
  view_count: number;
  average_views: number;
  character_sum: number;
  references_count: number;
  new_article: boolean;
  rating: string;
  url: string;
};

export const fetchOutreachArticles = async () => {
  const data = await apiFetch<{ course: { articles: OutreachArticle[] } }>(
    "/outreach/articles?school=OKA&slug=OKA",
  );
  return data.course.articles;
};
