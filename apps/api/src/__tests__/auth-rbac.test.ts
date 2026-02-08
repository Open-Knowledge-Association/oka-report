import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Hono } from "hono";
import { requireRole } from "../middleware/rbac";
import { authMiddleware } from "../middleware/auth";
import { prisma } from "@repo/db";

const app = new Hono();

app.use("/admin/*", authMiddleware);
app.use("/admin/viewer-only", requireRole(["viewer", "editor", "admin"]));
app.use("/admin/editor-only", requireRole(["editor", "admin"]));
app.use("/admin/admin-only", requireRole(["admin"]));

app.get("/admin/viewer-only", (c) => c.json({ message: "viewer access" }));
app.get("/admin/editor-only", (c) => c.json({ message: "editor access" }));
app.get("/admin/admin-only", (c) => c.json({ message: "admin access" }));

describe("RBAC Middleware", () => {
  let viewerUser: any;
  let editorUser: any;
  let adminUser: any;
  let viewerSession: any;
  let editorSession: any;
  let adminSession: any;

  beforeAll(async () => {
    viewerUser = await prisma.user.create({
      data: {
        email: "rbac-viewer@example.com",
        name: "RBAC Viewer",
        googleId: "google-rbac-viewer",
        role: "viewer",
      },
    });

    editorUser = await prisma.user.create({
      data: {
        email: "rbac-editor@example.com",
        name: "RBAC Editor",
        googleId: "google-rbac-editor",
        role: "editor",
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: "rbac-admin@example.com",
        name: "RBAC Admin",
        googleId: "google-rbac-admin",
        role: "admin",
      },
    });

    viewerSession = await prisma.session.create({
      data: {
        userId: viewerUser.id,
        token: "rbac-viewer-session",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    editorSession = await prisma.session.create({
      data: {
        userId: editorUser.id,
        token: "rbac-editor-session",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    adminSession = await prisma.session.create({
      data: {
        userId: adminUser.id,
        token: "rbac-admin-session",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({
      where: {
        userId: { in: [viewerUser.id, editorUser.id, adminUser.id] },
      },
    });
    await prisma.user.deleteMany({
      where: {
        id: { in: [viewerUser.id, editorUser.id, adminUser.id] },
      },
    });
    await prisma.$disconnect();
  });

  it("should allow viewer to access viewer-only route", async () => {
    const req = new Request("http://localhost/admin/viewer-only", {
      headers: { Cookie: `session=${viewerSession.token}` },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  it("should deny viewer access to editor-only route", async () => {
    const req = new Request("http://localhost/admin/editor-only", {
      headers: { Cookie: `session=${viewerSession.token}` },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Forbidden");
  });

  it("should deny viewer access to admin-only route", async () => {
    const req = new Request("http://localhost/admin/admin-only", {
      headers: { Cookie: `session=${viewerSession.token}` },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(403);
  });

  it("should allow editor to access editor-only route", async () => {
    const req = new Request("http://localhost/admin/editor-only", {
      headers: { Cookie: `session=${editorSession.token}` },
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
  });

  it("should allow admin to access all routes", async () => {
    const viewerReq = new Request("http://localhost/admin/viewer-only", {
      headers: { Cookie: `session=${adminSession.token}` },
    });
    expect((await app.fetch(viewerReq)).status).toBe(200);

    const editorReq = new Request("http://localhost/admin/editor-only", {
      headers: { Cookie: `session=${adminSession.token}` },
    });
    expect((await app.fetch(editorReq)).status).toBe(200);

    const adminReq = new Request("http://localhost/admin/admin-only", {
      headers: { Cookie: `session=${adminSession.token}` },
    });
    expect((await app.fetch(adminReq)).status).toBe(200);
  });
});
