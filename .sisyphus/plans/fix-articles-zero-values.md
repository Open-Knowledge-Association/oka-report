# Fix Articles Page Zero Values

## TL;DR

> **Quick Summary**: Fix the Articles page showing 0 values for pageviews, characters, and references by correcting the sync service usage and frontend field name mismatches.
>
> **Deliverables**:
>
> - Updated `/api/outreach/articles/sync` route to use the new `OutreachArticleSyncService` (with pageviews support)
> - Fixed frontend field names from snake_case to camelCase
> - Re-synced articles to populate missing pageviews data
>
> **Estimated Effort**: Quick
> **Parallel Execution**: NO - sequential (must fix code before re-sync)
> **Critical Path**: Fix Route → Fix Frontend → Re-sync

---

## Context

### Original Request

Articles page shows 0 values for:

- Pageviews
- Total Pageviews
- Characters
- References

### Investigation Summary

**Root Causes Identified**:

1. **Wrong Sync Service Used**: The `/api/outreach/articles/sync` endpoint (line 191 of `outreach.ts`) uses the OLD `OutreachSyncService.syncArticlesFromDashboard()` which does NOT save pageviews. The new optimized `OutreachArticleSyncService` (which DOES save pageviews to `OutreachArticlePageview` table) is only used by the scheduler.

2. **Frontend Field Name Mismatch**: The frontend `articles.tsx` uses snake_case field names (`article.view_count`, `article.character_sum`, `article.references_count`) but the API returns camelCase (`article.characterSum`, `article.referencesCount`). Pageviews need to be extracted from the `pageviews` array.

3. **Empty Pageviews Array**: All 46,862 articles have `pageviews: []` because they were synced with the old service.

### Evidence

```json
// API Response (camelCase):
{
  "characterSum": 89424,
  "referencesCount": 122,
  "pageviews": []  // EMPTY - not being saved!
}

// Frontend expects (snake_case):
article.view_count      // undefined
article.character_sum   // undefined
article.references_count // undefined
```

---

## Work Objectives

### Core Objective

Fix the data flow so articles display correct values for pageviews, characters, and references.

### Concrete Deliverables

- `apps/api/src/routes/outreach.ts`: Use new sync service with pageviews support
- `apps/web/src/routes/articles.tsx`: Use correct camelCase field names
- `apps/web/src/lib/api.ts`: Update type definitions to match API response
- Re-synced database with pageviews data

### Definition of Done

- [x] `curl http://localhost:3000/api/outreach/articles/stats` shows non-zero `totalPageviews`
- [x] Articles page displays non-zero values for Characters and References columns
- [x] Articles page displays non-zero values for Pageviews column after re-sync

### Must Have

- Use `OutreachArticleSyncService` for article sync endpoint
- Frontend uses camelCase field names matching API response
- Pageviews extracted from `pageviews[0].cumulativeViews` in frontend

### Must NOT Have (Guardrails)

- DO NOT change the database schema
- DO NOT modify the `OutreachArticleSyncService` logic - it's already correct
- DO NOT change the scheduler - it already uses the correct service

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (bun test exists)
- **Automated tests**: NO - manual verification via curl and browser
- **Agent-Executed QA**: YES

### Agent-Executed QA Scenarios (MANDATORY)

**Verification Tool by Deliverable Type:**
| Type | Tool |
|------|------|
| API | Bash (curl) |
| Frontend | Manual browser check OR Playwright |

---

## Execution Strategy

### Dependency Matrix

| Task | Depends On | Blocks |
| ---- | ---------- | ------ |
| 1    | None       | 2, 3   |
| 2    | None       | 3      |
| 3    | 1, 2       | None   |

### Sequential Execution

All tasks must be sequential because Task 3 (re-sync) requires Tasks 1 & 2 to be complete first.

---

## TODOs

