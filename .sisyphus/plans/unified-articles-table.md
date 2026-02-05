# Unified Articles Table Migration

## TL;DR

> **Quick Summary**: Merge `articles` and `outreach_articles` tables into ONE unified `Article` table with source discrimination, combining both MediaWiki and Outreach Dashboard data sources with full migration in one release.
>
> **Deliverables**:
>
> - Unified Prisma schema with `Article`, `ArticleEditor`, and merged `Pageview` tables
> - Data migration script preserving all existing records
> - Updated sync services writing to unified table
> - Updated API routes with new unified endpoints
> - Updated frontend consuming unified data
>
> **Estimated Effort**: Large (15-20 tasks, ~2-3 days)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 (Schema) → Task 2 (Migration) → Tasks 3-5 (Services) → Tasks 6-8 (Routes) → Tasks 9-11 (Frontend)

---

## Context

### Original Request

Merge two separate database tables (`articles` and `outreach_articles`) into ONE unified `articles` table as a single source of truth for all Wikipedia article data in the OKA Stats Platform.

### Interview Summary

**Key Discussions**:

- **Pageviews**: Keep both patterns (daily + cumulative) with `PageviewType` enum discriminator
- **Duplicates**: Merge into single record by matching `wikiProject + title`
- **Editor relations**: Support both `createdByEditorId` (1-to-1) AND `ArticleEditor` join table (many-to-many)
- **Breaking changes**: Full migration - replace all endpoints and update frontend in one release

**Research Findings**:

- **Prisma Migration**: Use expand-and-contract pattern with `--create-only` flag for custom SQL
- **Data integrity**: Use `$transaction()` for atomic data migration
- **Foreign key order**: DROP constraints → Migrate data → Recreate constraints
- Current `articles` table uses composite unique `(pageId, wikiProject)`
- Current `outreach_articles` uses `outreachId` unique
- Wiki format differs: `wikiProject` ("en.wikipedia.org") vs `language + project` ("en" + "wikipedia")

### Technical Decisions (Confirmed)

1. **Pageviews**: Single `Pageview` table with `type` field (DAILY | CUMULATIVE)
2. **Duplicates**: Merge by matching normalized `wikiProject + title`
3. **Editor relations**: Keep both `createdByEditorId` AND `ArticleEditor` join table
4. **API strategy**: Full migration - new endpoints replace old ones

---

## Work Objectives

### Core Objective

Create a unified data model for Wikipedia articles that consolidates data from both MediaWiki API and Outreach Dashboard into a single source of truth, enabling consistent querying, reporting, and future feature development.

### Concrete Deliverables

- `packages/db/prisma/schema.prisma` - Unified schema with `ArticleSource` enum
- `packages/db/prisma/migrations/XXXXXX_unified_articles/migration.sql` - Custom migration
- `apps/api/src/services/sync.service.ts` - Updated to write to unified Article table
- `apps/api/src/services/outreach-article-sync.service.ts` - Updated to write to unified Article table
- `apps/api/src/routes/articles.ts` - New unified article endpoints
- `apps/web/src/routes/articles.tsx` - Updated to use unified API
- `apps/web/src/routes/editors.$editorId.tsx` - Updated article display

### Definition of Done

- [ ] `moon run db:migrate` succeeds with no errors
- [ ] All existing article data preserved (count matches before/after)
- [ ] `moon run api:dev` starts without errors
- [ ] `moon run web:dev` starts without errors
- [ ] Articles page loads and displays unified data
- [ ] Editor profile page shows articles correctly

### Must Have

- Source discrimination via `ArticleSource` enum (MEDIAWIKI | OUTREACH_DASHBOARD)
- Both `pageId` (nullable) and `outreachId` (nullable) external IDs preserved
- Normalized `wikiProject` format across all records
- Backward-compatible pageview queries (daily and cumulative)
- All existing data migrated without loss

### Must NOT Have (Guardrails)

- NO breaking the existing database - always use reversible migrations
- NO data loss during migration - verify counts before/after
- NO half-migrated state - use transactions for atomicity
- NO hardcoded test data in production code
- NO skipping the duplicate detection logic (critical for data integrity)
- NO leaving orphaned records in old tables after verification

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> This is NOT conditional - it applies to EVERY task, regardless of test strategy.

### Test Decision

- **Infrastructure exists**: YES (vitest in web package)
- **Automated tests**: Tests-after (add tests for critical migration logic)
- **Framework**: vitest for web, bun test for api (if needed)

### Agent-Executed QA Scenarios (MANDATORY - ALL tasks)

**Verification Tool by Deliverable Type:**

| Type                 | Tool                       | How Agent Verifies                                  |
| -------------------- | -------------------------- | --------------------------------------------------- |
| **Schema/Migration** | Bash (moon run db:migrate) | Run migration, check exit code, verify tables exist |
| **API Endpoints**    | Bash (curl)                | Send requests, parse JSON, assert fields            |
| **Frontend**         | Playwright                 | Navigate, interact, assert DOM content              |
| **Data Integrity**   | Bash (psql/prisma)         | Query counts, compare before/after                  |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Schema design and migration file

Wave 2 (After Wave 1):
├── Task 2: Data migration script (depends: 1)
└── Task 3: Utility functions for wikiProject normalization (depends: 1)

Wave 3 (After Wave 2):
├── Task 4: Update sync.service.ts (depends: 2, 3)
├── Task 5: Update outreach-article-sync.service.ts (depends: 2, 3)
└── Task 6: Update outreach-sync.service.ts (depends: 2, 3)

