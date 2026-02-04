import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { app } from "../index";

const baseUrl = "http://localhost:3001";

describe("API Integration Tests", () => {
  let testEditorId: string;

  describe("GET /api", () => {
    it("should return API info", async () => {
      const res = await app.request("/");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toBe("OKA Stats API");
    });
  });

  describe("Editors API", () => {
    it("GET /api/editors should return list", async () => {
      const res = await app.request("/api/editors");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });

    it("POST /api/editors should create editor", async () => {
      const res = await app.request("/api/editors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: `test_editor_${Date.now()}`,
          source: "manual",
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.username).toBeDefined();
      testEditorId = json.data.id;
    });

    it("POST /api/editors/bulk should import multiple", async () => {
      const res = await app.request("/api/editors/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [`bulk_test_1_${Date.now()}`, `bulk_test_2_${Date.now()}`],
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.created).toBeGreaterThanOrEqual(0);
    });

    it("GET /api/editors/:id should return editor", async () => {
      if (!testEditorId) return;
      const res = await app.request(`/api/editors/${testEditorId}`);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(testEditorId);
    });
  });

  describe("Stats API", () => {
    it("GET /api/stats/overall should return stats", async () => {
      const res = await app.request("/api/stats/overall");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.totals).toBeDefined();
    });

    it("GET /api/stats/editors should return editor stats", async () => {
      const res = await app.request("/api/stats/editors");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  describe("Sync API", () => {
    it("GET /api/sync/status should return status", async () => {
      const res = await app.request("/api/sync/status");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
    });
  });

  describe("Outreach Articles API", () => {
    it("POST /api/outreach/articles/sync should trigger article sync", async () => {
      const res = await app.request("/api/outreach/articles/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school: "OKA",
          slug: "OKA",
        }),
      });
      expect(res.status).toBe(202);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.jobId).toBeDefined();
      expect(json.data.status).toBe("accepted");
    });

    it("POST /api/outreach/articles/sync should reject missing school", async () => {
      const res = await app.request("/api/outreach/articles/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: "OKA",
        }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("GET /api/outreach/articles/db should return paginated articles", async () => {
      const res = await app.request("/api/outreach/articles/db");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data.articles)).toBe(true);
      expect(json.data.pagination).toBeDefined();
      expect(json.data.pagination.total).toBeDefined();
      expect(json.data.pagination.page).toBeDefined();
      expect(json.data.pagination.limit).toBeDefined();
      expect(json.data.pagination.totalPages).toBeDefined();
    });

    it("GET /api/outreach/articles/db should support pagination", async () => {
      const res = await app.request("/api/outreach/articles/db?page=2&limit=10");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.pagination.page).toBe(2);
      expect(json.data.pagination.limit).toBe(10);
    });

    it("GET /api/outreach/articles/db should use default pagination", async () => {
      const res = await app.request("/api/outreach/articles/db");
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.pagination.page).toBe(1);
      expect(json.data.pagination.limit).toBe(50);
    });
  });
});
