# Draft: Unified Articles Table

## Requirements (confirmed)

- Merge `articles` and `outreach_articles` tables into ONE unified `articles` table
- Single source of truth for all article data
- Maintain backward compatibility - existing data must be migrated
- Both sync services should write to the same unified table
- Stats aggregation should work on the unified data
- Frontend should display unified article data

## Current State Analysis

### Current `articles` table (from Wikipedia API)

**Source**: MediaWiki API via `sync.service.ts`
**Fields**:

- `id` (cuid)
- `pageId` (Int) - MediaWiki page ID
- `title` (String) - Article title with underscores
- `wikiProject` (String) - Format: "en.wikipedia.org"
- `createdByEditorId` (String?) - FK to editors
- `articleCreatedAt` (DateTime?)
  **Relations**:
- `contributions[]` - Contribution records
- `pageviews[]` - Daily pageview data
- `createdByEditor` - 1-to-1 with Editor

**Unique Constraint**: `@@unique([pageId, wikiProject])`

### Current `outreach_articles` table (from Outreach Dashboard)

**Source**: Outreach Dashboard API via `outreach-article-sync.service.ts`
**Fields**:

- `id` (cuid)
- `outreachId` (Int) - Outreach Dashboard article ID
- `title` (String) - Article title
- `language` (String) - e.g., "en"
- `project` (String) - e.g., "wikipedia"
- `url` (String) - Full Wikipedia URL
- `characterSum` (Int) - Total character changes
- `referencesCount` (Int) - Number of references
- `isNewArticle` (Boolean) - Whether newly created
- `rating` (String?) - Quality rating
  **Relations**:
- `pageviews[]` - OutreachArticlePageview (cumulative snapshots)
- `editors[]` - OutreachArticleEditor (many-to-many with isAuthor flag)

**Unique Constraint**: `outreachId @unique`

### Key Differences to Resolve

| Aspect           | `articles`                         | `outreach_articles`                                                |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------ |
| External ID      | `pageId` (MediaWiki)               | `outreachId` (Outreach Dashboard)                                  |
| Wiki format      | `wikiProject` ("en.wikipedia.org") | `language` + `project` ("en" + "wikipedia")                        |
| Creator relation | `createdByEditorId` (1-to-1 FK)    | `OutreachArticleEditor.isAuthor` (many-to-many)                    |
| Pageviews        | Daily snapshots                    | Cumulative snapshots                                               |
| Extra fields     | -                                  | `characterSum`, `referencesCount`, `isNewArticle`, `rating`, `url` |

## Technical Decisions

- **Source discriminator**: Need an enum field `source: MEDIAWIKI | OUTREACH_DASHBOARD`
- **External IDs**: Keep both `pageId` (nullable) and `outreachId` (nullable) for respective sources
- **Wiki project format**: Normalize to `wikiProject` format ("en.wikipedia.org"), add computed field or migrate `language.project.org`
- **Editor relations**: Keep both patterns:
  - `createdByEditorId` for MediaWiki-detected creator
  - `ArticleEditor` join table for Outreach many-to-many (with isAuthor flag)
- **Pageviews**: Merge into single `Pageview` model with optional cumulative flag or keep both patterns
- **URL field**: Add to unified table (can be computed but useful for Outreach articles)

## Research Findings

### Prisma Migration Best Practices (from librarian agent)

**Key Pattern: Expand and Contract** (recommended for production safety)

1. **Expand**: Add new unified table alongside existing tables
2. **Migrate Data**: Copy data from both old tables to new table using transactions
3. **Contract**: Update code to use new table, then drop old tables

**Critical Rules**:

- Use `prisma migrate dev --create-only` to generate draft migration, then manually edit SQL
- Replace `DROP TABLE` with `INSERT INTO ... SELECT FROM` to preserve data
- For foreign keys: DROP constraints → Migrate data → Recreate constraints
- Always use `$transaction()` for data migration to ensure atomicity
- In production: Use `prisma migrate deploy`, never `migrate dev`

**Migration Order for This Task**:

1. Create new unified `Article` table with `ArticleSource` enum
2. Add new `Pageview` table (unified) and `ArticleEditor` join table
3. Migrate data from `articles` → `Article` (source=MEDIAWIKI)
4. Migrate data from `outreach_articles` → `Article` (source=OUTREACH_DASHBOARD)
5. Update foreign keys in `contributions`, `pageviews`, etc.
6. Update sync services to write to new table
7. Update routes/frontend to read from new table
8. Drop old tables after verification

### Sync Service Analysis (from explore agent)

**sync.service.ts (MediaWiki)**:

- Upsert key: `(pageId, wikiProject)` composite unique
- Creates articles from contributions via `upsertArticle()`
- Sets `createdByEditorId` only if `articleInfo.creator === contribution.username`
- Pageviews fetched from Wikimedia API, stored daily

**outreach-article-sync.service.ts (Outreach Dashboard)**:

- Upsert key: `outreachId` unique
- Creates `outreachArticle` with: title, language, project, url, characterSum, referencesCount, isNewArticle, rating
- Pageviews stored as cumulative snapshots (not daily)
- Many-to-many editor relation via `outreachArticleEditor` join table with `isAuthor` flag
- Author detection calls WikimediaClient.getArticleInfo() for each editor

### Stats Service Analysis (from explore agent)

- `stats.service.ts` queries:
  - `contributions` (links to `article.wikiProject`)
  - `pageviews` (with filter `article.createdByEditorId: { not: null }`)
- Only pageviews for articles with `createdByEditorId` set are counted
- Per-wiki and per-editor aggregations done in-memory

### Frontend Analysis (from explore agent)

- `/articles` page calls:
  - `GET /api/outreach/articles/db` - paginated outreach articles
  - `GET /api/outreach/articles/stats` - per-wiki aggregations
  - `GET /api/outreach/course` - summary cards from Outreach Dashboard
- Expected types: `OutreachArticle` with `pageviews[0].cumulativeViews`, `editors[]`
- `/editors/$editorId` profile calls:
  - `GET /api/editors/:id/profile` - includes outreachArticles and computed stats

## Open Questions

1. **Pageviews strategy**: Keep both patterns (daily vs cumulative) or normalize?
2. **Duplicate handling**: Same article could exist in both systems - how to merge?
3. **Editor relation**: Unified table should support both 1-to-1 creator AND many-to-many contributors?
4. **Breaking change tolerance**: Frontend is currently built for OutreachArticle type - how much change is acceptable?

## Scope Boundaries

- INCLUDE: Schema migration, service updates, route updates, frontend updates
- INCLUDE: Data migration for existing records
- EXCLUDE: Historical pageview data reconciliation (complex, separate task)
- EXCLUDE: Outreach Dashboard sync configuration changes

## Files to Modify

### Database/Schema

- `packages/db/prisma/schema.prisma`

### Backend Services

- `apps/api/src/services/sync.service.ts`
- `apps/api/src/services/outreach-article-sync.service.ts`
- `apps/api/src/services/outreach-sync.service.ts`
- `apps/api/src/services/stats.service.ts`

### Backend Routes

- `apps/api/src/routes/outreach.ts`
- `apps/api/src/routes/stats.ts`
- `apps/api/src/routes/editors.ts`

### Frontend

- `apps/web/src/lib/api.ts`
- `apps/web/src/routes/articles.tsx`
- `apps/web/src/routes/editors.$editorId.tsx`
