import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import app from "../index";

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
});
