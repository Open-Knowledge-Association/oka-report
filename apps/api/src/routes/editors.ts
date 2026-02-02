import { Hono } from "hono";
import { prisma } from "@repo/db";
import {
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
