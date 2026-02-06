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

editorsRoutes.get("/:id/commons-uploads", async (c) => {
  const id = c.req.param("id");

  const editor = await prisma.editor.findUnique({
    where: { id },
  });

  if (!editor) {
    return c.json(
      { success: false, error: { code: "not_found", message: "Editor not found" } },
      404,
    );
  }

  const uploads = await prisma.commonsUpload.findMany({
    where: { editorId: id },
    orderBy: { uploadedAt: "desc" },
  });

  const generateThumbnailUrl = (fileName: string): string | null => {
    // Check if file is an image based on extension
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const isImage = imageExtensions.some((ext) => fileName.toLowerCase().endsWith(ext));

    if (!isImage) return null;

    const firstChar = fileName.charAt(0);
    const firstTwoChars = fileName.substring(0, 2);
    const width = 200;

    return `https://upload.wikimedia.org/wikipedia/commons/thumb/${firstChar}/${firstTwoChars}/${encodeURIComponent(fileName)}/${width}px-${encodeURIComponent(fileName)}`;
  };

  const data = uploads.map((upload) => ({
    fileName: upload.fileName,
    fileUrl: upload.fileUrl,
    fileSize: upload.fileSize,
    mimeType: upload.mimeType,
    uploadedAt: upload.uploadedAt,
    thumbnailUrl: generateThumbnailUrl(upload.fileName),
  }));

  return c.json({ success: true, data });
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

editorsRoutes.get("/:id/daily-stats", async (c) => {
  const id = c.req.param("id");
  const from = c.req.query("from");
  const to = c.req.query("to");

  const editor = await prisma.editor.findUnique({
    where: { id },
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

  const where: { editorId: string; date?: { gte?: Date; lte?: Date } } = {
    editorId: id,
  };

  if (from || to) {
    where.date = {};
    if (from) {
      where.date.gte = new Date(from);
    }
    if (to) {
      where.date.lte = new Date(to);
    }
  }

  const dailyStats = await prisma.editorDailyStat.findMany({
    where,
    orderBy: { date: "asc" },
  });

  return c.json({
    success: true,
    data: dailyStats,
  });
});

editorsRoutes.get("/:id/achievements", async (c) => {
  const id = c.req.param("id");

  const editor = await prisma.editor.findUnique({
    where: { id },
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

  // Fetch all daily stats for this editor
  const dailyStats = await prisma.editorDailyStat.findMany({
    where: { editorId: id },
  });

  // Calculate aggregate totals
  const totals = dailyStats.reduce(
    (acc, stat) => ({
      articlesCreated: acc.articlesCreated + stat.articlesCreated,
      wordsAdded: acc.wordsAdded + stat.wordsAdded,
      referencesAdded: acc.referencesAdded + stat.referencesAdded,
      edits: acc.edits + stat.edits,
      commonsUploads: acc.commonsUploads + stat.commonsUploads,
    }),
    {
      articlesCreated: 0,
      wordsAdded: 0,
      referencesAdded: 0,
      edits: 0,
      commonsUploads: 0,
    },
  );

  // Calculate account age in days
  const accountAgeMs = new Date().getTime() - editor.createdAt.getTime();
  const accountAgeDays = Math.floor(accountAgeMs / (1000 * 60 * 60 * 24));

  // Define badges with criteria
  type BadgeId =
    | "first_article"
    | "prolific_writer"
    | "wordsmith"
    | "reference_master"
    | "wiki_contributor"
    | "commons_contributor"
    | "veteran";

  interface Badge {
    id: BadgeId;
    name: string;
    description: string;
    icon: string;
    achieved: boolean;
    achievedAt: string | null;
  }

  const badges: Badge[] = [
    {
      id: "first_article",
      name: "First Article",
      description: "Created your first article",
      icon: "✍️",
      achieved: totals.articlesCreated >= 1,
      achievedAt: totals.articlesCreated >= 1 ? editor.createdAt.toISOString() : null,
    },
    {
      id: "prolific_writer",
      name: "Prolific Writer",
      description: "Created 10 or more articles",
      icon: "📚",
      achieved: totals.articlesCreated >= 10,
      achievedAt: null, // Would need to fetch from contributions to determine exact date
    },
    {
      id: "wordsmith",
      name: "Wordsmith",
      description: "Added 10,000 or more words",
      icon: "💬",
      achieved: totals.wordsAdded >= 10000,
      achievedAt: null, // Would need to fetch from contributions to determine exact date
    },
    {
      id: "reference_master",
      name: "Reference Master",
      description: "Added 100 or more references",
      icon: "📖",
      achieved: totals.referencesAdded >= 100,
      achievedAt: null, // Would need to fetch from contributions to determine exact date
    },
    {
      id: "wiki_contributor",
      name: "Wiki Contributor",
      description: "Made 50 or more edits",
      icon: "🔧",
      achieved: totals.edits >= 50,
      achievedAt: null, // Would need to fetch from contributions to determine exact date
    },
    {
      id: "commons_contributor",
      name: "Commons Contributor",
      description: "Uploaded 5 or more files to Commons",
      icon: "📸",
      achieved: totals.commonsUploads >= 5,
      achievedAt: null, // Would need to fetch from contributions to determine exact date
    },
    {
      id: "veteran",
      name: "Veteran Editor",
      description: "Member for 1 year or more",
      icon: "⭐",
      achieved: accountAgeDays >= 365,
      achievedAt:
        accountAgeDays >= 365
          ? new Date(editor.createdAt.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString()
          : null,
    },
  ];

  return c.json({
    success: true,
    data: badges,
  });
});
