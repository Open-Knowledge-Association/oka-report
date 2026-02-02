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

export const bulkImportEditors = async (usernames: string[]) => {
  const results = await Promise.allSettled(
    usernames.map((username) => createEditor({ username }))
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) {
    console.warn(`${failed.length} editors failed to import`);
  }
  return results;
};
