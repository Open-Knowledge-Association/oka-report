import { describe, expect, it, mock } from "bun:test";
import { WikimediaClient, WikimediaClientError } from "../../..";

const createClient = () =>
  new WikimediaClient({
    baseUrl: "https://en.wikipedia.org",
    rateLimiterOptions: { delayMs: 0 },
    maxRetries: 2,
  });

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

const setupFetch = () => {
  const fetchMock = mock();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

describe("WikimediaClient", () => {

  it("fetches user contributions with pagination", async () => {
    const fetchMock = setupFetch();
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            usercontribs: [
              {
                userid: 1,
                user: "Example",
                pageid: 10,
                revid: 100,
                parentid: 99,
                ns: 0,
                title: "Example",
                timestamp: "2024-01-01T00:00:00Z",
                sizediff: 120,
              },
            ],
          },
          continue: {
            uccontinue: "20240101000000",
            continue: "-||",
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          query: {
            usercontribs: [
              {
                userid: 1,
                user: "Example",
                pageid: 11,
                revid: 101,
                parentid: 100,
                ns: 0,
                title: "Example 2",
                timestamp: "2024-01-02T00:00:00Z",
                sizediff: 50,
              },
            ],
          },
        }),
      );

    const client = createClient();
    const results = await client.getUserContributions("Example");

    expect(results).toHaveLength(2);
    expect(results[0].pageId).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns article info when found", async () => {
    const fetchMock = setupFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        query: {
          pages: {
            "123": {
              pageid: 123,
              title: "Sample",
              revisions: [
                { user: "Creator", timestamp: "2024-01-01T00:00:00Z" },
              ],
            },
          },
        },
      }),
    );

    const client = createClient();
    const result = await client.getArticleInfo("Sample");

    expect(result).not.toBeNull();
    expect(result?.creator).toBe("Creator");
  });

  it("returns null when article missing", async () => {
    const fetchMock = setupFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        query: {
          pages: {
            "-1": { missing: true },
          },
        },
      }),
    );

    const client = createClient();
    const result = await client.getArticleInfo("Missing");

    expect(result).toBeNull();
  });

  it("formats pageview dates", async () => {
    const fetchMock = setupFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        items: [{ timestamp: "2024010100", views: 42 }],
      }),
    );

    const client = createClient();
    const result = await client.getPageviews(
      "Example",
      "en.wikipedia",
      "20240101",
      "20240102",
    );

    expect(result[0].date).toBe("2024-01-01");
  });

  it("throws on API error", async () => {
    const fetchMock = setupFetch();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        error: { code: "badrequest", info: "Bad" },
      }),
    );

    const client = createClient();

    await expect(client.getUserContributions("Example")).rejects.toBeInstanceOf(
      WikimediaClientError,
    );
  });

  it("retries on 429", async () => {
    const fetchMock = setupFetch();
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ query: { usercontribs: [] } }));

    const client = createClient();
    await client.getUserContributions("Example");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
