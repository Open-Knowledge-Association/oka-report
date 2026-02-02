import { Hono } from "hono";
import { prisma } from "@repo/db";
import {
  BulkCreateEditorSchema,
  CreateEditorSchema,
  EditorQuerySchema,
  UpdateEditorSchema,
} from "../schemas";

export const editorsRoutes = new Hono();

editorsRoutes.get("/", async (c) => {
  const query = EditorQuerySchema.parse(c.req.query());
  const editors = await prisma.editor.findMany({
    where: {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search
        ? { username: { contains: query.search, mode: "insensitive" } }
        : {}),
    },
    orderBy: { username: "asc" },
  });

  return c.json({ success: true, data: editors });
});

editorsRoutes.post("/", async (c) => {
  const body = CreateEditorSchema.parse(await c.req.json());

  const existing = await prisma.editor.findUnique({
    where: { username: body.username },
  });

  if (existing) {
    return c.json(
      { success: false, error: { code: "duplicate", message: "Editor exists" } },
      409,
    );
  }

  const editor = await prisma.editor.create({
    data: {
      username: body.username,
      source: body.source ?? "manual",
    },
  });

  return c.json({ success: true, data: editor }, 201);
});

editorsRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const editor = await prisma.editor.findUnique({ where: { id } });

  if (!editor) {
    return c.json(
      { success: false, error: { code: "not_found", message: "Editor not found" } },
      404,
    );
  }

  const contributions = await prisma.contribution.count({ where: { editorId: id } });
  const uploads = await prisma.commonsUpload.count({ where: { editorId: id } });

  return c.json({
    success: true,
    data: {
      ...editor,
      stats: {
        contributions,
        uploads,
      },
    },
  });
});

editorsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body = UpdateEditorSchema.parse(await c.req.json());

  const updated = await prisma.editor.update({
    where: { id },
    data: {
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  return c.json({ success: true, data: updated });
});

editorsRoutes.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await prisma.editor.update({
    where: { id },
    data: { isActive: false },
  });

  return c.body(null, 204);
});

editorsRoutes.post("/bulk", async (c) => {
  const body = BulkCreateEditorSchema.parse(await c.req.json());

  const results = {
    created: 0,
    skipped: 0,
    errors: 0,
    details: [] as Array<{ username: string; status: string; error?: string }>,
  };

  for (const username of body.usernames) {
    try {
      const existing = await prisma.editor.findUnique({
        where: { username },
      });

      if (existing) {
        results.skipped++;
        results.details.push({ username, status: "skipped" });
        continue;
      }

      await prisma.editor.create({
        data: { username, source: "csv_import" },
      });

      results.created++;
      results.details.push({ username, status: "created" });
    } catch (error) {
      results.errors++;
      results.details.push({
        username,
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return c.json({ success: true, data: results }, 201);
});
