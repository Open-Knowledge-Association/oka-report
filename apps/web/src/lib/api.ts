type ApiError = {
  code: string;
  message: string;
};

type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: ApiError;
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
