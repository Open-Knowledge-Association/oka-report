import { Hono } from "hono";
import { prisma } from "@repo/db";
import { OutreachDashboardClient } from "@repo/utils/src/outreach-dashboard";
import {
  BulkCreateEditorSchema,
  CreateEditorSchema,
  EditorQuerySchema,
  UpdateEditorSchema,
} from "../schemas";

export const editorsRoutes = new Hono();

// In-memory cache for Wikimedia profile lookups (60 min TTL) — keeps the
// profile endpoint fast when the Wikimedia API is slow or rate-limited.
const WIKI_PROFILE_CACHE = new Map<
  string,
  { data: { registration: string | null; editcount: number; gender: string | null } | null; expiresAt: number }
>();

// Initialize Outreach Dashboard client
const dashboardClient = new OutreachDashboardClient({
  baseUrl: "https://outreachdashboard.wmflabs.org",
});

/**
 * Fetch Outreach stats and create a map by externalId and username
 * Handles both main space (character_sum_ms) and user space characters
 */
async function getOutreachStatsMap(
  school?: string,
  slug?: string,
): Promise<
  Map<
    string,
    {
      characterSum: number;
      referencesCount: number;
      uploadsCount: number;
    }
  >
> {
  const statsMap = new Map<
    string,
    {
      characterSum: number;
      referencesCount: number;
      uploadsCount: number;
    }
  >();

  try {
    let courseSchool = school;
    let courseSlug = slug;

    // If not provided, try to infer from environment or first sync job
    if (!courseSchool || !courseSlug) {
      const lastSync = await prisma.syncJob.findFirst({
        where: {
          jobType: "editors",
          status: "completed",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (!lastSync) {
        return statsMap;
      }

      // Try to parse from sync job metadata if available
      const metadata = lastSync.metadata as any;
      courseSchool = metadata?.school || process.env.OUTREACH_SCHOOL;
      courseSlug = metadata?.slug || process.env.OUTREACH_SLUG;
    }

    if (!courseSchool || !courseSlug) {
      return statsMap;
    }

    // Fetch users from Outreach Dashboard
    const userData = await dashboardClient.getUsers(courseSchool, courseSlug);
    const outreachUsers = userData.users || userData.course?.users || [];

    // Build map with externalId as key (since that's what's in DB)
    for (const user of outreachUsers) {
      const externalId = String(user.id);
      statsMap.set(externalId, {
        characterSum: user.character_sum_ms || 0,
        referencesCount: user.references_count || 0,
        uploadsCount: user.total_uploads || 0,
      });

      // Also map by username for fallback matching
      const userKey = `username:${user.username}`;
      statsMap.set(userKey, {
        characterSum: user.character_sum_ms || 0,
        referencesCount: user.references_count || 0,
        uploadsCount: user.total_uploads || 0,
      });
    }
  } catch (error) {
    console.error("Failed to fetch Outreach stats:", error);
  }

  return statsMap;
}

editorsRoutes.get("/", async (c) => {
  const query = EditorQuerySchema.parse(c.req.query());
  const school = c.req.query("school");
  const slug = c.req.query("slug");

  const editors = await prisma.editor.findMany({
    where: {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search ? { username: { contains: query.search, mode: "insensitive" } } : {}),
    },
    orderBy: { username: "asc" },
  });

  // Enrich editors with Outreach stats
  const statsMap = await getOutreachStatsMap(school, slug);
  const enrichedEditors = editors.map((editor) => {
    // Try to match by externalId first (primary key in Outreach)
    let stats = editor.externalId ? statsMap.get(editor.externalId) : null;

    // Fallback to username if externalId not found
    if (!stats) {
      stats = statsMap.get(`username:${editor.username}`);
    }

    return {
      ...editor,
      characterSum: stats?.characterSum ?? 0,
      referencesCount: stats?.referencesCount ?? 0,
      uploadsCount: stats?.uploadsCount ?? 0,
    };
  });

  return c.json({ success: true, data: enrichedEditors });
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
  let editor = await prisma.editor.findUnique({ where: { id } });

  // If not found by ID, try finding by externalId (for Outreach IDs)
  if (!editor) {
    editor = await prisma.editor.findFirst({
      where: { externalId: id },
    });
  }

  if (!editor) {
    return c.json(
      { success: false, error: { code: "not_found", message: "Editor not found" } },
      404,
    );
  }

  const contributions = await prisma.contribution.count({ where: { editorId: editor.id } });
  const uploads = await prisma.commonsUpload.count({ where: { editorId: editor.id } });

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

  let editor = await prisma.editor.findUnique({
    where: { id },
    include: {
      createdArticles: {
        include: {
          pageviews: { orderBy: { date: "desc" }, take: 1 },
        },
      },
    },
  });

  if (!editor) {
    editor = await prisma.editor.findFirst({
      where: { externalId: id },
      include: {
        createdArticles: {
          include: {
            pageviews: { orderBy: { date: "desc" }, take: 1 },
          },
        },
      },
    });
  }

  if (!editor) {
    return c.json(
      {
        success: false,
        error: { code: "not_found", message: "Editor not found" },
      },
      404,
    );
  }

  const createdArticles = editor.createdArticles;
  // editedArticlesCount = distinct articles touched by this editor
  // (fast groupBy, no need to load 1.4k article rows + pageviews).
  const editedCountAgg = await prisma.contribution.groupBy({
    by: ["articleId"],
    where: { editorId: editor.id },
    _count: { _all: true },
  });
  const editedArticlesCount = editedCountAgg.length;
  const editedArticles: Array<{
    id: string;
    title: string;
    wikiProject: string;
    url: string;
    characterSum: number;
    referencesCount: number;
    isNewArticle: boolean | null;
    rating: string | null;
    pageviews?: Array<{ type: string; views?: number; cumulativeViews?: number; date: string }>;
  }> = [];

  const articles = createdArticles;
  const articlesCount = createdArticles.length;
  // totalEdits = all program contributions by this editor (not just created
  // articles) — consistent with daily-stats aggregation.
  const totalEdits = await prisma.contribution.count({
    where: { editorId: editor.id },
  });
  // wordsAdded across ALL contributions (consistent with snapshot editors).
  const wordsAgg = await prisma.contribution.aggregate({
    where: { editorId: editor.id },
    _sum: { wordsAdded: true },
  });
  const charactersAdded = wordsAgg._sum.wordsAdded ?? 0;
  // references across ALL articles the editor touched (consistent with the
  // editors list page which shows referencesCount from the same scope).
  const refAgg = await prisma.article.aggregate({
    where: {
      contributions: { some: { editorId: editor.id } },
    },
    _sum: { referencesCount: true },
  });
  const referencesAdded = refAgg._sum.referencesCount ?? 0;
  // Pageviews = program-window views (cutoff-aware, from period_article_activity)
  // for articles this editor contributed to — consistent with the dashboard's
  // snapshot methodology (not lifetime cumulative views).
  const viewsAgg = await prisma.periodArticleActivity.aggregate({
    where: {
      granularity: "DAY",
      periodStart: { gte: new Date("2026-01-01T00:00:00Z") },
      article: {
        contributions: { some: { editorId: editor.id } },
      },
    },
    _sum: { viewsTotal: true },
  });
  const pageviews = viewsAgg._sum.viewsTotal ?? 0;

  const outreachStats = {
    articlesCount,
    totalEdits,
    charactersAdded,
    referencesAdded,
    pageviews,
    editedArticlesCount,
  };

  let wikimediaProfile = null;
  try {
    // Cache Wikimedia profile lookups in-memory (60 min TTL) so the profile
    // endpoint stays fast even when the Wikimedia API is slow/rate-limited.
    const cacheKey = editor.username;
    const cached = WIKI_PROFILE_CACHE.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      wikimediaProfile = cached.data;
    } else {
      const firstArticle = articles[0];
      const wikiBase = firstArticle
        ? `https://${firstArticle.wikiProject}`
        : "https://en.wikipedia.org";

      const { WikimediaClient } = await import("@repo/utils");
      // Profile enrichment is optional — fail fast (8s, 1 retry) instead of
      // blocking the page for 30-90s when Wikimedia is slow or rate-limited.
      const client = new WikimediaClient({
        baseUrl: `${wikiBase}/w/api.php`,
        requestTimeoutMs: 8000,
        maxRetries: 1,
      });

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
        registration: user.registration || null,
        editcount: user.editcount || 0,
        gender: user.gender || null,
      };
    }
      WIKI_PROFILE_CACHE.set(cacheKey, { data: wikimediaProfile, expiresAt: Date.now() + 60 * 60 * 1000 });
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
          isCreated: true,
          pageviews: article.pageviews ?? [],
        };
      }),
      editedArticles: editedArticles.map((article) => {
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
          isCreated: false,
          pageviews: article.pageviews ?? [],
        };
      }),
    },
  });
});

