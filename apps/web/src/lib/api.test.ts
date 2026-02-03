import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";

const createJsonResponse = (payload: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("apiFetch", () => {
  it("returns data when response is ok and success true", async () => {
    const payload = { success: true, data: { message: "ok" } };
    const mockFetch = vi.fn(async () => createJsonResponse(payload));
    vi.stubGlobal("fetch", mockFetch);

    const data = await apiFetch<{ message: string }>("/ping");

    expect(data).toEqual({ message: "ok" });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/ping",
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
  });

  it("throws when success is false", async () => {
    const payload = {
      success: false,
      data: null,
      error: { code: "DENIED", message: "Access denied" },
    };
    const mockFetch = vi.fn(async () => createJsonResponse(payload));
    vi.stubGlobal("fetch", mockFetch);

    await expect(apiFetch("/secure")).rejects.toThrow("Access denied");
  });

  it("throws a default error when response is not ok", async () => {
    const payload = { success: true, data: null };
    const mockFetch = vi.fn(async () => createJsonResponse(payload, { status: 500 }));
    vi.stubGlobal("fetch", mockFetch);

    await expect(apiFetch("/fail")).rejects.toThrow("Request failed");
  });
});