Wave 4 (After Wave 3):
├── Task 7: Update stats.service.ts (depends: 4, 5)
├── Task 8: Create unified articles route (depends: 4, 5)
├── Task 9: Update outreach routes (depends: 5, 6)
└── Task 10: Update editors routes (depends: 4, 5)

Wave 5 (After Wave 4):
├── Task 11: Update frontend api.ts (depends: 8, 9, 10)
├── Task 12: Update articles.tsx (depends: 11)
└── Task 13: Update editors.$editorId.tsx (depends: 11)

Wave 6 (Final):
├── Task 14: Drop old tables migration (depends: ALL above verified)
└── Task 15: End-to-end verification (depends: 14)

Critical Path: Task 1 → Task 2 → Task 4 → Task 8 → Task 11 → Task 12 → Task 15
Parallel Speedup: ~35% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks   | Can Parallelize With |
| ---- | ---------- | -------- | -------------------- |
| 1    | None       | 2, 3     | None (foundation)    |
| 2    | 1          | 4, 5, 6  | 3                    |
| 3    | 1          | 4, 5, 6  | 2                    |
| 4    | 2, 3       | 7, 8, 10 | 5, 6                 |
| 5    | 2, 3       | 7, 8, 9  | 4, 6                 |
| 6    | 2, 3       | 9        | 4, 5                 |
| 7    | 4, 5       | 15       | 8, 9, 10             |
| 8    | 4, 5       | 11       | 7, 9, 10             |
| 9    | 5, 6       | 11       | 7, 8, 10             |
| 10   | 4, 5       | 11       | 7, 8, 9              |
| 11   | 8, 9, 10   | 12, 13   | None                 |
| 12   | 11         | 15       | 13                   |
| 13   | 11         | 15       | 12                   |
| 14   | 12, 13     | 15       | None                 |
| 15   | 14         | None     | None (final)         |

### Agent Dispatch Summary

| Wave | Tasks       | Recommended Dispatch            |
| ---- | ----------- | ------------------------------- |
| 1    | 1           | Sequential - foundation task    |
| 2    | 2, 3        | Parallel after Wave 1           |
| 3    | 4, 5, 6     | Parallel after Wave 2           |
| 4    | 7, 8, 9, 10 | Parallel after Wave 3           |
| 5    | 11, 12, 13  | 11 first, then 12+13 parallel   |
| 6    | 14, 15      | Sequential - final verification |

---

## TODOs

### Wave 1: Schema Foundation

- [ ] 1. Design unified schema and create migration file

  **What to do**:
  - Add `ArticleSource` enum with values `MEDIAWIKI`, `OUTREACH_DASHBOARD`
  - Add `PageviewType` enum with values `DAILY`, `CUMULATIVE`
  - Modify `Article` model to include:
    - `source ArticleSource` field
    - `outreachId Int? @unique` (nullable, for Outreach articles)
    - `url String?` (full Wikipedia URL)
    - `characterSum Int @default(0)`
    - `referencesCount Int @default(0)`
    - `isNewArticle Boolean @default(false)`
    - `rating String?`
  - Modify `Pageview` model to include:
    - `type PageviewType` field
    - `cumulativeViews Int?` (for cumulative snapshots)
  - Create `ArticleEditor` join table (many-to-many with `isAuthor` flag)
  - Keep existing `createdByEditorId` on Article
  - Update unique constraints appropriately
  - Use `prisma migrate dev --create-only --name unified_articles`
  - Manually edit migration SQL for data preservation

  **Must NOT do**:
  - Do NOT drop existing data - use ALTER TABLE, not DROP/CREATE
  - Do NOT change existing `pageId, wikiProject` unique constraint
  - Do NOT remove `OutreachArticle` table yet (done in Task 14)

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex schema design requiring understanding of relational constraints and Prisma patterns
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commits for schema changes
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work in this task

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (solo)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `packages/db/prisma/schema.prisma:57-92` - Current Article model structure
  - `packages/db/prisma/schema.prisma:236-287` - Current OutreachArticle model to merge
  - `packages/db/prisma/schema.prisma:317-335` - OutreachArticleEditor pattern for ArticleEditor

  **API/Type References**:
  - `packages/db/prisma/schema.prisma:142-163` - Current Pageview model to extend
  - `packages/db/prisma/schema.prisma:291-313` - OutreachArticlePageview cumulative pattern

  **Documentation References**:
  - Prisma migration customization: https://www.prisma.io/docs/orm/prisma-migrate/workflows/customizing-migrations

  **WHY Each Reference Matters**:
  - Current Article model (57-92): Base schema to extend, keep existing fields
  - OutreachArticle (236-287): Fields to merge into Article
  - OutreachArticleEditor (317-335): Pattern for new ArticleEditor join table
  - Pageview models: Understand both patterns to merge

  **Acceptance Criteria**:
  - [ ] `packages/db/prisma/schema.prisma` contains updated Article model with new fields
  - [ ] `ArticleSource` enum defined with MEDIAWIKI, OUTREACH_DASHBOARD values
  - [ ] `PageviewType` enum defined with DAILY, CUMULATIVE values
  - [ ] `ArticleEditor` model created with `articleId`, `editorId`, `isAuthor` fields
  - [ ] Migration file exists at `packages/db/prisma/migrations/XXXXXX_unified_articles/`
  - [ ] `npx prisma validate` exits with code 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Schema validates successfully
    Tool: Bash
    Preconditions: Schema file updated
    Steps:
      1. cd packages/db && npx prisma validate
      2. Assert: exit code 0
      3. Assert: stdout contains "The schema is valid"
    Expected Result: Schema validation passes
    Evidence: Command output captured

  Scenario: Migration file generated
    Tool: Bash
    Preconditions: Schema updated, migration created with --create-only
    Steps:
      1. ls packages/db/prisma/migrations/ | grep unified_articles
      2. Assert: directory exists
      3. cat packages/db/prisma/migrations/*unified_articles*/migration.sql
      4. Assert: contains "ArticleSource"
      5. Assert: contains "ArticleEditor"
    Expected Result: Migration SQL contains expected changes
    Evidence: Migration file contents captured
  ```

  **Commit**: YES
  - Message: `feat(db): add unified article schema with source discrimination`
  - Files: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*`
  - Pre-commit: `npx prisma validate`

