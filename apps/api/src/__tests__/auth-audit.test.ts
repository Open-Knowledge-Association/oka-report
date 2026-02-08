import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { auditLog } from "../services/audit";
import { prisma } from "@repo/db";

describe("Audit Logging", () => {
  let testUser: any;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        email: "audit-test@example.com",
        name: "Audit Test",
        googleId: "google-audit-test",
        role: "admin",
      },
    });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { actorId: testUser.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    await prisma.$disconnect();
  });

  it("should create audit log for login action", async () => {
    await auditLog({
      actorId: testUser.id,
      action: "auth.login",
      metadata: { ip: "127.0.0.1" },
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        actorId: testUser.id,
        action: "auth.login",
      },
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe("auth.login");
  });

  it("should create audit log with target info", async () => {
    const editorId = "editor-123";

    await auditLog({
      actorId: testUser.id,
      action: "editor.create",
      targetType: "editor",
      targetId: editorId,
      metadata: { username: "testeditor" },
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        actorId: testUser.id,
        action: "editor.create",
      },
    });

    expect(logs[0].targetType).toBe("editor");
    expect(logs[0].targetId).toBe(editorId);
  });

  it("should create audit log without actor (system action)", async () => {
    await auditLog({
      action: "system.cleanup",
      metadata: { deletedCount: 5 },
    });

    const logs = await prisma.auditLog.findMany({
      where: {
        action: "system.cleanup",
      },
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].actorId).toBeNull();
  });
});
