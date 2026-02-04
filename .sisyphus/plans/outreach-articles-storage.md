# Store Outreach Dashboard Articles in Database

## TL;DR

> **Quick Summary**: Store ~47K Outreach Dashboard articles in PostgreSQL with daily pageview snapshots to enable historical trend analysis. Create new `OutreachArticle`, `OutreachArticlePageview`, and `OutreachArticleEditor` models separate from existing MediaWiki-based models.
>
> **Deliverables**:
>
> - 3 new Prisma models with migration
> - `OutreachArticleSyncService` for syncing articles and pageviews
> - API endpoints for sync trigger and database-backed article fetch
> - Frontend updated to use database-backed articles
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6

---

## Context

### Original Request

Store Outreach Dashboard articles in the database instead of fetching directly each time. Enable historical pageview tracking by storing daily snapshots of cumulative `view_count` to analyze growth trends over time.

### Interview Summary

**Key Discussions**:

- **Schema approach**: Create NEW `OutreachArticle` model (separate from existing `Article` model which requires MediaWiki `pageId`)
- **Pageview tracking**: Store daily snapshot of cumulative `view_count`, calculate delta from consecutive days
- **Editor linking**: Create join table to link articles to editors via Outreach `user_ids` and `Editor.externalId`
- **Test strategy**: TDD approach with existing infrastructure (Vitest for utils, Bun test for API)

**Research Findings**:

- Existing `OutreachSyncService` pattern uses upsert and SyncJob tracking
- `Editor.externalId` is set to `String(user.id)` during Outreach user sync - maps directly to `user_ids[]`
- Test infra: Vitest for packages/utils and apps/web, Bun test for apps/api

### Metis Review

**Identified Gaps** (addressed):

