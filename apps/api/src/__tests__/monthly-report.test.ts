import { afterAll, describe, test, expect } from "vitest";
import { app } from "../index";

const server = Bun.serve({ port: 0, fetch: app.fetch });
const API_URL = server.url.origin;

afterAll(() => server.stop());

describe("Monthly Report API", () => {
  describe("GET /api/stats/monthly", () => {
    test("should return monthly stats for valid year and month", async () => {
      const response = await fetch(`${API_URL}/api/stats/monthly?year=2024&month=1`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.year).toBe(2024);
      expect(data.data.month).toBe(1);
      expect(Array.isArray(data.data.byWikiProject)).toBe(true);
      expect(data.data.totals).toBeDefined();
      expect(data.data.totals).toHaveProperty("edits");
      expect(data.data.totals).toHaveProperty("wordsAdded");
      expect(data.data.totals).toHaveProperty("pageviews");
      expect(data.data.totals).toHaveProperty("articlesCreated");
    });

    test("should include MoM data when includeMoM=true", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/monthly?year=2024&month=1&includeMoM=true`,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.mom).toBeDefined();
      expect(data.data.mom.articlesCreated).toBeDefined();
      expect(data.data.mom.articlesCreated).toHaveProperty("current");
      expect(data.data.mom.articlesCreated).toHaveProperty("previous");
      expect(data.data.mom.articlesCreated).toHaveProperty("changePercent");
    });

    test("should filter by wikiProject when provided", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/monthly?year=2024&month=1&wikiProject=id.wikipedia.org`,
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
    });

    test("should return 400 for invalid year", async () => {
      const response = await fetch(`${API_URL}/api/stats/monthly?year=invalid&month=1`);
      expect(response.status).toBe(400);
    });

    test("should return 400 for invalid month", async () => {
      const response = await fetch(`${API_URL}/api/stats/monthly?year=2024&month=13`);
      expect(response.status).toBe(400);
    });

    test("should return 400 for month=0", async () => {
      const response = await fetch(`${API_URL}/api/stats/monthly?year=2024&month=0`);
      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/stats/monthly/export", () => {
    test("should export PDF with correct headers", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/monthly/export?year=2024&month=1&format=pdf`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/pdf");
      expect(response.headers.get("content-disposition")).toContain(
        "oka-monthly-report-2024-1.pdf",
      );
    });

    test("should export CSV with correct headers", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/monthly/export?year=2024&month=1&format=csv`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/csv");
      expect(response.headers.get("content-disposition")).toContain(
        "oka-monthly-report-2024-1.csv",
      );
    });

    test("should export JSON with correct headers", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/monthly/export?year=2024&month=1&format=json`,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("content-disposition")).toContain(
        "oka-monthly-report-2024-1.json",
      );
    });

    test("should return 400 for invalid format", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/monthly/export?year=2024&month=1&format=invalid`,
      );
      expect(response.status).toBe(400);
    });

    test("should return 400 for invalid year", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/monthly/export?year=invalid&month=1&format=pdf`,
      );
      expect(response.status).toBe(400);
    });

    test("should return 400 for invalid month", async () => {
      const response = await fetch(
        `${API_URL}/api/stats/monthly/export?year=2024&month=invalid&format=pdf`,
      );
      expect(response.status).toBe(400);
    });
  });
});
