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
      ...(query.search ? { username: { contains: query.search, mode: "insensitive" } } : {}),
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
    return c.json({ success: false, error: { code: "duplicate", message: "Editor exists" } }, 409);
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

editorsRoutes.get("/:id/profile", async (c) => {
  const id = c.req.param("id");

  const editor = await prisma.editor.findUnique({
    where: { id },
    include: {
      outreachArticles: {
        include: {
          outreachArticle: {
            include: {
              pageviews: true,
            },
          },
        },
      },
    },
  });

  if (!editor) {
    return c.json(
      {
        success: false,
        error: { code: "not_found", message: "Editor not found" },
      },
      404,
    );
  }

  const articles = editor.outreachArticles.map((oa) => oa.outreachArticle);
  const articlesCount = articles.length;
  const totalEdits = articles.reduce((sum, article) => sum + (article.characterSum > 0 ? 1 : 0), 0);
  const charactersAdded = articles.reduce((sum, article) => sum + article.characterSum, 0);
  const referencesAdded = articles.reduce((sum, article) => sum + article.referencesCount, 0);
  const pageviews = articles.reduce((sum, article) => {
    const latestPageview = article.pageviews.sort(
      (a, b) => b.snapshotDate.getTime() - a.snapshotDate.getTime(),
    )[0];
    return sum + (latestPageview?.cumulativeViews || 0);
  }, 0);

  const outreachStats = {
    articlesCount,
    totalEdits,
    charactersAdded,
    referencesAdded,
    pageviews,
  };

  let wikimediaProfile = null;
  try {
    const firstArticle = articles[0];
    const wikiBase = firstArticle
      ? `https://${firstArticle.language}.${firstArticle.project}.org`
      : "https://en.wikipedia.org";

    const { WikimediaClient } = await import("@repo/utils");
    const client = new WikimediaClient({ baseUrl: `${wikiBase}/w/api.php` });

    interface UserQueryResponse {
      query?: {
        users?: Array<{
          userid?: number;
          name?: string;
          registration?: string;
          editcount?: number;
          gender?: string;
          missing?: boolean;
        }>;
      };
    }

    const response = (await client.request("", {
      action: "query",
      list: "users",
      ususers: editor.username,
      usprop: "registration|editcount|gender",
      format: "json",
    })) as UserQueryResponse;

    const user = response.query?.users?.[0];
    if (user && !user.missing) {
      wikimediaProfile = {
        registrationDate: user.registration || null,
        editCount: user.editcount || 0,
        gender: user.gender || null,
      };
    }
  } catch (error) {
    console.error("Failed to fetch MediaWiki profile:", error);
  }

  return c.json({
    success: true,
    data: {
      editor: {
        id: editor.id,
        username: editor.username,
      },
      outreachStats,
      wikimediaProfile,
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        language: article.language,
        project: article.project,
        url: article.url,
        characterSum: article.characterSum,
        referencesCount: article.referencesCount,
        isNewArticle: article.isNewArticle,
        rating: article.rating,
      })),
    },
  });
});