---

### Wave 2: Migration and Utilities

- [ ] 2. Create data migration script

  **What to do**:
  - Create `packages/db/scripts/migrate-unified-articles.ts`
  - Use Prisma Client in a transaction to:
    1. Query count of existing `articles` records (store for verification)
    2. Query count of existing `outreach_articles` records (store for verification)
    3. Update existing `articles` to set `source = 'MEDIAWIKI'`
    4. For each `outreach_articles` record:
       - Check if matching article exists (by normalized wikiProject + title)
       - If match: Update existing Article with Outreach fields, set source appropriately
       - If no match: Insert new Article with `source = 'OUTREACH_DASHBOARD'`
    5. Migrate `outreach_article_pageviews` to `pageviews` with `type = 'CUMULATIVE'`
    6. Migrate `outreach_article_editors` to `ArticleEditor`
    7. Verify counts match expected totals
  - Handle wikiProject normalization: `"${language}.${project}.org"`
  - Log progress and results

  **Must NOT do**:
  - Do NOT delete source records until verification complete
  - Do NOT run outside of transaction
  - Do NOT skip duplicate detection

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex data migration logic with transaction handling and duplicate detection
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit for migration script
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser automation needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/api/src/services/sync.service.ts` - Prisma transaction patterns
  - `apps/api/src/services/outreach-article-sync.service.ts` - Outreach data structure

  **API/Type References**:
  - `packages/db/generated/prisma` - Generated Prisma Client types

  **Documentation References**:
  - Prisma transactions: https://www.prisma.io/docs/orm/prisma-client/queries/transactions

  **WHY Each Reference Matters**:
  - sync.service.ts: Pattern for Prisma transactions and upserts
  - outreach-article-sync.service.ts: Structure of Outreach data to migrate

  **Acceptance Criteria**:
  - [ ] Script file exists at `packages/db/scripts/migrate-unified-articles.ts`
  - [ ] Script uses `prisma.$transaction()` for atomicity
  - [ ] Script normalizes wikiProject format consistently
  - [ ] Script logs before/after counts for verification
  - [ ] Script handles duplicates by merging (not creating duplicates)
  - [ ] `bun run packages/db/scripts/migrate-unified-articles.ts` exits with code 0 (on test DB)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Migration script runs successfully on test data
    Tool: Bash
    Preconditions: Test database with sample data, migration applied
    Steps:
      1. Create test database snapshot
      2. bun run packages/db/scripts/migrate-unified-articles.ts
      3. Assert: exit code 0
      4. Assert: stdout contains "Migration complete"
      5. Assert: stdout shows count verification passed
    Expected Result: Data migrated without errors
    Evidence: Script output captured

  Scenario: Duplicate detection works correctly
    Tool: Bash
    Preconditions: Test DB with article existing in both tables (same title/wiki)
    Steps:
      1. Query: SELECT COUNT(*) FROM articles WHERE title = 'Test_Article'
      2. Assert: count = 1 (before migration had duplicates, after = 1)
      3. Query: SELECT source FROM articles WHERE title = 'Test_Article'
      4. Assert: has merged data from both sources
    Expected Result: Duplicates merged into single record
    Evidence: Query results captured
  ```

  **Commit**: YES
  - Message: `feat(db): add data migration script for unified articles`
  - Files: `packages/db/scripts/migrate-unified-articles.ts`
  - Pre-commit: `bun check packages/db/scripts/migrate-unified-articles.ts`

---

