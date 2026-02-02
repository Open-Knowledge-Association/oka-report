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
  apiFetch<{ created: number; skipped: number; errors: number; details: Array<{ username: string; status: string; error?: string }> }>("/editors/bulk", {
    method: "POST",
    body: JSON.stringify({ usernames }),
  });

export const fetchOverallStats = () =>
  apiFetch<{ totals: { editorsCount: number; articlesCreated: number; edits: number; pageviews: number }; byWikiProject: Array<{ wikiProject: string; edits: number; articlesCreated: number; pageviews: number }> }>("/stats/overall");

export const fetchEditorStats = () =>
  apiFetch<Array<{ editorId: string; username: string; edits: number; articlesCreated: number; articlesModified: number; pageviews: number }>>("/stats/editors");