- [x] 1. Update sync route to use OutreachArticleSyncService

  **What to do**:
  1. Import `OutreachArticleSyncService` in `apps/api/src/routes/outreach.ts`
  2. Create new instance with prisma and dashboardClient
  3. Update the `/articles/sync` POST handler to use the new service

  **Must NOT do**:
  - Do not remove the old `OutreachSyncService` - it's still used for editor sync

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 3

  **References**:
  - `apps/api/src/routes/outreach.ts:1-20` - Import section, add new import
  - `apps/api/src/routes/outreach.ts:164-271` - POST /articles/sync handler to update
  - `apps/api/src/services/outreach-article-sync.service.ts:24-31` - Constructor signature
  - `apps/api/src/jobs/scheduler.ts:5-29` - Example of how to instantiate the service

  **Code Changes**:
  1. Add import at top (after line 4):

  ```typescript
  import { OutreachArticleSyncService } from "../services/outreach-article-sync.service";
  ```

  2. Add instance after line 18:

  ```typescript
  const outreachArticleSyncService = new OutreachArticleSyncService(prisma, dashboardClient);
  ```

  3. Update handler (around line 191) - replace `outreachSyncService.syncArticlesFromDashboard` with `outreachArticleSyncService.syncArticlesFromDashboard`

  **Acceptance Criteria**:
  - [ ] New import added for `OutreachArticleSyncService`
  - [ ] New instance created: `outreachArticleSyncService`
  - [ ] POST handler uses `outreachArticleSyncService.syncArticlesFromDashboard`
  - [ ] API server starts without errors: `moon run api:dev`
  - [ ] POST /api/outreach/articles/sync returns 202 Accepted

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: API server starts successfully
    Tool: Bash
    Steps:
      1. cd /home/rio/Works/oka/report && timeout 10 bun run --cwd apps/api src/index.ts &
      2. sleep 3
      3. curl -s http://localhost:3000/api/outreach/articles/stats
    Expected Result: Returns JSON with success: true
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `fix(api): use OutreachArticleSyncService for articles sync to include pageviews`
  - Files: `apps/api/src/routes/outreach.ts`

---