- [ ] 3. Create wikiProject normalization utilities

  **What to do**:
  - Create `packages/utils/src/wiki-project.ts` with:
    - `normalizeWikiProject(language: string, project: string): string` - converts "en" + "wikipedia" → "en.wikipedia.org"
    - `parseWikiProject(wikiProject: string): { language: string, project: string }` - reverse
    - `extractFromUrl(url: string): { wikiProject: string, title: string }` - parse Wikipedia URL
  - Add unit tests in `packages/utils/src/wiki-project.test.ts`
  - Export from `packages/utils/src/index.ts`

  **Must NOT do**:
  - Do NOT handle edge cases that don't exist in our data (keep it simple)
  - Do NOT add external dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small utility functions with clear input/output
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Simple string manipulation, not complex logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `packages/utils/src/index.ts` - Existing utility exports pattern
  - `packages/db/prisma/schema.prisma:69-72` - wikiProject format documentation

  **API/Type References**:
  - `packages/db/prisma/schema.prisma:253-258` - language + project format in OutreachArticle

  **WHY Each Reference Matters**:
  - Existing utils: Follow established export patterns
  - Schema docs: Understand both wikiProject formats to convert between

  **Acceptance Criteria**:
  - [ ] File exists at `packages/utils/src/wiki-project.ts`
  - [ ] `normalizeWikiProject("en", "wikipedia")` returns `"en.wikipedia.org"`
  - [ ] `parseWikiProject("en.wikipedia.org")` returns `{ language: "en", project: "wikipedia" }`
  - [ ] `extractFromUrl("https://en.wikipedia.org/wiki/Test")` returns correct values
  - [ ] Tests pass: `bun test packages/utils/src/wiki-project.test.ts`
  - [ ] Exported from `packages/utils/src/index.ts`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Utility functions work correctly
    Tool: Bash
    Preconditions: Utility file created with tests
    Steps:
      1. bun test packages/utils/src/wiki-project.test.ts
      2. Assert: exit code 0
      3. Assert: all tests pass
    Expected Result: All utility tests pass
    Evidence: Test output captured

  Scenario: Export works from package
    Tool: Bash
    Preconditions: Utilities exported
    Steps:
      1. echo 'import { normalizeWikiProject } from "@oka/utils"; console.log(normalizeWikiProject("en", "wikipedia"))' > /tmp/test.ts
      2. bun run /tmp/test.ts
      3. Assert: output = "en.wikipedia.org"
    Expected Result: Import and function work
    Evidence: Output captured
  ```

  **Commit**: YES
  - Message: `feat(utils): add wikiProject normalization utilities`
  - Files: `packages/utils/src/wiki-project.ts`, `packages/utils/src/wiki-project.test.ts`, `packages/utils/src/index.ts`
  - Pre-commit: `bun test packages/utils/`

---

### Wave 3: Backend Services

- [ ] 4. Update sync.service.ts for unified Article

  **What to do**:
  - Update `upsertArticle()` to set `source: 'MEDIAWIKI'` on all inserts
  - Keep existing `createdByEditorId` logic unchanged
  - Keep existing pageview sync logic (already uses DAILY pattern)
  - Add `type: 'DAILY'` to pageview inserts
  - Update any article queries to handle new fields gracefully

  **Must NOT do**:
  - Do NOT change the upsert key logic (pageId, wikiProject)
  - Do NOT modify contribution sync logic
  - Do NOT add Outreach-specific fields handling here

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Targeted updates to existing service, clear scope
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Straightforward field additions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 5, 6)
  - **Blocks**: Tasks 7, 8, 10
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `apps/api/src/services/sync.service.ts` - Current implementation to modify

  **API/Type References**:
  - `packages/db/generated/prisma` - Updated Article type with new fields

  **WHY Each Reference Matters**:
  - sync.service.ts: The file being modified, understand current upsert patterns

  **Acceptance Criteria**:
  - [ ] `upsertArticle()` includes `source: 'MEDIAWIKI'` in create/update
  - [ ] Pageview inserts include `type: 'DAILY'`
  - [ ] TypeScript compiles without errors
  - [ ] Existing sync tests pass (if any)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Service compiles successfully
    Tool: Bash
    Preconditions: sync.service.ts updated
    Steps:
      1. cd apps/api && bun run tsc --noEmit
      2. Assert: exit code 0
    Expected Result: TypeScript compilation succeeds
    Evidence: Compiler output captured

  Scenario: Source field set correctly on sync
    Tool: Bash
    Preconditions: API running, test editor exists
    Steps:
      1. Trigger sync for test editor via API
      2. Query: SELECT source FROM articles ORDER BY "createdAt" DESC LIMIT 1
      3. Assert: source = 'MEDIAWIKI'
    Expected Result: New articles have correct source
    Evidence: Query result captured
  ```

  **Commit**: YES (groups with 5, 6)
  - Message: `feat(api): update sync service for unified article schema`
  - Files: `apps/api/src/services/sync.service.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [ ] 5. Update outreach-article-sync.service.ts for unified Article

  **What to do**:
  - Change from writing to `OutreachArticle` to writing to `Article`
  - Set `source: 'OUTREACH_DASHBOARD'` on all inserts
  - Use `normalizeWikiProject()` to convert language+project to wikiProject format
  - Keep `outreachId` for upsert key (unique constraint)
  - Write pageviews to unified `Pageview` table with `type: 'CUMULATIVE'`
  - Write editor relations to new `ArticleEditor` table (instead of OutreachArticleEditor)
  - Implement duplicate detection: check if article exists by wikiProject+title before inserting

  **Must NOT do**:
  - Do NOT remove the Outreach Dashboard API integration
  - Do NOT change the sync trigger logic
  - Do NOT skip the isAuthor detection logic

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex refactoring with duplicate detection logic
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `playwright`: No browser work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 4, 6)
  - **Blocks**: Tasks 7, 8, 9
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `apps/api/src/services/outreach-article-sync.service.ts` - Current implementation
  - `apps/api/src/services/sync.service.ts:upsertArticle()` - Pattern to follow for Article upserts

  **API/Type References**:
  - `packages/utils/src/wiki-project.ts` - normalizeWikiProject utility (from Task 3)

  **WHY Each Reference Matters**:
  - outreach-article-sync.service.ts: The file being refactored
  - sync.service.ts upsertArticle: Pattern for writing to Article table
  - wiki-project.ts: Utility for format conversion

  **Acceptance Criteria**:
  - [ ] Service writes to `Article` table instead of `OutreachArticle`
  - [ ] All inserts include `source: 'OUTREACH_DASHBOARD'`
  - [ ] wikiProject normalized using utility function
  - [ ] Pageviews written to `Pageview` with `type: 'CUMULATIVE'`
  - [ ] Editor relations written to `ArticleEditor` table
  - [ ] Duplicate detection checks wikiProject+title before insert
  - [ ] TypeScript compiles without errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Outreach sync writes to unified Article table
    Tool: Bash
    Preconditions: API running, Outreach sync triggered
    Steps:
      1. Trigger outreach sync via API
      2. Query: SELECT source, "outreachId" FROM articles WHERE "outreachId" IS NOT NULL LIMIT 1
      3. Assert: source = 'OUTREACH_DASHBOARD'
      4. Assert: outreachId is not null
    Expected Result: Outreach articles in unified table
    Evidence: Query results captured

  Scenario: WikiProject normalized correctly
    Tool: Bash
    Preconditions: Outreach article synced (was language='en', project='wikipedia')
    Steps:
      1. Query: SELECT "wikiProject" FROM articles WHERE "outreachId" IS NOT NULL LIMIT 1
      2. Assert: wikiProject = 'en.wikipedia.org'
    Expected Result: Format normalized
    Evidence: Query result captured
  ```

  **Commit**: YES (groups with 4, 6)
  - Message: `feat(api): update outreach article sync for unified schema`
  - Files: `apps/api/src/services/outreach-article-sync.service.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [ ] 6. Update outreach-sync.service.ts for unified flow

  **What to do**:
  - Update any references to `OutreachArticle` model to use `Article`
  - Update queries to filter by `source: 'OUTREACH_DASHBOARD'` where needed
  - Ensure orchestration of outreach-article-sync still works

  **Must NOT do**:
  - Do NOT change the Outreach Dashboard API client
  - Do NOT modify sync job tracking

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Minor updates to orchestration service
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Simple reference updates

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 4, 5)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `apps/api/src/services/outreach-sync.service.ts` - Current implementation

  **WHY Each Reference Matters**:
  - outreach-sync.service.ts: The file being updated

  **Acceptance Criteria**:
  - [ ] No references to `OutreachArticle` model remain
  - [ ] Queries filter by source where appropriate
  - [ ] TypeScript compiles without errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: No OutreachArticle references remain
    Tool: Bash
    Preconditions: Service updated
    Steps:
      1. grep -n "OutreachArticle" apps/api/src/services/outreach-sync.service.ts
      2. Assert: exit code 1 (no matches)
    Expected Result: All references updated
    Evidence: Grep output captured
  ```

  **Commit**: YES (groups with 4, 5)
  - Message: `feat(api): update outreach sync orchestration for unified schema`
  - Files: `apps/api/src/services/outreach-sync.service.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

### Wave 4: Routes and Stats

- [ ] 7. Update stats.service.ts for unified queries

  **What to do**:
  - Update pageview aggregations to handle both DAILY and CUMULATIVE types
  - For DAILY: Sum views as before
  - For CUMULATIVE: Use latest snapshot value
  - Update article counts to query unified Article table
  - Add source filtering option if needed for reports

  **Must NOT do**:
  - Do NOT break existing stats endpoints
  - Do NOT mix DAILY and CUMULATIVE in same aggregation without clear handling

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Complex aggregation logic with two pageview patterns
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `playwright`: No UI work

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 8, 9, 10)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Pattern References**:
  - `apps/api/src/services/stats.service.ts` - Current implementation
  - `packages/db/prisma/schema.prisma:142-163` - Pageview model with type field

  **WHY Each Reference Matters**:
  - stats.service.ts: File being modified, understand aggregation patterns
  - Pageview schema: Understand type field for conditional aggregation

  **Acceptance Criteria**:
  - [ ] Pageview aggregation handles both DAILY and CUMULATIVE types
  - [ ] Article counts query unified table correctly
  - [ ] TypeScript compiles without errors
  - [ ] Stats endpoints return valid data

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Stats endpoint returns valid data
    Tool: Bash (curl)
    Preconditions: API running with migrated data
    Steps:
      1. curl -s http://localhost:3001/api/stats/overall
      2. Assert: HTTP 200
      3. Assert: JSON response has expected fields
      4. Assert: pageviews count > 0 (if data exists)
    Expected Result: Stats aggregation works
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `feat(api): update stats service for unified article queries`
  - Files: `apps/api/src/services/stats.service.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [ ] 8. Create unified articles route

  **What to do**:
  - Create `apps/api/src/routes/articles.ts` with:
    - `GET /api/articles` - List articles with pagination, filtering by source
    - `GET /api/articles/:id` - Get single article with relations
    - `GET /api/articles/stats` - Article statistics aggregation
  - Support query params: `source`, `wikiProject`, `page`, `limit`
  - Include pageviews and editor relations in responses

  **Must NOT do**:
  - Do NOT expose internal IDs in URLs (use article id, not pageId/outreachId)
  - Do NOT create mutation endpoints (sync handles writes)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard CRUD route patterns
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Standard route patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 7, 9, 10)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Pattern References**:
  - `apps/api/src/routes/outreach.ts` - Existing route patterns
  - `apps/api/src/routes/editors.ts` - Pagination and query patterns

  **API/Type References**:
  - `packages/db/generated/prisma` - Article type with relations

  **WHY Each Reference Matters**:
  - outreach.ts: Pattern for article endpoints to replace
  - editors.ts: Pagination pattern to follow

  **Acceptance Criteria**:
  - [ ] Route file exists at `apps/api/src/routes/articles.ts`
  - [ ] `GET /api/articles` returns paginated list
  - [ ] `GET /api/articles/:id` returns single article with relations
  - [ ] Source filtering works via query param
  - [ ] Route registered in `apps/api/src/routes/index.ts`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: List articles endpoint works
    Tool: Bash (curl)
    Preconditions: API running with data
    Steps:
      1. curl -s "http://localhost:3001/api/articles?limit=10"
      2. Assert: HTTP 200
      3. Assert: JSON has "data" array
      4. Assert: JSON has "total" count
    Expected Result: Paginated response
    Evidence: Response body captured

  Scenario: Source filtering works
    Tool: Bash (curl)
    Preconditions: API running with both source types
    Steps:
      1. curl -s "http://localhost:3001/api/articles?source=OUTREACH_DASHBOARD"
      2. Assert: HTTP 200
      3. Assert: all items have source = "OUTREACH_DASHBOARD"
    Expected Result: Filtered by source
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `feat(api): add unified articles route`
  - Files: `apps/api/src/routes/articles.ts`, `apps/api/src/routes/index.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [ ] 9. Update outreach routes to use unified model

  **What to do**:
  - Update `apps/api/src/routes/outreach.ts` to query unified Article table
  - Filter by `source: 'OUTREACH_DASHBOARD'` for backward compatibility
  - Update response shapes to match frontend expectations (or document changes)
  - Deprecate or redirect old endpoints to new `/api/articles` endpoints

  **Must NOT do**:
  - Do NOT remove endpoints that frontend currently uses without updating frontend
  - Do NOT change response shapes without coordinating with Task 11

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Update existing routes with new query patterns
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Straightforward query updates

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 7, 8, 10)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 5, 6

  **References**:

  **Pattern References**:
  - `apps/api/src/routes/outreach.ts` - Current implementation to modify

  **WHY Each Reference Matters**:
  - outreach.ts: The file being updated

  **Acceptance Criteria**:
  - [ ] Routes query unified Article table
  - [ ] Filter by source='OUTREACH_DASHBOARD' applied
  - [ ] Response shapes compatible with frontend (or documented changes)
  - [ ] TypeScript compiles without errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Outreach articles endpoint still works
    Tool: Bash (curl)
    Preconditions: API running with migrated data
    Steps:
      1. curl -s "http://localhost:3001/api/outreach/articles/db"
      2. Assert: HTTP 200
      3. Assert: JSON response has articles array
    Expected Result: Backward compatible
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `refactor(api): update outreach routes for unified article model`
  - Files: `apps/api/src/routes/outreach.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [ ] 10. Update editors routes for unified article relations

  **What to do**:
  - Update `apps/api/src/routes/editors.ts` to include articles from unified table
  - Use `ArticleEditor` relation for many-to-many queries
  - Keep `createdArticles` relation for 1-to-1 creator queries
  - Update editor profile endpoint to return unified article data

  **Must NOT do**:
  - Do NOT break editor list/create/delete endpoints
  - Do NOT change editor data model

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Update relation queries in existing routes
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Straightforward relation updates

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 7, 8, 9)
  - **Blocks**: Task 11
  - **Blocked By**: Tasks 4, 5

  **References**:

  **Pattern References**:
  - `apps/api/src/routes/editors.ts` - Current implementation to modify

  **WHY Each Reference Matters**:
  - editors.ts: The file being updated, understand current relation queries

  **Acceptance Criteria**:
  - [ ] Editor profile includes articles from unified table
  - [ ] Both `createdArticles` and `ArticleEditor` relations queried
  - [ ] TypeScript compiles without errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Editor profile returns articles
    Tool: Bash (curl)
    Preconditions: API running, editor with articles exists
    Steps:
      1. curl -s "http://localhost:3001/api/editors/{id}/profile"
      2. Assert: HTTP 200
      3. Assert: response has articles array
    Expected Result: Profile includes unified articles
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `refactor(api): update editors routes for unified article relations`
  - Files: `apps/api/src/routes/editors.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

### Wave 5: Frontend

- [ ] 11. Update frontend API client types

  **What to do**:
  - Update `apps/web/src/lib/api.ts` with:
    - New `Article` type matching unified schema
    - New `ArticleSource` enum type
    - Updated API functions for new endpoints
    - Remove/deprecate `OutreachArticle` type references
  - Update any shared types in the monorepo if applicable

  **Must NOT do**:
  - Do NOT remove types that are still used until pages updated
  - Do NOT change API base URL

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type updates following API changes
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No visual changes, just types

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (sequential before 12, 13)
  - **Blocks**: Tasks 12, 13
  - **Blocked By**: Tasks 8, 9, 10

  **References**:

  **Pattern References**:
  - `apps/web/src/lib/api.ts` - Current implementation to modify

  **API/Type References**:
  - API response shapes from Tasks 8, 9, 10

  **WHY Each Reference Matters**:
  - api.ts: The file being updated, source of truth for frontend types

  **Acceptance Criteria**:
  - [ ] `Article` type defined matching unified schema
  - [ ] `ArticleSource` enum defined
  - [ ] API functions updated for new endpoints
  - [ ] TypeScript compiles without errors: `moon run web:typecheck`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Frontend types compile
    Tool: Bash
    Preconditions: api.ts updated
    Steps:
      1. cd apps/web && bun run tsc --noEmit
      2. Assert: exit code 0
    Expected Result: No type errors
    Evidence: Compiler output captured
  ```

  **Commit**: YES
  - Message: `refactor(web): update API client for unified article types`
  - Files: `apps/web/src/lib/api.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [ ] 12. Update articles.tsx page

  **What to do**:
  - Update `apps/web/src/routes/articles.tsx` to use new unified API
  - Update table columns for unified Article fields
  - Add source indicator (badge showing MEDIAWIKI or OUTREACH)
  - Update pageview display to handle both DAILY and CUMULATIVE
  - Keep existing pagination and filtering UI

  **Must NOT do**:
  - Do NOT redesign the page layout (keep existing UX)
  - Do NOT add new features beyond schema changes
  - Do NOT remove existing functionality

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component updates with data binding changes
  - **Skills**: [`frontend-ui-ux`, `git-master`]
    - `frontend-ui-ux`: Component structure and data binding
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `playwright`: Will use for verification, not implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 13, after Task 11)
  - **Blocks**: Task 15
  - **Blocked By**: Task 11

  **References**:

  **Pattern References**:
  - `apps/web/src/routes/articles.tsx` - Current implementation to modify
  - `apps/web/src/lib/api.ts` - Updated types from Task 11

  **WHY Each Reference Matters**:
  - articles.tsx: The page being updated
  - api.ts: New types to use

  **Acceptance Criteria**:
  - [ ] Page uses new unified Article API
  - [ ] Table shows source indicator for each article
  - [ ] Pageviews displayed correctly for both types
  - [ ] No TypeScript errors
  - [ ] Page loads without runtime errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Articles page loads with unified data
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running with migrated data
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table rows visible (timeout: 10s)
      3. Assert: table contains article rows
      4. Assert: source badge visible (contains "MediaWiki" or "Outreach")
      5. Screenshot: .sisyphus/evidence/task-12-articles-page.png
    Expected Result: Page loads with unified data and source indicators
    Evidence: .sisyphus/evidence/task-12-articles-page.png

  Scenario: No console errors on page load
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Check console for errors
      3. Assert: no error-level console messages
    Expected Result: Clean page load
    Evidence: Console log captured
  ```

  **Commit**: YES (groups with 13)
  - Message: `refactor(web): update articles page for unified data model`
  - Files: `apps/web/src/routes/articles.tsx`
  - Pre-commit: `bun run tsc --noEmit`

