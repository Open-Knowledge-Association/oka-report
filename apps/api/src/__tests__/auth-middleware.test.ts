import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { prisma } from "@repo/db";

const app = new Hono();
app.use("/protected/*", authMiddleware);
app.get("/protected/test", (c) => {
  return c.json({ user: c.get("user"), message: "access granted" });
});
app.post("/protected/action", (c) => {
  return c.json({ success: true });
});

describe("Auth Middleware", () => {
  let testUser: any;
  let testSession: any;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        email: "middleware-test@example.com",
        name: "Middleware Test",
        googleId: "google-middleware-test",
        role: "viewer",
      },
    });

    testSession = await prisma.session.create({
      data: {
        userId: testUser.id,
        token: "test-session-token-123",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    await prisma.$disconnect();
  });

  it("should return 401 for missing session cookie", async () => {
    const req = new Request("http://localhost/protected/test");
    const res = await app.fetch(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Unauthorized");
  });

  it("should return 401 for invalid session token", async () => {
    const req = new Request("http://localhost/protected/test", {
      headers: {
        Cookie: "session=invalid-token",
      },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(401);
  });

  it("should allow access with valid session", async () => {
    const req = new Request("http://localhost/protected/test", {
      headers: {
        Cookie: `session=${testSession.token}`,
      },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.id).toBe(testUser.id);
    expect(body.message).toBe("access granted");
  });
});