- `user_ids[]` semantics: Treat as ALL editors who contributed (not just creator)
- Editor existence: Skip linking if editor not synced yet (don't fail sync)
- Join table design: Use NEW `OutreachArticleEditor` table (not reuse `Contribution` - different semantics)

---

## Work Objectives

### Core Objective

Enable historical pageview tracking for Outreach Dashboard articles by storing them in the local PostgreSQL database with daily pageview snapshots.

### Concrete Deliverables

- `packages/db/prisma/schema.prisma` - 3 new models added
- `packages/db/prisma/migrations/` - Migration file for new tables
- `apps/api/src/services/outreach-article-sync.service.ts` - Sync service
- `apps/api/src/routes/outreach.ts` - Updated with sync endpoint
- `apps/web/src/routes/articles.tsx` - Updated to use database data
- `apps/web/src/lib/api.ts` - Updated API function

### Definition of Done

- [x] `bun test` passes in apps/api
- [x] `bun run test` passes in apps/web
- [x] Articles page displays data from database
- [x] Sync job successfully imports articles with pageviews and editor links

### Must Have

- New Prisma models separate from existing `Article` model
- Daily pageview snapshots for historical tracking
- Editor linking via `user_ids` → `Editor.externalId`
- SyncJob tracking for audit trail

### Must NOT Have (Guardrails)

- MUST NOT merge with existing `Article` model (requires `pageId` we don't have)
- MUST NOT reuse `Contribution` model for editor links (different semantics)
- MUST NOT fail sync if editor not yet synced (skip, log warning)
- MUST NOT resolve MediaWiki `pageId` (out of scope, future enhancement)
- MUST NOT over-engineer delta calculation (store cumulative, calculate delta on-demand)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: YES (TDD)
- **Framework**: Bun test (API), Vitest (utils/web)

### TDD Workflow

Each TODO follows RED-GREEN-REFACTOR:

**Task Structure:**

1. **RED**: Write failing test first
2. **GREEN**: Implement minimum code to pass
3. **REFACTOR**: Clean up while keeping green

### Agent-Executed QA Scenarios

All tasks include scenarios verified by executing agents using:

- **API**: Bash (curl) for endpoint testing
- **Database**: Bash (prisma commands) for schema verification
- **Frontend**: Playwright for UI verification

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Database schema + migration (no dependencies)

Wave 2 (After Wave 1):
├── Task 2: Sync service (depends: 1)
├── Task 3: API endpoints (depends: 1)
└── Task 4: Update Editor model relation (depends: 1)

Wave 3 (After Wave 2):
├── Task 5: API integration (depends: 2, 3)
└── Task 6: Frontend update (depends: 3, 5)

Critical Path: Task 1 → Task 2 → Task 5 → Task 6
```

### Dependency Matrix

| Task | Depends On | Blocks  | Can Parallelize With |
| ---- | ---------- | ------- | -------------------- |
| 1    | None       | 2, 3, 4 | None (first)         |
| 2    | 1          | 5       | 3, 4                 |
| 3    | 1          | 5, 6    | 2, 4                 |
| 4    | 1          | 2       | 2, 3                 |
| 5    | 2, 3       | 6       | None                 |
| 6    | 3, 5       | None    | None (final)         |

### Agent Dispatch Summary

| Wave | Tasks   | Recommended Approach                     |
| ---- | ------- | ---------------------------------------- |
| 1    | 1       | Single task - schema foundation          |
| 2    | 2, 3, 4 | Can dispatch parallel after schema ready |
| 3    | 5, 6    | Sequential - integration + frontend      |

---

## TODOs

- [x] 1. Create Database Schema and Migration

  **What to do**:
  - Add `OutreachArticle` model to schema.prisma
  - Add `OutreachArticlePageview` model to schema.prisma
  - Add `OutreachArticleEditor` model to schema.prisma
  - Add `outreachArticles` relation to existing `Editor` model
  - Run `bunx prisma migrate dev --name add_outreach_articles`
  - Verify migration applies successfully

  **Must NOT do**:
  - MUST NOT modify existing `Article`, `Pageview`, or `Contribution` models
  - MUST NOT add foreign key to non-existent tables

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single-file schema change with clear structure from Metis
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit after migration verified

  **Parallelization**:
  - **Can Run In Parallel**: NO (first task)
  - **Parallel Group**: Wave 1 (alone)
  - **Blocks**: Tasks 2, 3, 4
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing schema patterns):
  - `packages/db/prisma/schema.prisma:56-91` - Existing `Article` model pattern (field naming, relations)
  - `packages/db/prisma/schema.prisma:141-162` - Existing `Pageview` model (date storage, unique constraint)
  - `packages/db/prisma/schema.prisma:18-53` - `Editor` model (relation pattern for `outreachArticles`)

  **Schema Design** (from Metis review):

  ```prisma
  model OutreachArticle {
    id              String   @id @default(cuid())
    outreachId      Int      @unique  // Outreach Dashboard article id
    title           String
    language        String   // e.g., "en"
    project         String   // e.g., "wikipedia"
    url             String
    characterSum    Int      @default(0)
    referencesCount Int      @default(0)
    isNewArticle    Boolean  @default(false)
    rating          String?

    pageviews       OutreachArticlePageview[]
    editors         OutreachArticleEditor[]

    createdAt       DateTime @default(now())
    updatedAt       DateTime @updatedAt

    @@index([language, project])
    @@map("outreach_articles")
  }

  model OutreachArticlePageview {
    id                 String   @id @default(cuid())
    outreachArticle    OutreachArticle @relation(fields: [outreachArticleId], references: [id], onDelete: Cascade)
    outreachArticleId  String
    snapshotDate       DateTime @db.Date
    cumulativeViews    Int      // view_count from API

    createdAt          DateTime @default(now())

    @@unique([outreachArticleId, snapshotDate])
    @@index([snapshotDate])
    @@map("outreach_article_pageviews")
  }

  model OutreachArticleEditor {
    id                 String   @id @default(cuid())
    outreachArticle    OutreachArticle @relation(fields: [outreachArticleId], references: [id], onDelete: Cascade)
    outreachArticleId  String
    editor             Editor   @relation(fields: [editorId], references: [id], onDelete: Cascade)
    editorId           String

    createdAt          DateTime @default(now())

    @@unique([outreachArticleId, editorId])
    @@map("outreach_article_editors")
  }
  ```

  **WHY Each Reference Matters**:
  - `Article` model shows field naming conventions (camelCase) and how relations are defined
  - `Pageview` model shows date field pattern (`@db.Date`) and unique constraint on compound key
  - `Editor` model shows where to add the reverse relation (`outreachArticles OutreachArticleEditor[]`)

  **Acceptance Criteria**:

  **TDD (tests not applicable for schema-only task)**:
  - Schema changes are validated via migration success

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Migration creates tables successfully
    Tool: Bash
    Preconditions: Database running, DATABASE_URL set
    Steps:
      1. cd packages/db && bunx prisma migrate dev --name add_outreach_articles
      2. Assert: exit code 0
      3. bunx prisma db pull (verify schema matches)
      4. Assert: output contains "outreach_articles"
      5. Assert: output contains "outreach_article_pageviews"
      6. Assert: output contains "outreach_article_editors"
    Expected Result: 3 new tables created in database
    Evidence: Migration output captured

  Scenario: Prisma client generates without errors
    Tool: Bash
    Preconditions: Migration applied
    Steps:
      1. cd packages/db && bunx prisma generate
      2. Assert: exit code 0
      3. ls generated/prisma/index.d.ts
      4. grep -q "OutreachArticle" generated/prisma/index.d.ts
    Expected Result: Generated client includes new models
    Evidence: Command output captured
  ```

  **Evidence to Capture:**
  - [ ] Migration output in .sisyphus/evidence/task-1-migration.txt
  - [ ] Prisma generate output

  **Commit**: YES
  - Message: `feat(db): add OutreachArticle, OutreachArticlePageview, OutreachArticleEditor models`
  - Files: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*`
  - Pre-commit: `cd packages/db && bunx prisma validate`

---

- [x] 2. Create OutreachArticleSyncService

  **What to do**:
  - Write failing tests first for sync service
  - Create `OutreachArticleSyncService` class in `apps/api/src/services/`
  - Implement `syncArticles(school: string, slug: string)` method
  - Upsert articles by `outreachId`
  - Upsert daily pageview snapshot
  - Link editors via `user_ids` → `Editor.externalId` (skip if not found)
  - Track with SyncJob

  **Must NOT do**:
  - MUST NOT fail if `user_ids` contains editor not in database (skip, log warning)
  - MUST NOT call MediaWiki API for pageId resolution

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex service with multiple database operations and TDD workflow
  - **Skills**: [`git-master`]
    - `git-master`: Commit after tests pass

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References** (existing sync services):
  - `apps/api/src/services/outreach-sync.service.ts:28-125` - Complete sync pattern (SyncJob creation, upsert, error handling)
  - `apps/api/src/services/sync.service.ts:79-121` - Pageview sync pattern (date handling, upsert by date)

  **Type References** (contracts to implement against):
  - `packages/utils/src/outreach-dashboard/types.ts:194-207` - `OutreachArticle` type definition
  - `packages/utils/src/outreach-dashboard/client.ts` - `getArticles(school, slug)` method

  **Test References** (testing patterns):
  - `packages/utils/src/outreach-dashboard/client.test.ts` - Vitest mocking pattern for Outreach client

  **Sync Logic Pattern** (from Metis):

  ```typescript
  // Map user_ids to editors
  for (const userId of article.user_ids) {
    const editor = await prisma.editor.findUnique({
      where: { externalId: String(userId) },
    });

    if (editor) {
      await prisma.outreachArticleEditor.upsert({
        where: {
          outreachArticleId_editorId: {
            outreachArticleId: outreachArticle.id,
            editorId: editor.id,
          },
        },
        create: { outreachArticleId: outreachArticle.id, editorId: editor.id },
        update: {},
      });
    }
    // Skip if editor doesn't exist
  }
  ```

  **WHY Each Reference Matters**:
  - `outreach-sync.service.ts` shows exact SyncJob lifecycle (create pending → running → completed/failed)
  - `sync.service.ts` shows date formatting and pageview upsert pattern
  - `types.ts` shows exact fields available from Outreach API

  **Acceptance Criteria**:

  **TDD**:
  - [ ] Test file created: `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts`
  - [ ] Tests cover: article upsert, pageview snapshot, editor linking, skip missing editor
  - [ ] `bun test apps/api/src/services/__tests__/outreach-article-sync.service.test.ts` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Sync imports articles with pageviews
    Tool: Bash (API integration test)
    Preconditions: Database with schema, test editor exists with externalId
    Steps:
      1. bun test apps/api/src/services/__tests__/outreach-article-sync.service.test.ts
      2. Assert: All tests pass
      3. Assert: Test covers upsert article scenario
      4. Assert: Test covers pageview snapshot scenario
    Expected Result: Service correctly upserts articles and snapshots
    Evidence: Test output captured

  Scenario: Sync skips unknown editor IDs gracefully
    Tool: Bash (test assertion)
    Preconditions: Test with user_ids containing non-existent editor
    Steps:
      1. Run test that includes user_id not in Editor table
      2. Assert: No error thrown
      3. Assert: Article still created
      4. Assert: Warning logged (if logging implemented)
    Expected Result: Sync completes without failing on missing editors
    Evidence: Test output shows skip behavior
  ```

  **Evidence to Capture:**
  - [ ] Test output in .sisyphus/evidence/task-2-tests.txt

  **Commit**: YES
  - Message: `feat(api): add OutreachArticleSyncService for article and pageview sync`
  - Files: `apps/api/src/services/outreach-article-sync.service.ts`, `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts`
  - Pre-commit: `cd apps/api && bun test`

---

- [x] 3. Add API Endpoints for Article Sync and Fetch

  **What to do**:
  - Write failing tests first for new endpoints
  - Add `POST /api/outreach/articles/sync` - triggers article sync
  - Add `GET /api/outreach/articles/db` - fetches articles from database (not Outreach)
  - Include pagination for large result sets
  - Return structured response with success/error

  **Must NOT do**:
  - MUST NOT remove existing `/api/outreach/articles` endpoint (keep for backward compatibility)
  - MUST NOT expose raw Prisma errors to client

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard REST endpoint additions following existing patterns
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit for endpoint additions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4)
  - **Blocks**: Tasks 5, 6
  - **Blocked By**: Task 1

  **References**:

  **Pattern References** (existing API routes):
  - `apps/api/src/routes/outreach.ts` - Existing Outreach endpoints pattern
  - `apps/api/src/routes/editors.ts` - CRUD endpoint patterns with validation

  **Test References**:
  - `apps/api/src/__tests__/api.test.ts` - Integration test pattern using `app.request()`

  **Response Format** (from existing API):

  ```typescript
  // Success response
  { success: true, data: { articles: [...], pagination: { total, page, limit } } }

  // Error response
  { success: false, error: { code: "SYNC_FAILED", message: "..." } }
  ```

  **WHY Each Reference Matters**:
  - `outreach.ts` shows how to structure Outreach-related endpoints and use the client
  - `editors.ts` shows response formatting pattern with `{ success, data }`
  - `api.test.ts` shows how to test endpoints with `app.request()`

  **Acceptance Criteria**:

  **TDD**:
  - [ ] Test file updated: `apps/api/src/__tests__/api.test.ts`
  - [ ] Tests cover: POST /api/outreach/articles/sync returns 200, GET /api/outreach/articles/db returns articles
  - [ ] `bun test` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Sync endpoint triggers article import
    Tool: Bash (curl)
    Preconditions: API server running on localhost:3000
    Steps:
      1. curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/outreach/articles/sync \
           -H "Content-Type: application/json" \
           -d '{"school":"OKA","slug":"OKA"}'
      2. Assert: HTTP status is 200 or 202
      3. Assert: response.success is true
      4. Assert: response.data contains syncJobId or imported count
    Expected Result: Sync triggered successfully
    Evidence: Response body captured

  Scenario: DB endpoint returns stored articles
    Tool: Bash (curl)
    Preconditions: At least one article synced to database
    Steps:
      1. curl -s http://localhost:3000/api/outreach/articles/db
      2. Assert: HTTP status is 200
      3. Assert: response.success is true
      4. Assert: response.data.articles is array
      5. Assert: First article has id, title, language, project fields
    Expected Result: Articles returned from database
    Evidence: Response body captured
  ```

  **Evidence to Capture:**
  - [ ] curl responses in .sisyphus/evidence/task-3-endpoints.txt

  **Commit**: YES
  - Message: `feat(api): add /api/outreach/articles/sync and /db endpoints`
  - Files: `apps/api/src/routes/outreach.ts`, `apps/api/src/__tests__/api.test.ts`
  - Pre-commit: `cd apps/api && bun test`

---

- [x] 4. Update Editor Model with OutreachArticle Relation

  **What to do**:
  - Add `outreachArticles OutreachArticleEditor[]` relation to `Editor` model
  - This is part of schema but separated for clarity in execution
  - Verify bidirectional relation works

  **Must NOT do**:
  - MUST NOT modify other Editor fields
  - MUST NOT break existing Editor relations

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single field addition to existing model
  - **Skills**: [`git-master`]
    - `git-master`: Include in Task 1 commit if done together

  **Parallelization**:
  - **Can Run In Parallel**: YES (typically done with Task 1)
  - **Parallel Group**: Wave 1 (with Task 1 - schema changes)
  - **Blocks**: Task 2 (editor linking)
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/db/prisma/schema.prisma:45-47` - Existing Editor relations pattern

  **WHY Each Reference Matters**:
  - Shows naming convention for relation fields

  **Acceptance Criteria**:

  **TDD (schema validation)**:
  - [ ] `bunx prisma validate` → no errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Editor model has outreachArticles relation
    Tool: Bash
    Preconditions: Schema updated
    Steps:
      1. grep -A2 "outreachArticles" packages/db/prisma/schema.prisma
      2. Assert: Line contains "OutreachArticleEditor[]"
      3. bunx prisma validate
      4. Assert: exit code 0
    Expected Result: Relation defined correctly
    Evidence: grep output captured
  ```

  **Commit**: YES (group with Task 1)
  - Message: (included in Task 1 commit)
  - Files: `packages/db/prisma/schema.prisma`

---

- [x] 5. Integration Test: End-to-End Sync Flow

  **What to do**:
  - Write integration test that exercises full sync flow
  - Test: Trigger sync → Verify articles in DB → Verify pageviews → Verify editor links
  - Ensure sync handles ~47K articles without timeout

  **Must NOT do**:
  - MUST NOT call real Outreach API in tests (mock it)
  - MUST NOT leave test data in database after test

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Integration test following established patterns
  - **Skills**: [`git-master`]
    - `git-master`: Atomic commit for integration test

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 6
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `apps/api/src/__tests__/api.test.ts` - Existing integration test setup

  **Test References**:
  - `packages/utils/src/outreach-dashboard/client.test.ts` - Mock setup pattern for Outreach client

  **Acceptance Criteria**:

  **TDD**:
  - [ ] Integration test added to `apps/api/src/__tests__/api.test.ts`
  - [ ] Test mocks Outreach client, triggers sync, verifies DB state
  - [ ] `bun test` → PASS

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full sync integration test passes
    Tool: Bash
    Preconditions: Database running with migrations applied
    Steps:
      1. cd apps/api && bun test
      2. Assert: All tests pass including new integration test
      3. Assert: Integration test logs show: articles inserted, pageviews inserted, editor links created
    Expected Result: End-to-end sync works correctly
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `test(api): add integration test for OutreachArticle sync flow`
  - Files: `apps/api/src/__tests__/api.test.ts`
  - Pre-commit: `cd apps/api && bun test`

---

- [x] 6. Update Frontend to Use Database-Backed Articles

  **What to do**:
  - Update `fetchOutreachArticles` in `apps/web/src/lib/api.ts` to call `/api/outreach/articles/db`
  - Optionally add sync trigger button to articles page
  - Ensure existing UI components work with database response format

  **Must NOT do**:
  - MUST NOT break existing article display functionality
  - MUST NOT remove fallback to direct Outreach API (keep as option)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend changes with UI considerations
  - **Skills**: [`playwright`, `frontend-ui-ux`]
    - `playwright`: Browser testing for articles page
    - `frontend-ui-ux`: Ensure UI consistency

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None
  - **Blocked By**: Tasks 3, 5

  **References**:

  **Pattern References**:
  - `apps/web/src/lib/api.ts:117-122` - Existing `fetchOutreachArticles` function
  - `apps/web/src/routes/articles.tsx` - Articles page consuming the data

  **Type References**:
  - `apps/web/src/lib/api.ts:103-115` - `OutreachArticle` type definition

  **WHY Each Reference Matters**:
  - `api.ts` shows current fetch implementation to modify
  - `articles.tsx` shows how data is consumed (ensure response shape matches)

  **Acceptance Criteria**:

  **TDD**:
  - [ ] Update test in `apps/web/src/lib/api.test.ts` for new endpoint
  - [ ] `bun run test` → PASS in apps/web

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Articles page displays database-backed data
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running (API on 3000, Web on 3001), articles synced
    Steps:
      1. Navigate to: http://localhost:3001/articles
      2. Wait for: table rows visible (timeout: 30s)
      3. Assert: "Total Articles" card shows number > 0
      4. Assert: "Total Pageviews" card shows number > 0
      5. Assert: Table contains article rows with title, wiki, pageviews columns
      6. Screenshot: .sisyphus/evidence/task-6-articles-page.png
    Expected Result: Articles page loads with database data
    Evidence: .sisyphus/evidence/task-6-articles-page.png

  Scenario: Articles page handles empty database gracefully
    Tool: Playwright (playwright skill)
    Preconditions: Database has no outreach articles
    Steps:
      1. Navigate to: http://localhost:3001/articles
      2. Wait for: page load (timeout: 10s)
      3. Assert: "No articles available" message OR empty table
      4. Assert: No JavaScript errors in console
      5. Screenshot: .sisyphus/evidence/task-6-articles-empty.png
    Expected Result: Page handles empty state gracefully
    Evidence: .sisyphus/evidence/task-6-articles-empty.png
  ```

  **Evidence to Capture:**
  - [ ] Screenshots in .sisyphus/evidence/task-6-\*.png
  - [ ] Test output from vitest

  **Commit**: YES
  - Message: `feat(web): update articles page to use database-backed API`
  - Files: `apps/web/src/lib/api.ts`, `apps/web/src/lib/api.test.ts`
  - Pre-commit: `cd apps/web && bun run test`

---

## Commit Strategy

| After Task | Message                                                                                | Files                                        | Verification           |
| ---------- | -------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------- |
| 1 (+4)     | `feat(db): add OutreachArticle, OutreachArticlePageview, OutreachArticleEditor models` | schema.prisma, migrations/\*                 | `bunx prisma validate` |
| 2          | `feat(api): add OutreachArticleSyncService for article and pageview sync`              | outreach-article-sync.service.ts, \*.test.ts | `bun test`             |
| 3          | `feat(api): add /api/outreach/articles/sync and /db endpoints`                         | outreach.ts, api.test.ts                     | `bun test`             |
| 5          | `test(api): add integration test for OutreachArticle sync flow`                        | api.test.ts                                  | `bun test`             |
| 6          | `feat(web): update articles page to use database-backed API`                           | api.ts, api.test.ts                          | `bun run test`         |

---

## Success Criteria

### Verification Commands

```bash
# All tests pass
cd apps/api && bun test  # Expected: All tests pass
cd apps/web && bun run test  # Expected: All tests pass

# Migration applied
cd packages/db && bunx prisma migrate status  # Expected: All migrations applied

# Sync works
curl -X POST http://localhost:3000/api/outreach/articles/sync -H "Content-Type: application/json" -d '{"school":"OKA","slug":"OKA"}'
# Expected: {"success":true,"data":{"imported":...}}

# DB endpoint works
curl http://localhost:3000/api/outreach/articles/db
# Expected: {"success":true,"data":{"articles":[...]}}
```

### Final Checklist

- [x] All "Must Have" present: ✓ New models, ✓ Sync service, ✓ API endpoints, ✓ Editor linking
- [x] All "Must NOT Have" absent: ✓ No Article model changes, ✓ No Contribution reuse
- [x] All tests pass: `bun test` and `bun run test`
- [x] Articles page displays data from database