---

- [ ] 13. Update editors.$editorId.tsx page

  **What to do**:
  - Update `apps/web/src/routes/editors.$editorId.tsx` to use unified Article data
  - Update article list display for editor profile
  - Handle both creator (1-to-1) and contributor (many-to-many) relations
  - Update any pageview displays

  **Must NOT do**:
  - Do NOT change editor profile layout significantly
  - Do NOT add new features beyond schema changes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component updates with relation changes
  - **Skills**: [`frontend-ui-ux`, `git-master`]
    - `frontend-ui-ux`: Component updates
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `playwright`: Will use for verification

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 12, after Task 11)
  - **Blocks**: Task 15
  - **Blocked By**: Task 11

  **References**:

  **Pattern References**:
  - `apps/web/src/routes/editors.$editorId.tsx` - Current implementation
  - `apps/web/src/lib/api.ts` - Updated types from Task 11

  **WHY Each Reference Matters**:
  - editors.$editorId.tsx: The page being updated
  - api.ts: New types to use

  **Acceptance Criteria**:
  - [ ] Profile page uses unified Article data
  - [ ] Shows both created and contributed articles
  - [ ] No TypeScript errors
  - [ ] Page loads without runtime errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Editor profile loads with articles
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, editor with articles exists
    Steps:
      1. Navigate to: http://localhost:3000/editors/{editorId}
      2. Wait for: profile content visible (timeout: 10s)
      3. Assert: articles section visible
      4. Assert: article cards/rows present
      5. Screenshot: .sisyphus/evidence/task-13-editor-profile.png
    Expected Result: Profile shows unified article data
    Evidence: .sisyphus/evidence/task-13-editor-profile.png
  ```

  **Commit**: YES (groups with 12)
  - Message: `refactor(web): update editor profile for unified article model`
  - Files: `apps/web/src/routes/editors.$editorId.tsx`
  - Pre-commit: `bun run tsc --noEmit`

---

### Wave 6: Cleanup and Verification

- [ ] 14. Create migration to drop old tables

  **What to do**:
  - Create new migration with `prisma migrate dev --create-only --name drop_legacy_tables`
  - Drop `outreach_articles`, `outreach_article_pageviews`, `outreach_article_editors` tables
  - Remove old models from `schema.prisma`
  - Update Editor model to remove `outreachArticles` relation

  **Must NOT do**:
  - Do NOT run this until ALL other tasks verified working
  - Do NOT drop tables if data migration verification failed

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple schema cleanup
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: Simple DROP statements

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 6 (sequential)
  - **Blocks**: Task 15
  - **Blocked By**: Tasks 12, 13

  **References**:

  **Pattern References**:
  - `packages/db/prisma/schema.prisma:236-335` - Models to remove

  **WHY Each Reference Matters**:
  - Schema lines 236-335: The OutreachArticle and related models to drop

  **Acceptance Criteria**:
  - [ ] Migration file created to drop legacy tables
  - [ ] Schema no longer contains `OutreachArticle`, `OutreachArticlePageview`, `OutreachArticleEditor`
  - [ ] Editor model `outreachArticles` relation removed
  - [ ] `npx prisma validate` passes
  - [ ] Migration applies successfully

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Legacy tables dropped successfully
    Tool: Bash
    Preconditions: All previous tasks verified, migration created
    Steps:
      1. npx prisma migrate deploy (on test DB)
      2. Assert: exit code 0
      3. Query: SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'outreach%'
      4. Assert: no results (tables dropped)
    Expected Result: Legacy tables removed
    Evidence: Query results captured

  Scenario: Schema validates after cleanup
    Tool: Bash
    Preconditions: Models removed from schema
    Steps:
      1. cd packages/db && npx prisma validate
      2. Assert: exit code 0
      3. grep -c "OutreachArticle" packages/db/prisma/schema.prisma
      4. Assert: count = 0
    Expected Result: Clean schema
    Evidence: Validation output captured
  ```

  **Commit**: YES
  - Message: `chore(db): drop legacy outreach article tables`
  - Files: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*`
  - Pre-commit: `npx prisma validate`

---

- [ ] 15. End-to-end verification

  **What to do**:
  - Run full E2E verification of the unified system:
    1. Verify data counts match pre-migration counts
    2. Test sync workflows (both MediaWiki and Outreach)
    3. Test all updated API endpoints
    4. Test all updated frontend pages
    5. Verify stats calculations
  - Document any discrepancies

  **Must NOT do**:
  - Do NOT skip any verification step
  - Do NOT mark complete if any test fails

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: Comprehensive verification across all components
  - **Skills**: [`playwright`, `git-master`]
    - `playwright`: Frontend E2E testing
    - `git-master`: Final commit
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Verification only, no UI changes

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 6 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: Task 14

  **References**:

  **Pattern References**:
  - All files modified in previous tasks

  **WHY Each Reference Matters**:
  - Comprehensive verification requires checking all modified components

  **Acceptance Criteria**:
  - [ ] Article count matches: pre-migration articles + outreach_articles (minus duplicates)
  - [ ] Sync API triggers successfully for both sources
  - [ ] All API endpoints return valid responses
  - [ ] Articles page loads with all data
  - [ ] Editor profiles load with article data
  - [ ] Stats aggregations return valid numbers
  - [ ] No console errors in browser
  - [ ] No uncaught exceptions in API logs

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full system health check
    Tool: Bash + Playwright
    Preconditions: All migrations applied, servers running
    Steps:
      1. curl http://localhost:3001/api/articles → Assert: 200
      2. curl http://localhost:3001/api/stats/overall → Assert: 200
      3. curl http://localhost:3001/api/editors → Assert: 200
      4. Playwright: Navigate to /articles → Assert: loads
      5. Playwright: Navigate to /editors → Assert: loads
      6. Playwright: Navigate to /editors/{id} → Assert: loads
    Expected Result: All endpoints and pages functional
    Evidence: Response codes and screenshots captured

  Scenario: Data integrity verification
    Tool: Bash
    Preconditions: Migration complete
    Steps:
      1. Query: SELECT source, COUNT(*) FROM articles GROUP BY source
      2. Assert: MEDIAWIKI count matches original articles count
      3. Assert: OUTREACH_DASHBOARD count ≤ original outreach_articles count (duplicates merged)
      4. Query: SELECT type, COUNT(*) FROM pageviews GROUP BY type
      5. Assert: both DAILY and CUMULATIVE types present
    Expected Result: Data migrated correctly
    Evidence: Query results captured
  ```

  **Commit**: YES
  - Message: `docs: verify unified articles migration complete`
  - Files: Any verification scripts or documentation created
  - Pre-commit: N/A

