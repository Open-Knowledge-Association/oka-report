import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { prisma } from "@repo/db";

process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

const app = new Hono();

const authRoutes = await import("../routes/auth").then((m) => m.authRoutes);
app.route("/auth", authRoutes);

describe("Google OAuth", () => {
  afterAll(async () => {
    await prisma.session.deleteMany({});
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: "@example.com",
        },
      },
    });
    await prisma.$disconnect();
  });

  it("should redirect to Google OAuth URL on /auth/google", async () => {
    const req = new Request("http://localhost/auth/google");
    const res = await app.fetch(req);
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("oauth");
  });

  it("should reject callback without state parameter", async () => {
    const req = new Request("http://localhost/auth/google/callback?code=fakecode");
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("state");
  });

  it("should reject callback with invalid state", async () => {
    const req = new Request("http://localhost/auth/google/callback?code=fakecode&state=invalid");
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
  });
});
