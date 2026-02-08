import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@repo/db";

describe("Auth Models", () => {
  beforeAll(async () => {});

  afterAll(async () => {
    await prisma.auditLog.deleteMany({});
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

  it("should create user with default viewer role", async () => {
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
        googleId: "google123",
      },
    });
    expect(user.role).toBe("viewer");
    expect(user.isActive).toBe(true);
    expect(user.googleId).toBe("google123");
  });

  it("should accept admin and editor roles", async () => {
    const admin = await prisma.user.create({
      data: {
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        googleId: "google-admin",
      },
    });
    expect(admin.role).toBe("admin");

    const editor = await prisma.user.create({
      data: {
        email: "editor@example.com",
        name: "Editor User",
        role: "editor",
        googleId: "google-editor",
      },
    });
    expect(editor.role).toBe("editor");
  });

  it("should create session with user relation", async () => {
    const user = await prisma.user.create({
      data: {
        email: "session@example.com",
        name: "Session User",
        googleId: "google-session",
      },
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: "test-token-123",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    expect(session.userId).toBe(user.id);
    expect(session.token).toBe("test-token-123");
  });

  it("should create audit log entry", async () => {
    const user = await prisma.user.create({
      data: {
        email: "audit@example.com",
        name: "Audit User",
        googleId: "google-audit",
      },
    });

    const audit = await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: "auth.login",
        targetType: "user",
        targetId: user.id,
        metadata: { ip: "127.0.0.1" },
      },
    });

    expect(audit.action).toBe("auth.login");
    expect(audit.actorId).toBe(user.id);
  });
});
