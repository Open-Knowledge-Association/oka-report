import { describe, test, expect } from "vitest";

const API_URL = process.env.API_URL || "http://localhost:3001";

describe("Annual Report API", () => {
  describe("GET /api/stats/annual", () => {
    test("should return annual stats for valid year", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual?year=2024`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2024);
      expect(Array.isArray(data.data.byWikiProject)).toBe(true);
      expect(data.data.totals).toBeDefined();
      expect(data.data.totals).toHaveProperty("edits");
      expect(data.data.totals).toHaveProperty("wordsAdded");
      expect(data.data.totals).toHaveProperty("pageviews");
      expect(data.data.totals).toHaveProperty("articlesCreated");
    });

    test("should include YoY data when includeYoY=true", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual?year=2024&includeYoY=true`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.yoy).toBeDefined();
      expect(data.data.yoy.articlesCreated).toBeDefined();
      expect(data.data.yoy.articlesCreated).toHaveProperty("current");
      expect(data.data.yoy.articlesCreated).toHaveProperty("previous");
      expect(data.data.yoy.articlesCreated).toHaveProperty("changePercent");
    });

    test("should filter by wikiProject when provided", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/annual?year=2024&wikiProject=id.wikipedia.org`,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("should return 400 for invalid year", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual?year=invalid`);
      expect(response.status).toBe(400);
    });

    test("should return 400 for future year", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual?year=2099`);
      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/stats/top-articles", () => {
    test("should return top articles for valid year", async () => {
      const response = await fetch(`${API_URL}/api/stats/top-articles?year=2024`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2024);
      expect(Array.isArray(data.data.articles)).toBe(true);
      expect(data.data.articles.length).toBeLessThanOrEqual(10);
    });

    test("should respect limit parameter", async () => {
      const response = await fetch(`${API_URL}/api/stats/top-articles?year=2024&limit=5`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.articles.length).toBeLessThanOrEqual(5);
    });

    test("should filter by wikiProject when provided", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/top-articles?year=2024&wikiProject=id.wikipedia.org`,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("should return 400 for invalid year", async () => {
      const response = await fetch(`${API_URL}/api/stats/top-articles?year=invalid`);
      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/stats/annual/export", () => {
    test("should export PDF with correct headers", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual/export?year=2024&format=pdf`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/pdf");
      expect(response.headers.get("content-disposition")).toContain("oka-annual-report-2024.pdf");
    });

    test("should export CSV with correct headers", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual/export?year=2024&format=csv`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/csv");
      expect(response.headers.get("content-disposition")).toContain("oka-annual-report-2024.csv");
    });

    test("should export JSON with correct headers", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual/export?year=2024&format=json`);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("content-disposition")).toContain("oka-annual-report-2024.json");
    });

    test("should return 400 for invalid format", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual/export?year=2024&format=invalid`);
      expect(response.status).toBe(400);
    });

    test("should return 400 for invalid year", async () => {
      const response = await fetch(`${API_URL}/api/stats/annual/export?year=invalid&format=pdf`);
      expect(response.status).toBe(400);
    });
  });
});