editorsRoutes.get("/:id/daily-stats", async (c) => {
  const id = c.req.param("id");
  const from = c.req.query("from");
  const to = c.req.query("to");

  let editor = await prisma.editor.findUnique({
    where: { id },
  });

  // If not found by ID, try finding by externalId (for Outreach IDs)
  if (!editor) {
    editor = await prisma.editor.findFirst({
      where: { externalId: id },
    });
  }

  if (!editor) {
    return c.json(
      {
        success: false,
        error: { code: "not_found", message: "Editor not found" },
      },
      404,
    );
  }

  const where: { editorId: string; editTimestamp?: { gte?: Date; lte?: Date } } = {
    editorId: editor.id,
  };

  if (from || to) {
    where.editTimestamp = {};
    if (from) {
      where.editTimestamp.gte = new Date(from);
    }
    if (to) {
      where.editTimestamp.lte = new Date(to);
    }
  }

  // Daily contribution stats derived from contributions (source of truth).
  const rows = await prisma.contribution.groupBy({
    by: ["editTimestamp"],
    where,
    _count: { _all: true },
    _sum: { wordsAdded: true },
    orderBy: { editTimestamp: "asc" },
  });

  const byDay = new Map<string, { date: Date; edits: number; wordsAdded: number; articlesCreated: number; articlesEdited: number }>();
  for (const r of rows) {
    const d = new Date(r.editTimestamp);
    d.setUTCHours(0, 0, 0, 0);
    const key = d.toISOString();
    const cur = byDay.get(key) ?? { date: d, edits: 0, wordsAdded: 0, articlesCreated: 0, articlesEdited: 0 };
    cur.edits += r._count._all;
    cur.wordsAdded += r._sum.wordsAdded ?? 0;
    byDay.set(key, cur);
  }

  // Distinct articles per day for articlesCreated/articlesEdited.
  const distinct = await prisma.contribution.findMany({
    where,
    select: { editTimestamp: true, articleId: true, isCreation: true },
  });
  const createdSet = new Set<string>();
  const editedSet = new Set<string>();
  for (const c of distinct) {
    const d = new Date(c.editTimestamp);
    d.setUTCHours(0, 0, 0, 0);
    const key = d.toISOString();
    const day = byDay.get(key);
    if (!day) continue;
    if (c.isCreation) {
      const ck = `${key}|${c.articleId}`;
      if (!createdSet.has(ck)) {
        createdSet.add(ck);
        day.articlesCreated += 1;
      }
    }
    const ek = `${key}|${c.articleId}`;
    if (!editedSet.has(ek)) {
      editedSet.add(ek);
      day.articlesEdited += 1;
    }
  }

  const dailyStats = [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());

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

  // Aggregate totals from contributions (source of truth)
  const [contribAgg, createdCount, commonsCount] = await Promise.all([
    prisma.contribution.aggregate({
      where: { editorId: id },
      _count: { _all: true },
      _sum: { wordsAdded: true },
    }),
    prisma.contribution.count({ where: { editorId: id, isCreation: true } }),
    prisma.commonsUpload.count({ where: { editorId: id } }),
  ]);
  const totals = {
    articlesCreated: createdCount,
    wordsAdded: contribAgg._sum.wordsAdded ?? 0,
    referencesAdded: 0,
    edits: contribAgg._count._all,
    commonsUploads: commonsCount,
  };

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