---

## Commit Strategy

| After Task | Message                                                           | Files                                   | Verification          |
| ---------- | ----------------------------------------------------------------- | --------------------------------------- | --------------------- |
| 1          | `feat(db): add unified article schema with source discrimination` | schema.prisma, migrations/\*            | `npx prisma validate` |
| 2          | `feat(db): add data migration script for unified articles`        | scripts/migrate-unified-articles.ts     | `bun check`           |
| 3          | `feat(utils): add wikiProject normalization utilities`            | wiki-project.ts, wiki-project.test.ts   | `bun test`            |
| 4-6        | `feat(api): update services for unified article schema`           | sync.service.ts, outreach-\*.service.ts | `bun tsc --noEmit`    |
| 7          | `feat(api): update stats service for unified article queries`     | stats.service.ts                        | `bun tsc --noEmit`    |
| 8          | `feat(api): add unified articles route`                           | articles.ts, routes/index.ts            | `bun tsc --noEmit`    |
| 9-10       | `refactor(api): update routes for unified article model`          | outreach.ts, editors.ts                 | `bun tsc --noEmit`    |
| 11         | `refactor(web): update API client for unified article types`      | api.ts                                  | `bun tsc --noEmit`    |
| 12-13      | `refactor(web): update pages for unified article model`           | articles.tsx, editors.$editorId.tsx     | `bun tsc --noEmit`    |
| 14         | `chore(db): drop legacy outreach article tables`                  | schema.prisma, migrations/\*            | `npx prisma validate` |
| 15         | `docs: verify unified articles migration complete`                | verification docs                       | E2E tests pass        |

---

## Success Criteria

### Verification Commands

```bash
# Schema validation
cd packages/db && npx prisma validate  # Expected: valid

# TypeScript compilation
moon run :typecheck  # Expected: no errors

# API health
curl http://localhost:3001/api/articles  # Expected: 200 with JSON

# Frontend health
curl http://localhost:3000/articles  # Expected: 200 with HTML

# Data integrity
psql -c "SELECT source, COUNT(*) FROM articles GROUP BY source"
# Expected: Both MEDIAWIKI and OUTREACH_DASHBOARD rows
```

### Final Checklist

- [ ] All "Must Have" requirements present
- [ ] All "Must NOT Have" guardrails respected
- [ ] All 15 tasks completed with green acceptance criteria
- [ ] No TypeScript errors in any package
- [ ] No runtime errors in API or frontend
- [ ] Data counts verified (no data loss)
- [ ] Old tables dropped (schema clean)