- [x] 2. Fix frontend field names to match API response

  **What to do**:
  1. Update `apps/web/src/lib/api.ts` - change `OutreachArticle` type from snake_case to camelCase
  2. Update `apps/web/src/routes/articles.tsx` - use camelCase fields and extract pageviews from array

  **Must NOT do**:
  - Do not change the API response format - keep it camelCase

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 1)
  - **Blocks**: Task 3

  **References**:
  - `apps/web/src/lib/api.ts:103-115` - OutreachArticle type definition (snake_case, needs to be camelCase)
  - `apps/web/src/routes/articles.tsx:247-269` - Table rows accessing article fields
  - API response structure: `{ characterSum, referencesCount, pageviews: [{ cumulativeViews }] }`

  **Code Changes**:
  1. **`apps/web/src/lib/api.ts`** - Update type (lines 103-115):

  ```typescript
  export type OutreachArticle = {
    id: string; // Changed from number - Prisma returns string IDs
    title: string;
    language: string;
    project: string;
    url: string;
    characterSum: number; // was: character_sum
    referencesCount: number; // was: references_count
    isNewArticle: boolean; // was: new_article
    rating: string | null;
    pageviews: Array<{
      // NEW: pageviews array from API
      cumulativeViews: number;
      snapshotDate: string;
    }>;
  };
  ```

  2. **`apps/web/src/routes/articles.tsx`** - Update table cells (lines 259-267):

  ```tsx
  <TableCell className="text-right">
    {(article.pageviews?.[0]?.cumulativeViews || 0).toLocaleString()}
  </TableCell>
  <TableCell className="text-right">
    {(article.characterSum || 0).toLocaleString()}
  </TableCell>
  <TableCell className="text-right">
    {(article.referencesCount || 0).toLocaleString()}
  </TableCell>
  ```

  **Acceptance Criteria**:
  - [ ] OutreachArticle type uses camelCase field names
  - [ ] OutreachArticle type includes `pageviews` array
  - [ ] Table cells use `article.characterSum` instead of `article.character_sum`
  - [ ] Table cells use `article.referencesCount` instead of `article.references_count`
  - [ ] Pageviews cell extracts from `article.pageviews[0].cumulativeViews`
  - [ ] TypeScript compiles without errors: `bun run --cwd apps/web build` (or `tsc --noEmit`)
  - [ ] Frontend dev server starts: `moon run web:dev`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Frontend type-checks successfully
    Tool: Bash
    Steps:
      1. cd /home/rio/Works/oka/report/apps/web && bun run tsc --noEmit
    Expected Result: No TypeScript errors
    Evidence: Exit code 0

  Scenario: Characters and References display correctly
    Tool: Playwright (playwright skill) OR Manual
    Preconditions: API running, frontend running on localhost:3001
    Steps:
      1. Navigate to http://localhost:3001/articles
      2. Wait for table to load
      3. Check first row's Characters column
      4. Check first row's References column
    Expected Result: Non-zero values displayed for articles that have them
    Evidence: Screenshot .sisyphus/evidence/task-2-articles-display.png
  ```

  **Commit**: YES
  - Message: `fix(web): use camelCase field names matching API response`
  - Files: `apps/web/src/lib/api.ts`, `apps/web/src/routes/articles.tsx`

---

- [x] 3. Re-sync articles to populate pageviews

  **What to do**:
  1. Trigger a fresh sync using the fixed endpoint
  2. Verify pageviews are now populated

  **Must NOT do**:
  - Do not delete existing articles - the sync will upsert

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocked By**: Tasks 1 and 2

  **References**:
  - POST `/api/outreach/articles/sync` with body `{"school":"OKA","slug":"OKA"}`
  - GET `/api/outreach/articles/stats` to verify totalPageviews > 0

  **Steps**:

  ```bash
  # Trigger sync
  curl -X POST http://localhost:3000/api/outreach/articles/sync \
    -H "Content-Type: application/json" \
    -d '{"school":"OKA","slug":"OKA"}'

  # Wait for sync to complete (check job status or wait ~15-20 minutes)

  # Verify pageviews populated
  curl http://localhost:3000/api/outreach/articles/stats
  # Should show totalPageviews > 0
  ```

  **Acceptance Criteria**:
  - [ ] Sync job started: POST returns `{ success: true, data: { jobId: "...", status: "accepted" } }`
  - [ ] Sync completes successfully (check sync_jobs table or wait)
  - [ ] Stats endpoint shows non-zero totalPageviews: GET /api/outreach/articles/stats
  - [ ] Individual articles have pageviews: GET /api/outreach/articles/db shows `pageviews: [{ cumulativeViews: N }]`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Sync job starts successfully
    Tool: Bash (curl)
    Steps:
      1. curl -X POST http://localhost:3000/api/outreach/articles/sync \
           -H "Content-Type: application/json" \
           -d '{"school":"OKA","slug":"OKA"}'
      2. Assert: HTTP status is 202
      3. Assert: response.success is true
      4. Assert: response.data.status is "accepted"
    Expected Result: Sync job accepted
    Evidence: Response body captured

  Scenario: Pageviews populated after sync
    Tool: Bash (curl)
    Preconditions: Wait for sync to complete (15-20 min or check job status)
    Steps:
      1. curl -s http://localhost:3000/api/outreach/articles/stats
      2. Assert: response.data.totalPageviews > 0
    Expected Result: Non-zero total pageviews
    Evidence: Response body shows totalPageviews value
  ```

  **Commit**: NO (no code changes, just data sync)

---

## Commit Strategy

| After Task | Message                                                                           | Files                                                         | Verification |
| ---------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------ |
| 1          | `fix(api): use OutreachArticleSyncService for articles sync to include pageviews` | `apps/api/src/routes/outreach.ts`                             | API starts   |
| 2          | `fix(web): use camelCase field names matching API response`                       | `apps/web/src/lib/api.ts`, `apps/web/src/routes/articles.tsx` | tsc --noEmit |
| 3          | N/A                                                                               | N/A                                                           | curl stats   |

---

## Success Criteria

### Verification Commands

```bash
# After Task 1 - API compiles and runs
cd /home/rio/Works/oka/report && moon run api:dev

# After Task 2 - Frontend compiles
cd /home/rio/Works/oka/report/apps/web && bun run tsc --noEmit

# After Task 3 - Pageviews populated
curl -s http://localhost:3000/api/outreach/articles/stats | jq '.data.totalPageviews'
# Expected: > 0

# Verify individual article has pageviews
curl -s "http://localhost:3000/api/outreach/articles/db?limit=1" | jq '.data.articles[0].pageviews'
# Expected: array with cumulativeViews > 0
```

### Final Checklist

- [x] Characters column shows non-zero values (immediately after Task 2)
- [x] References column shows non-zero values (immediately after Task 2)
- [x] Pageviews column shows non-zero values (after Task 3 sync completes)
- [x] Total Pageviews card shows non-zero value (after Task 3 sync completes)
- [x] Wiki breakdown table shows non-zero pageviews per wiki (after Task 3)
