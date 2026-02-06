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

editorsRoutes.delete("/all", async (c) => {
  await prisma.$transaction(async (tx) => {
    await tx.articleEditor.deleteMany({});
    await tx.contribution.deleteMany({});
    await tx.commonsUpload.deleteMany({});
    await tx.article.updateMany({
      where: { createdByEditorId: { not: null } },
      data: { createdByEditorId: null },
    });
    await tx.editor.deleteMany({});
  });

  return c.json({ success: true, message: "All editors deleted" });
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
      articles: {
        include: {
          article: {
            include: {
              pageviews: { orderBy: { date: "desc" }, take: 1 },
            },
          },
        },
      },
      createdArticles: {
        include: {
          pageviews: { orderBy: { date: "desc" }, take: 1 },
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

  const attachedArticles = editor.articles.map((ae) => ae.article);
  const articleMap = new Map(attachedArticles.map((article) => [article.id, article]));
  for (const article of editor.createdArticles) {
    articleMap.set(article.id, article);
  }

  const articles = Array.from(articleMap.values());
  const articlesCount = articles.length;
  const totalEdits = articles.reduce((sum, article) => sum + (article.characterSum > 0 ? 1 : 0), 0);
  const charactersAdded = articles.reduce((sum, article) => sum + article.characterSum, 0);
  const referencesAdded = articles.reduce((sum, article) => sum + article.referencesCount, 0);
  const pageviews = articles.reduce((sum, article) => {
    const latestPageview = article.pageviews[0];
    return sum + (latestPageview?.cumulativeViews ?? latestPageview?.views ?? 0);
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
      ? `https://${firstArticle.wikiProject}`
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

  // Parse wikiProject to extract language and project for backward compatibility
  const parseWikiProject = (wikiProject: string) => {
    const match = wikiProject.match(/^(.+?)\.(.+?)\.org$/);
    if (match) {
      return { language: match[1], project: match[2] };
    }
    return { language: "en", project: "wikipedia" };
  };

  // Get the primary wiki for editor profile display
  const firstArticle = articles[0];
  const editorWiki = firstArticle ? firstArticle.wikiProject.replace(".org", "") : "en.wikipedia";

  return c.json({
    success: true,
    data: {
      editor: {
        id: editor.id,
        username: editor.username,
        wiki: editorWiki,
      },
      outreachStats,
      wikimediaProfile,
      articles: articles.map((article) => {
        const { language, project } = parseWikiProject(article.wikiProject);
        return {
          id: article.id,
          title: article.title,
          wikiProject: article.wikiProject,
          language,
          project,
          url: article.url,
          characterSum: article.characterSum,
          referencesCount: article.referencesCount,
          isNewArticle: article.isNewArticle,
          rating: article.rating,
        };
      }),
    },
  });
});
