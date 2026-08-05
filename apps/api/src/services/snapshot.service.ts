import type { PrismaClient, Granularity } from "@repo/db/generated/prisma/client";

interface BuildResult {
  granularity: Granularity;
  days: number;
  months: number;
  years: number;
  rows: number;
}

/**
 * Layered metric snapshot builder.
 *
 * Granularity ladder:
 *   DAY   — computed from raw tables (contributions/pageviews/commons) per
 *           program article, per calendar day. `viewsTotal` = sum of all
 *           article pageviews that day; `viewsActive` = sum of pageviews of
 *           articles that were created OR edited by program editors that day.
 *   MONTH — sum of DAY rows of that month.
 *   YEAR  — sum of MONTH rows of that year.
 *
 * The API reads only this table; nothing is aggregated on the fly.
 */
export class SnapshotService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /** Rebuild the whole snapshot ladder (DAY + MONTH + YEAR) for the program. */
  async buildAll(): Promise<BuildResult> {
    const program = await this.prisma.program.findFirst({ where: { slug: "OKA" } });
    if (!program) throw new Error("OKA program not found; run program_sync first");
    const programId = program.id;

    // Raw inputs scoped to the program.
    const [articles, contributions, pageviews, commons] = await Promise.all([
      this.prisma.article.findMany({
        where: { programId },
        select: { id: true, wikiProject: true },
      }),
      this.prisma.contribution.findMany({
        where: { article: { programId } },
        select: { articleId: true, editTimestamp: true, wordsAdded: true, isCreation: true, editorId: true },
      }),
      this.prisma.pageview.findMany({
        where: { type: "DAILY", agentType: "ALL_AGENTS" },
        select: { articleId: true, date: true, views: true },
      }),
      this.prisma.commonsUpload.findMany({
        where: { editor: { programMembers: { some: { programId } } } },
        select: { editorId: true, uploadedAt: true },
      }),
    ]);

    // --- Enrollment cutoff per editor (attribution). ---
    const members = await this.prisma.programMember.findMany({
      where: { programId, isActive: true },
      select: { editorId: true, enrolledAt: true },
    });
    const enrolledByEditor = new Map(members.map((m) => [m.editorId, m.enrolledAt]));

    // --- Article activity per day: edits, words, created, editors, active. ---
    // articleDay -> { edits, wordsAdded, editors:Set, created }
    const articleDayMap = new Map<string, { edits: number; words: number; editors: Set<string>; created: boolean }>();
    // editedArticleIdsByDay -> Set<articleId> for articlesEdited count
    const editedArticleIdsByDay = new Map<string, Set<string>>();
    const articleIdSet = new Set(articles.map((a) => a.id));
    const dayKey = (d: Date) => {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };

    for (const c of contributions) {
      const enrolledAt = enrolledByEditor.get(c.editorId);
      if (!enrolledAt || c.editTimestamp < enrolledAt) continue; // pre-join, exclude
      if (!articleIdSet.has(c.articleId)) continue;
      const k = dayKey(c.editTimestamp);
      let entry = articleDayMap.get(k);
      if (!entry) {
        entry = { edits: 0, words: 0, editors: new Set(), created: false };
        articleDayMap.set(k, entry);
      }
      entry.edits += 1;
      entry.words += c.wordsAdded;
      entry.editors.add(c.editorId);
      if (c.isCreation) entry.created = true;
      // Track edited article ids per day.
      let editedSet = editedArticleIdsByDay.get(k);
      if (!editedSet) {
        editedSet = new Set();
        editedArticleIdsByDay.set(k, editedSet);
      }
      editedSet.add(c.articleId);
    }

    // --- Pageviews per day (ALL_AGENTS) + active-article scope. ---
    // day -> { total, active }  where active = pageviews of articles edited that day.
    const dayViews = new Map<string, { total: number; active: number }>();
    const viewsByArticleDay = new Map<string, number>();
    for (const pv of pageviews) {
      const k = dayKey(pv.date);
      const entry = dayViews.get(k) ?? { total: 0, active: 0 };
      entry.total += pv.views;
      dayViews.set(k, entry);
      viewsByArticleDay.set(`${pv.articleId}|${k}`, (viewsByArticleDay.get(`${pv.articleId}|${k}`) ?? 0) + pv.views);
    }
    // viewsActive = pageviews of articles that were created OR edited by program
    // editors that day (articles "active" in the program on that day).
    for (const [k, editedSet] of editedArticleIdsByDay) {
      let active = 0;
      for (const articleId of editedSet) {
        active += viewsByArticleDay.get(`${articleId}|${k}`) ?? 0;
      }
      const entry = dayViews.get(k);
      if (entry) entry.active = active;
    }

    // --- Commons uploads per day. ---
    const commonsByDay = new Map<string, number>();
    for (const u of commons) {
      const enrolledAt = enrolledByEditor.get(u.editorId);
      if (!enrolledAt || u.uploadedAt < enrolledAt) continue;
      const k = dayKey(u.uploadedAt);
      commonsByDay.set(k, (commonsByDay.get(k) ?? 0) + 1);
    }

    // --- Refs per day: not available from raw; snapshot articles.refs at DAY
    //     granularity as current value (refsAdded = 0 for historical days). ---
    //     (Decided: refs stays snapshot, not a daily metric.)

    // --- Build DAY rows. ---
    // Collect all days that have any activity (edits OR views OR commons).
    const allDays = new Set<string>([...articleDayMap.keys(), ...dayViews.keys(), ...commonsByDay.keys()]);
    const sortedDays = [...allDays].sort();

    // --- Per-article and per-editor activity per day (for detail tables). ---
    // articleDay -> per-article metrics
    const articleDetailByDay = new Map<string, Map<string, {
      edits: number; words: number; created: boolean; viewsTotal: number;
    }>>();
    for (const c of contributions) {
      const enrolledAt = enrolledByEditor.get(c.editorId);
      if (!enrolledAt || c.editTimestamp < enrolledAt) continue;
      const k = dayKey(c.editTimestamp);
      let byArticle = articleDetailByDay.get(k);
      if (!byArticle) {
        byArticle = new Map();
        articleDetailByDay.set(k, byArticle);
      }
      const a = byArticle.get(c.articleId) ?? { edits: 0, words: 0, created: false, viewsTotal: 0 };
      a.edits += 1;
      a.words += c.wordsAdded;
      if (c.isCreation) a.created = true;
      byArticle.set(c.articleId, a);
    }
    // Add per-article views for active days.
    for (const [k, byArticle] of articleDetailByDay) {
      for (const [articleId, a] of byArticle) {
        a.viewsTotal = viewsByArticleDay.get(`${articleId}|${k}`) ?? 0;
      }
    }
    // editorDay -> per-editor metrics
    const editorDetailByDay = new Map<string, Map<string, {
      edits: number; words: number; articlesCreated: number; articlesEdited: number; commonsUploads: number;
    }>>();
    for (const c of contributions) {
      const enrolledAt = enrolledByEditor.get(c.editorId);
      if (!enrolledAt || c.editTimestamp < enrolledAt) continue;
      const k = dayKey(c.editTimestamp);
      let byEditor = editorDetailByDay.get(k);
      if (!byEditor) {
        byEditor = new Map();
        editorDetailByDay.set(k, byEditor);
      }
      const e = byEditor.get(c.editorId) ?? {
        edits: 0, words: 0, articlesCreated: 0, articlesEdited: 0, commonsUploads: 0,
      };
      e.edits += 1;
      e.words += c.wordsAdded;
      if (c.isCreation) e.articlesCreated += 1;
      byEditor.set(c.editorId, e);
    }
    // Articles edited (unique) per editor per day.
    // editorDay -> Set<articleId>
    const editedArticlesByEditorDay = new Map<string, Set<string>>();
    for (const c of contributions) {
      const enrolledAt = enrolledByEditor.get(c.editorId);
      if (!enrolledAt || c.editTimestamp < enrolledAt) continue;
      const k = dayKey(c.editTimestamp);
      const key = `${c.editorId}|${k}`;
      let s = editedArticlesByEditorDay.get(key);
      if (!s) {
        s = new Set();
        editedArticlesByEditorDay.set(key, s);
      }
      s.add(c.articleId);
    }
    // Add commons per editor per day.
    for (const u of commons) {
      const enrolledAt = enrolledByEditor.get(u.editorId);
      if (!enrolledAt || u.uploadedAt < enrolledAt) continue;
      const k = dayKey(u.uploadedAt);
      const byEditor = editorDetailByDay.get(k);
      const e = byEditor?.get(u.editorId);
      if (e) e.commonsUploads += 1;
    }

    let days = 0;
    for (const day of sortedDays) {
      const activity = articleDayMap.get(day);
      const views = dayViews.get(day) ?? { total: 0, active: 0 };
      const editedCount = editedArticleIdsByDay.get(day)?.size ?? 0;

      await this.prisma.metricSnapshot.upsert({
        where: {
          granularity_periodStart_programId_wikiProject_agentType: {
            granularity: "DAY",
            periodStart: new Date(`${day}T00:00:00Z`),
            programId,
            wikiProject: "",
            agentType: "ALL_AGENTS",
          },
        },
        create: {
          granularity: "DAY",
          periodStart: new Date(`${day}T00:00:00Z`),
          periodEnd: new Date(`${day}T23:59:59.999Z`),
          programId,
          wikiProject: "",
          agentType: "ALL_AGENTS",
          edits: activity?.edits ?? 0,
          wordsAdded: activity?.words ?? 0,
          articlesCreated: activity?.created ? 1 : 0,
          articlesEdited: editedCount,
          editors: activity?.editors.size ?? 0,
          refsAdded: 0,
          viewsTotal: views.total,
          viewsActive: views.active,
          commonsUploads: commonsByDay.get(day) ?? 0,
        },
        update: {
          periodEnd: new Date(`${day}T23:59:59.999Z`),
          edits: activity?.edits ?? 0,
          wordsAdded: activity?.words ?? 0,
          articlesCreated: activity?.created ? 1 : 0,
          articlesEdited: editedCount,
          editors: activity?.editors.size ?? 0,
          refsAdded: 0,
          viewsTotal: views.total,
          viewsActive: views.active,
          commonsUploads: commonsByDay.get(day) ?? 0,
          updatedAt: new Date(),
        },
      });
      days += 1;
    }

    // --- Detail tables (DAY): period_article_activity + period_editor_activity. ---
    for (const [day, byArticle] of articleDetailByDay) {
      for (const [articleId, a] of byArticle) {
        await this.prisma.periodArticleActivity.upsert({
          where: {
            granularity_periodStart_articleId: {
              granularity: "DAY",
              periodStart: new Date(`${day}T00:00:00Z`),
              articleId,
            },
          },
          create: {
            granularity: "DAY",
            periodStart: new Date(`${day}T00:00:00Z`),
            periodEnd: new Date(`${day}T23:59:59.999Z`),
            articleId,
            programId,
            wikiProject: "",
            edits: a.edits,
            wordsAdded: a.words,
            isCreated: a.created,
            viewsTotal: a.viewsTotal,
            viewsActive: a.viewsTotal,
            refsAdded: 0,
          },
          update: {
            periodEnd: new Date(`${day}T23:59:59.999Z`),
            edits: a.edits,
            wordsAdded: a.words,
            isCreated: a.created,
            viewsTotal: a.viewsTotal,
            viewsActive: a.viewsTotal,
            refsAdded: 0,
            createdAt: new Date(),
          },
        });
      }
    }
    for (const [day, byEditor] of editorDetailByDay) {
      for (const [editorId, e] of byEditor) {
        e.articlesEdited = editedArticlesByEditorDay.get(`${editorId}|${day}`)?.size ?? 0;
        await this.prisma.periodEditorActivity.upsert({
          where: {
            granularity_periodStart_editorId: {
              granularity: "DAY",
              periodStart: new Date(`${day}T00:00:00Z`),
              editorId,
            },
          },
          create: {
            granularity: "DAY",
            periodStart: new Date(`${day}T00:00:00Z`),
            periodEnd: new Date(`${day}T23:59:59.999Z`),
            editorId,
            programId,
            edits: e.edits,
            wordsAdded: e.words,
            articlesCreated: e.articlesCreated,
            articlesEdited: e.articlesEdited,
            commonsUploads: e.commonsUploads,
          },
          update: {
            periodEnd: new Date(`${day}T23:59:59.999Z`),
            edits: e.edits,
            wordsAdded: e.words,
            articlesCreated: e.articlesCreated,
            articlesEdited: e.articlesEdited,
            commonsUploads: e.commonsUploads,
            createdAt: new Date(),
          },
        });
      }
    }

    // --- MONTH rollup: sum DAY rows. ---
    const dayRows = await this.prisma.metricSnapshot.findMany({
      where: { granularity: "DAY", programId },
    });
    const monthMap = new Map<string, {
      edits: number; words: number; viewsTotal: number; viewsActive: number;
      created: number; edited: number; editors: Set<string>; commons: number;
    }>();
    // Rebuild month grouping from DAY rows.
    for (const row of dayRows) {
      const k = `${row.periodStart.getUTCFullYear()}-${String(row.periodStart.getUTCMonth() + 1).padStart(2, "0")}`;
      let m = monthMap.get(k);
      if (!m) {
        m = { edits: 0, words: 0, viewsTotal: 0, viewsActive: 0, created: 0, edited: 0, editors: new Set(), commons: 0 };
        monthMap.set(k, m);
      }
      m.edits += row.edits;
      m.words += row.wordsAdded;
      m.viewsTotal += row.viewsTotal;
      m.viewsActive += row.viewsActive;
      m.created += row.articlesCreated;
      m.edited += row.articlesEdited;
      m.commons += row.commonsUploads;
    }
    // Distinct created/edited article counts per month from detail tables.
    const createdArticlesByMonth = new Map<string, Set<string>>();
    const editedArticlesByMonth = new Map<string, Set<string>>();
    const monthKeyOf = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const articleActivityRows = await this.prisma.periodArticleActivity.findMany({
      where: { granularity: "DAY", programId },
      select: { periodStart: true, articleId: true, isCreated: true },
    });
    for (const row of articleActivityRows) {
      const k = monthKeyOf(row.periodStart);
      if (row.isCreated) {
        let s = createdArticlesByMonth.get(k);
        if (!s) { s = new Set(); createdArticlesByMonth.set(k, s); }
        s.add(row.articleId);
      }
      let e = editedArticlesByMonth.get(k);
      if (!e) { e = new Set(); editedArticlesByMonth.set(k, e); }
      e.add(row.articleId);
    }
    // Editors per month: need distinct editors per month — recompute from contributions.
    const editorsByMonth = new Map<string, Set<string>>();
    for (const c of contributions) {
      const enrolledAt = enrolledByEditor.get(c.editorId);
      if (!enrolledAt || c.editTimestamp < enrolledAt) continue;
      const k = `${c.editTimestamp.getUTCFullYear()}-${String(c.editTimestamp.getUTCMonth() + 1).padStart(2, "0")}`;
      let s = editorsByMonth.get(k);
      if (!s) {
        s = new Set();
        editorsByMonth.set(k, s);
      }
      s.add(c.editorId);
    }

    let months = 0;
    for (const [k, m] of monthMap) {
      const [y, mo] = k.split("-").map(Number);
      const periodStart = new Date(Date.UTC(y, mo - 1, 1));
      const periodEnd = new Date(Date.UTC(y, mo, 1) - 1);
      m.editors = editorsByMonth.get(k) ?? new Set<string>();
      const createdCount = createdArticlesByMonth.get(k)?.size ?? 0;
      const editedCount = editedArticlesByMonth.get(k)?.size ?? 0;
      await this.prisma.metricSnapshot.upsert({
        where: {
          granularity_periodStart_programId_wikiProject_agentType: {
            granularity: "MONTH",
            periodStart,
            programId,
            wikiProject: "",
            agentType: "ALL_AGENTS",
          },
        },
        create: {
          granularity: "MONTH",
          periodStart,
          periodEnd,
          programId,
          wikiProject: "",
          agentType: "ALL_AGENTS",
          edits: m.edits,
          wordsAdded: m.words,
          viewsTotal: m.viewsTotal,
          viewsActive: m.viewsActive,
          articlesCreated: createdCount,
          articlesEdited: editedCount,
          editors: m.editors.size,
          refsAdded: 0,
          commonsUploads: m.commons,
        },
        update: {
          periodEnd,
          edits: m.edits,
          wordsAdded: m.words,
          viewsTotal: m.viewsTotal,
          viewsActive: m.viewsActive,
          articlesCreated: createdCount,
          articlesEdited: editedCount,
          editors: m.editors.size,
          refsAdded: 0,
          commonsUploads: m.commons,
          updatedAt: new Date(),
        },
      });
      months += 1;
    }

    // --- YEAR rollup: sum MONTH rows. ---
    const monthRows = await this.prisma.metricSnapshot.findMany({
      where: { granularity: "MONTH", programId },
    });
    const yearMap = new Map<number, {
      edits: number; words: number; viewsTotal: number; viewsActive: number;
      created: number; edited: number; editors: Set<string>; commons: number;
    }>();
    for (const row of monthRows) {
      const y = row.periodStart.getUTCFullYear();
      let a = yearMap.get(y);
      if (!a) {
        a = { edits: 0, words: 0, viewsTotal: 0, viewsActive: 0, created: 0, edited: 0, editors: new Set(), commons: 0 };
        yearMap.set(y, a);
      }
      a.edits += row.edits;
      a.words += row.wordsAdded;
      a.viewsTotal += row.viewsTotal;
      a.viewsActive += row.viewsActive;
      a.created += row.articlesCreated;
      a.edited += row.articlesEdited;
      a.commons += row.commonsUploads;
    }
    // Distinct created/edited article counts per year from detail tables.
    const createdArticlesByYear = new Map<number, Set<string>>();
    const editedArticlesByYear = new Map<number, Set<string>>();
    for (const row of articleActivityRows) {
      const y = row.periodStart.getUTCFullYear();
      if (row.isCreated) {
        let s = createdArticlesByYear.get(y);
        if (!s) { s = new Set(); createdArticlesByYear.set(y, s); }
        s.add(row.articleId);
      }
      let e = editedArticlesByYear.get(y);
      if (!e) { e = new Set(); editedArticlesByYear.set(y, e); }
      e.add(row.articleId);
    }
    // Editors per year: recompute from contributions.
    const editorsByYear = new Map<number, Set<string>>();
    for (const c of contributions) {
      const enrolledAt = enrolledByEditor.get(c.editorId);
      if (!enrolledAt || c.editTimestamp < enrolledAt) continue;
      const y = c.editTimestamp.getUTCFullYear();
      let s = editorsByYear.get(y);
      if (!s) {
        s = new Set();
        editorsByYear.set(y, s);
      }
      s.add(c.editorId);
    }

    let years = 0;
    for (const [y, a] of yearMap) {
      a.editors = editorsByYear.get(y) ?? new Set<string>();
      const createdCount = createdArticlesByYear.get(y)?.size ?? 0;
      const editedCount = editedArticlesByYear.get(y)?.size ?? 0;
      const periodStart = new Date(Date.UTC(y, 0, 1));
      const periodEnd = new Date(Date.UTC(y + 1, 0, 1) - 1);
      await this.prisma.metricSnapshot.upsert({
        where: {
          granularity_periodStart_programId_wikiProject_agentType: {
            granularity: "YEAR",
            periodStart,
            programId,
            wikiProject: "",
            agentType: "ALL_AGENTS",
          },
        },
        create: {
          granularity: "YEAR",
          periodStart,
          periodEnd,
          programId,
          wikiProject: "",
          agentType: "ALL_AGENTS",
          edits: a.edits,
          wordsAdded: a.words,
          viewsTotal: a.viewsTotal,
          viewsActive: a.viewsActive,
          articlesCreated: createdCount,
          articlesEdited: editedCount,
          editors: a.editors.size,
          refsAdded: 0,
          commonsUploads: a.commons,
        },
        update: {
          periodEnd,
          edits: a.edits,
          wordsAdded: a.words,
          viewsTotal: a.viewsTotal,
          viewsActive: a.viewsActive,
          articlesCreated: createdCount,
          articlesEdited: editedCount,
          editors: a.editors.size,
          refsAdded: 0,
          commonsUploads: a.commons,
          updatedAt: new Date(),
        },
      });
      years += 1;
    }

    return { granularity: "DAY", days, months, years, rows: days + months + years };
  }
}
