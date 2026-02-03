import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { OutreachDashboardClient, OutreachDashboardClientError } from "./client";

const createClient = () =>
  new OutreachDashboardClient({
    baseUrl: "https://outreach.example.com",
    maxRetries: 2,
  });

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), { status, headers });

describe("OutreachDashboardClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  describe("getCourse", () => {
    it("fetches course data successfully", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          course: {
            id: 1,
            title: "Introduction to Wikipedia Editing",
            description: "Learn how to edit Wikipedia",
            start: "2024-01-15",
            end: "2024-03-15",
          },
        }),
      );

      const client = createClient();
      const result = await client.getCourse("university-name", "wiki-course-slug");

      expect(result.course.id).toBe(1);
      expect(result.course.title).toBe("Introduction to Wikipedia Editing");
      expect(result.course.description).toBe("Learn how to edit Wikipedia");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/courses/university-name/wiki-course-slug/course.json"),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("OKAStatsBot"),
          }),
        }),
      );
    });

    it("returns course with minimal data", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          course: {
            id: 2,
            title: "Basic Course",
          },
        }),
      );

      const client = createClient();
      const result = await client.getCourse("uni", "slug");

      expect(result.course.id).toBe(2);
      expect(result.course.title).toBe("Basic Course");
      expect(result.course.description).toBeUndefined();
    });
  });

  describe("getUsers", () => {
    it("fetches users successfully", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          users: [
            {
              id: 1,
              name: "Alice Editor",
              username: "alice_edit",
              real_name: "Alice Smith",
              email: "alice@example.com",
            },
            {
              id: 2,
              name: "Bob Contributor",
              username: "bob_contrib",
              real_name: "Bob Jones",
              email: "bob@example.com",
            },
          ],
        }),
      );

      const client = createClient();
      const result = await client.getUsers("university", "course-1");

      expect(result.users).toHaveLength(2);
      expect(result.users[0].username).toBe("alice_edit");
      expect(result.users[1].real_name).toBe("Bob Jones");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/courses/university/course-1/users.json"),
        expect.any(Object),
      );
    });

    it("returns empty users array", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse({ users: [] }));

      const client = createClient();
      const result = await client.getUsers("uni", "slug");

      expect(result.users).toHaveLength(0);
      expect(Array.isArray(result.users)).toBe(true);
    });

    it("handles users with partial data", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          users: [
            {
              id: 1,
              name: "Minimal User",
              username: "minimal",
            },
          ],
        }),
      );

      const client = createClient();
      const result = await client.getUsers("uni", "slug");

      expect(result.users[0].id).toBe(1);
      expect(result.users[0].real_name).toBeUndefined();
      expect(result.users[0].email).toBeUndefined();
    });
  });

  describe("getUploads", () => {
    it("fetches uploads successfully", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          uploads: [
            {
              title: "File:Example_image.jpg",
              uploader: "alice_edit",
              date: "2024-01-20",
              url: "https://commons.wikimedia.org/wiki/File:Example_image.jpg",
            },
            {
              title: "File:Another_file.pdf",
              uploader: "bob_contrib",
              date: "2024-01-25",
              url: "https://commons.wikimedia.org/wiki/File:Another_file.pdf",
            },
          ],
        }),
      );

      const client = createClient();
      const result = await client.getUploads("university", "course-1");

      expect(result.uploads).toHaveLength(2);
      expect(result.uploads[0].title).toBe("File:Example_image.jpg");
      expect(result.uploads[1].uploader).toBe("bob_contrib");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/courses/university/course-1/uploads.json"),
        expect.any(Object),
      );
    });

    it("returns empty uploads array", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse({ uploads: [] }));

      const client = createClient();
      const result = await client.getUploads("uni", "slug");

      expect(result.uploads).toHaveLength(0);
    });

    it("handles uploads with minimal data", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          uploads: [
            {
              title: "File:Minimal.jpg",
              uploader: "editor",
            },
          ],
        }),
      );

      const client = createClient();
      const result = await client.getUploads("uni", "slug");

      expect(result.uploads[0].title).toBe("File:Minimal.jpg");
      expect(result.uploads[0].date).toBeUndefined();
      expect(result.uploads[0].url).toBeUndefined();
    });
  });

  describe("error handling", () => {
    it("throws on 404 Not Found", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

      const client = createClient();

      await expect(client.getCourse("invalid", "notfound")).rejects.toThrow(
        OutreachDashboardClientError,
      );
    });

    it("throws on 500 Server Error", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));

      const client = createClient();

      await expect(client.getUsers("uni", "course")).rejects.toThrow(OutreachDashboardClientError);
    });

    it("includes error status in exception", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response("", { status: 403 }));

      const client = createClient();

      try {
        await client.getUploads("uni", "course");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OutreachDashboardClientError);
        expect((err as OutreachDashboardClientError).status).toBe(403);
      }
    });

    it("includes URL in error", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response("", { status: 404 }));

      const client = createClient();

      try {
        await client.getCourse("uni", "course");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OutreachDashboardClientError);
        expect((err as OutreachDashboardClientError).url).toContain(
          "/courses/uni/course/course.json",
        );
      }
    });

    it("throws when API returns error field", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            error: "invalid_course",
          },
          200,
        ),
      );

      const client = createClient();

      await expect(client.getCourse("uni", "course")).rejects.toThrow(OutreachDashboardClientError);
    });

    it("throws when API returns message field", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          {
            message: "Course not found",
          },
          200,
        ),
      );

      const client = createClient();

      await expect(client.getUsers("uni", "course")).rejects.toThrow(OutreachDashboardClientError);
    });

    it("captures API error details in exception", async () => {
      const fetchMock = vi.mocked(fetch);
      const errorPayload = {
        error: "unauthorized",
      };
      fetchMock.mockResolvedValueOnce(jsonResponse(errorPayload, 200));

      const client = createClient();

      try {
        await client.getCourse("uni", "course");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OutreachDashboardClientError);
        expect((err as OutreachDashboardClientError).apiError).toEqual(errorPayload);
      }
    });
  });

  describe("retry logic", () => {
    it("retries on 429 Too Many Requests", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response("", { status: 429 })).mockResolvedValueOnce(
        jsonResponse({
          course: { id: 1, title: "Course" },
        }),
      );

      const client = createClient();
      const result = await client.getCourse("uni", "course");

      expect(result.course.id).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("retries with exponential backoff", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock
        .mockResolvedValueOnce(new Response("", { status: 429 }))
        .mockResolvedValueOnce(new Response("", { status: 429 }))
        .mockResolvedValueOnce(
          jsonResponse({
            course: { id: 1, title: "Course" },
          }),
        );

      const client = createClient();
      const result = await client.getCourse("uni", "course");

      expect(result.course.id).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("respects retry-after header", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock
        .mockResolvedValueOnce(
          new Response("", {
            status: 429,
            headers: { "retry-after": "2" },
          }),
        )
        .mockResolvedValueOnce(
          jsonResponse({
            course: { id: 1, title: "Course" },
          }),
        );

      const client = createClient();
      const result = await client.getCourse("uni", "course");

      expect(result.course.id).toBe(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("stops retrying after max attempts", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValue(new Response("", { status: 429 }));

      const client = createClient();
      await expect(client.getCourse("uni", "course")).rejects.toThrow();

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe("User-Agent header", () => {
    it("sends default User-Agent header", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          course: { id: 1, title: "Course" },
        }),
      );

      const client = createClient();
      await client.getCourse("uni", "course");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("OKAStatsBot/1.0"),
          }),
        }),
      );
    });

    it("allows custom User-Agent header", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          users: [],
        }),
      );

      const client = new OutreachDashboardClient({
        baseUrl: "https://outreach.example.com",
        userAgent: "CustomBot/2.0",
      });
      await client.getUsers("uni", "course");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "User-Agent": "CustomBot/2.0",
          }),
        }),
      );
    });
  });

  describe("baseUrl handling", () => {
    it("constructs correct URLs", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(
        jsonResponse({
          uploads: [],
        }),
      );

      const client = new OutreachDashboardClient({
        baseUrl: "https://dashboard.example.org",
      });
      await client.getUploads("oxford", "python-101");

      const callUrl = fetchMock.mock.calls[0][0] as string;
      expect(callUrl).toBe("https://dashboard.example.org/courses/oxford/python-101/uploads.json");
    });

    it("exposes baseUrl via getter", () => {
      const client = createClient();
      expect(client.getBaseUrl()).toBe("https://outreach.example.com");
    });
  });

  describe("invalid responses", () => {
    it("handles non-JSON responses gracefully", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response("Invalid JSON", { status: 200 }));

      const client = createClient();

      await expect(client.getCourse("uni", "course")).rejects.toThrow();
    });

    it("handles empty responses", async () => {
      const fetchMock = vi.mocked(fetch);
      fetchMock.mockResolvedValueOnce(new Response("", { status: 200 }));

      const client = createClient();

      await expect(client.getUsers("uni", "course")).rejects.toThrow();
    });
  });
});
