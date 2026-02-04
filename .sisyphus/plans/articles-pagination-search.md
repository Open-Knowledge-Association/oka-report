# Articles Page: Pagination, Search & Global Stats

## TL;DR

> **Quick Summary**: Add server-side pagination and search to the articles page while ensuring aggregation stats (Total Articles, Total Pageviews, Wiki Projects) always show global totals for all 12,924+ articles, not just the current page.
>
> **Deliverables**:
>
> - New `/api/outreach/articles/stats` endpoint for global aggregation stats
> - Search parameter support in `/api/outreach/articles/db` endpoint
> - Pagination component for navigating article pages
> - Search input with debounce for filtering articles by title
> - URL state management for shareable links
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves (backend parallel, then frontend)
> **Critical Path**: Task 1/2 (API changes) → Task 3 (Client) → Task 4 (Pagination component) → Task 5 (Wire up page)

---

## Context

### Original Request

User reported the articles page showing only 50 articles instead of the full 12,924 articles. The API uses pagination (default limit: 50), but the frontend:

1. Doesn't expose pagination controls
2. Shows "Total Articles: 50" instead of the actual total (12,924)
3. Has no search functionality

User wants pagination + search while keeping aggregation stats accurate.

### Interview Summary

**Key Discussions**:

- User wants pagination AND search, not just one or the other
- Aggregation stats must show GLOBAL totals, not filtered/page totals
- Similar behavior to Outreach Dashboard (https://outreachdashboard.wmflabs.org/courses/OKA/OKA/)

**Research Findings**:

- API already supports `page` and `limit` params (apps/api/src/routes/outreach.ts:253-310)
- Search pattern exists in editors route: Prisma `contains` with `mode: "insensitive"`
- Frontend `fetchOutreachArticles` discards pagination metadata, only returns `data.articles`
- No pagination component exists - must be created
- shadcn/ui Input component available for search field

### Metis Review

**Identified Gaps** (addressed):

- Stats must be fetched separately from paginated articles (creating new stats endpoint)
- Wiki filter should move to server-side to work with pagination
- URL state needed for shareable links
- Special characters in search need escaping
- Edge cases: empty results, out-of-range pages

---

## Work Objectives

### Core Objective

Enable users to browse all 12,924+ articles with pagination and search while always displaying accurate global statistics.

### Concrete Deliverables

- `GET /api/outreach/articles/stats` - Returns global aggregation stats
- `GET /api/outreach/articles/db?search=X&wiki=Y` - Search and wiki filter support
- `apps/web/src/components/ui/pagination.tsx` - Reusable pagination component
- Updated `apps/web/src/routes/articles.tsx` - Pagination, search, URL state
- Updated `apps/web/src/lib/api.ts` - New API functions

### Definition of Done

- [x] Articles page shows pagination controls (Prev/Next, page numbers)
- [x] Search input filters articles by title (server-side)
- [x] Summary cards show global totals (12,924 articles) regardless of current page
- [x] "Pageviews by Wiki" table shows global data
- [x] URL reflects current state (shareable links)
- [x] All tests pass

### Must Have

- Server-side pagination with page/limit controls
- Server-side search (title, case-insensitive)
- Global stats always visible (Total Articles, Pageviews, Wiki Projects)
- URL state management (`/articles?page=2&search=climate`)
- Loading states during data fetch

### Must NOT Have (Guardrails)

- ❌ Infinite scroll (not requested)
- ❌ Column sorting (not requested)
- ❌ Full-text/fuzzy search (premature optimization)
- ❌ Advanced filters (date range, editor filter)
- ❌ Virtualized table (50 rows doesn't need it)
- ❌ Change visual design of summary cards
- ❌ Client-side search (must be server-side)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision

- **Infrastructure exists**: YES (bun test in apps/api, vitest in apps/web)
- **Automated tests**: Tests-after (add tests for new functionality)
- **Framework**: bun test (API), vitest (frontend components)

### Agent-Executed QA Scenarios (MANDATORY)

All verifications use Playwright for UI and curl for API.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Stats API endpoint (backend)
└── Task 2: Search param for articles endpoint (backend)

Wave 2 (After Wave 1):
├── Task 3: Frontend API client changes
└── Task 4: Pagination component

Wave 3 (After Wave 2):
└── Task 5: Wire up articles page (depends: 3, 4)

Wave 4 (After Wave 3):
└── Task 6: E2E tests
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 3, 5   | 2, 4                 |
| 2    | None       | 3, 5   | 1, 4                 |
| 3    | 1, 2       | 5      | 4                    |
| 4    | None       | 5      | 1, 2, 3              |
| 5    | 3, 4       | 6      | None                 |
| 6    | 5          | None   | None                 |

---

## TODOs

### Task 1: Create Stats API Endpoint

- [x] 1. Create `/api/outreach/articles/stats` endpoint

  **What to do**:
  - Add new route handler in `apps/api/src/routes/outreach.ts`
  - Query database for global aggregations:
    - Total article count
    - Total pageviews (sum of latest snapshot per article)
    - Unique wiki count
    - Wiki breakdown (wiki, article count, pageviews)
  - Use Prisma aggregations for performance

  **Must NOT do**:
  - Don't accept any filter parameters (this is always global stats)
  - Don't include pagination metadata
  - Don't duplicate the existing articles endpoint logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single endpoint addition, clear pattern to follow
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3, Task 5
  - **Blocked By**: None

  **References**:
  - `apps/api/src/routes/outreach.ts:253-310` - Existing articles endpoint pattern
  - `apps/api/src/routes/editors.ts:1-30` - Route handler pattern
  - `packages/db/prisma/schema.prisma:OutreachArticle` - Model with pageviews relation

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Stats endpoint returns global totals
    Tool: Bash (curl)
    Preconditions: API server running on localhost:3000, database has articles
    Steps:
      1. curl -s http://localhost:3000/api/outreach/articles/stats
      2. Parse JSON response with jq
      3. Assert: response.success === true
      4. Assert: response.data.totalArticles > 10000
      5. Assert: response.data.uniqueWikis > 0
      6. Assert: response.data.wikiStats is array with length > 0
    Expected Result: Returns aggregated stats for all articles
    Evidence: Response body saved to .sisyphus/evidence/task-1-stats-response.json

  Scenario: Stats endpoint returns correct structure
    Tool: Bash (curl)
    Steps:
      1. curl -s http://localhost:3000/api/outreach/articles/stats | jq '.data | keys'
      2. Assert: Contains "totalArticles", "totalPageviews", "uniqueWikis", "wikiStats"
    Expected Result: All required fields present
    Evidence: Response keys captured
  ```

  **Commit**: YES
  - Message: `feat(api): add /api/outreach/articles/stats endpoint for global aggregations`
  - Files: `apps/api/src/routes/outreach.ts`
  - Pre-commit: `cd apps/api && bun test`

---

### Task 2: Add Search Parameter to Articles Endpoint

- [x] 2. Add search and wiki filter support to `/api/outreach/articles/db`

  **What to do**:
  - Add `search` query parameter for title search (case-insensitive)
  - Add `wiki` query parameter for filtering by wiki (format: `en.wikipedia`)
  - Create Zod schema for query validation
  - Build dynamic Prisma `where` clause
  - Ensure `pagination.total` reflects filtered count

  **Must NOT do**:
  - Don't change response structure
  - Don't add sorting parameters
  - Don't search in fields other than title

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding params to existing endpoint, pattern exists in editors route
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 3, Task 5
  - **Blocked By**: None

  **References**:
  - `apps/api/src/routes/editors.ts:17-25` - Search pattern with Prisma contains
  - `apps/api/src/schemas/editor.schema.ts` - EditorQuerySchema for validation pattern
  - `apps/api/src/routes/outreach.ts:253-310` - Current articles endpoint

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Search filters articles by title (case-insensitive)
    Tool: Bash (curl)
    Preconditions: API running, database has articles with various titles
    Steps:
      1. curl -s "http://localhost:3000/api/outreach/articles/db?search=wikipedia&limit=10"
      2. Parse response with jq
      3. Assert: All returned article titles contain "wikipedia" (case-insensitive)
      4. curl -s "http://localhost:3000/api/outreach/articles/db?search=WIKIPEDIA&limit=10"
      5. Assert: Returns same results as lowercase search
    Expected Result: Search is case-insensitive
    Evidence: Response bodies saved

  Scenario: Wiki filter works correctly
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:3000/api/outreach/articles/db?wiki=en.wikipedia&limit=10"
      2. Assert: All returned articles have language="en" and project="wikipedia"
    Expected Result: Wiki filter applied
    Evidence: Response saved

  Scenario: Combined search and wiki filter
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:3000/api/outreach/articles/db?search=climate&wiki=en.wikipedia&limit=10"
      2. Assert: Results match both criteria (AND logic)
    Expected Result: Both filters combine
    Evidence: Response saved

  Scenario: Empty search returns all articles (paginated)
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:3000/api/outreach/articles/db?search=&limit=50"
      2. Assert: pagination.total equals full article count (~12924)
    Expected Result: Empty search = no filter
    Evidence: Response saved

  Scenario: Search with no results
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:3000/api/outreach/articles/db?search=xyznonexistent12345"
      2. Assert: pagination.total === 0
      3. Assert: articles array is empty
    Expected Result: Empty result set handled gracefully
    Evidence: Response saved
  ```

  **Commit**: YES
  - Message: `feat(api): add search and wiki filter params to articles endpoint`
  - Files: `apps/api/src/routes/outreach.ts`, `apps/api/src/schemas/outreach.schema.ts` (new)
  - Pre-commit: `cd apps/api && bun test`

---

### Task 3: Update Frontend API Client

- [x] 3. Update `fetchOutreachArticles` and add `fetchArticleStats`

  **What to do**:
  - Modify `fetchOutreachArticles` to:
    - Accept params: `{ page?, limit?, search?, wiki? }`
    - Return full response including pagination metadata
    - Build query string from params
  - Add new `fetchArticleStats` function for stats endpoint
  - Update `OutreachArticle` type if needed (field name alignment)

  **Must NOT do**:
  - Don't change existing type exports that other files depend on
  - Don't add caching logic (TanStack Query handles this)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small API client changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1, Task 2

  **References**:
  - `apps/web/src/lib/api.ts:117-128` - Current fetchOutreachArticles
  - `apps/web/src/lib/api.ts:96-101` - fetchOutreachUsers pattern (shows param passing)

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: TypeScript compilation succeeds
    Tool: Bash
    Steps:
      1. cd apps/web && bun run build
      2. Assert: Exit code 0, no type errors
    Expected Result: Types are correct
    Evidence: Build output

  Scenario: fetchOutreachArticles accepts params
    Tool: Bash (type check)
    Steps:
      1. Verify function signature accepts { page, limit, search, wiki }
      2. Verify return type includes pagination metadata
    Expected Result: Function signature updated
    Evidence: TypeScript passes
  ```

  **Commit**: YES (group with Task 4)
  - Message: `feat(web): update API client for pagination and search support`
  - Files: `apps/web/src/lib/api.ts`
  - Pre-commit: `cd apps/web && bun run build`

---

### Task 4: Create Pagination Component

- [x] 4. Create reusable Pagination component

  **What to do**:
  - Create `apps/web/src/components/ui/pagination.tsx`
  - Include: Previous/Next buttons, page numbers, current page indicator
  - Props: `currentPage`, `totalPages`, `onPageChange`
  - Style with existing shadcn/ui patterns (Button component)
  - Handle edge cases: page 1 (no prev), last page (no next)

  **Must NOT do**:
  - Don't add page size selector (keep it simple)
  - Don't add "jump to page" input
  - Don't fetch data within component (controlled component)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component creation
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Component styling and UX patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: None (can use mock data)

  **References**:
  - `apps/web/src/components/ui/button.tsx` - Button component to reuse
  - `apps/web/src/components/ui/select.tsx` - shadcn component pattern
  - `apps/web/src/components/stats/WikiProjectTable.tsx` - Table component pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Pagination component renders correctly
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, component can be tested in isolation or on articles page
    Steps:
      1. Navigate to /articles (after Task 5) or component storybook
      2. Assert: Pagination controls visible
      3. Assert: Current page indicator shows "1"
      4. Assert: "Previous" button is disabled on page 1
      5. Click "Next" button
      6. Assert: Page changes to 2
      7. Assert: "Previous" button is now enabled
      8. Screenshot: .sisyphus/evidence/task-4-pagination.png
    Expected Result: Pagination works as expected
    Evidence: Screenshot saved

  Scenario: Pagination handles last page
    Tool: Playwright
    Steps:
      1. Navigate to last page (via URL or clicking)
      2. Assert: "Next" button is disabled
    Expected Result: Can't go past last page
    Evidence: Screenshot saved
  ```

  **Commit**: YES (group with Task 3)
  - Message: `feat(web): add Pagination component`
  - Files: `apps/web/src/components/ui/pagination.tsx`
  - Pre-commit: `cd apps/web && bun run build`

---

### Task 5: Wire Up Articles Page

- [x] 5. Integrate pagination, search, and stats into articles page

  **What to do**:
  - Add URL state management for page, search, wiki filter using TanStack Router
  - Separate stats query (global) from articles query (paginated)
  - Add search input with 300ms debounce
  - Connect pagination component
  - Update summary cards to use stats endpoint data
  - Update "Pageviews by Wiki" table to use stats endpoint data
  - Keep article table using paginated articles endpoint
  - Add loading states

  **Must NOT do**:
  - Don't keep client-side filtering (all filtering server-side now)
  - Don't change the visual design/layout
  - Don't add features not specified (sorting, etc.)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Complex UI integration with state management
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React patterns, state management

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 6
  - **Blocked By**: Task 3, Task 4

  **References**:
  - `apps/web/src/routes/articles.tsx` - Current implementation to modify
  - `apps/web/src/routes/editors.tsx` - Similar page pattern
  - `apps/web/src/lib/api.ts` - Updated API functions (from Task 3)
  - TanStack Router docs for URL state: https://tanstack.com/router/latest/docs/framework/react/guide/search-params

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Summary cards show global stats (not page stats)
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to http://localhost:3001/articles
      2. Wait for page load (loading state disappears)
      3. Find card with text "Total Articles"
      4. Assert: Card value is greater than 10000 (should be ~12924)
      5. Navigate to page 2: http://localhost:3001/articles?page=2
      6. Assert: "Total Articles" card still shows same value (>10000)
      7. Screenshot: .sisyphus/evidence/task-5-global-stats.png
    Expected Result: Stats are global, not per-page
    Evidence: Screenshots on page 1 and page 2

  Scenario: Pagination controls work
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3001/articles
      2. Assert: Table shows 50 rows
      3. Assert: Pagination shows "Page 1 of X"
      4. Click "Next" button
      5. Assert: URL changes to include "page=2"
      6. Assert: Table shows different articles (first row title different)
      7. Click "Previous" button
      8. Assert: URL shows "page=1" or no page param
      9. Screenshot: .sisyphus/evidence/task-5-pagination.png
    Expected Result: Pagination navigates through articles
    Evidence: Screenshots

  Scenario: Search filters articles server-side
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3001/articles
      2. Find search input (placeholder contains "Search")
      3. Type "climate" into search input
      4. Wait 500ms (debounce)
      5. Assert: URL contains "search=climate"
      6. Assert: Table rows contain "climate" in title (case-insensitive)
      7. Assert: "Total Articles" card still shows global count (>10000)
      8. Clear search input
      9. Wait 500ms
      10. Assert: Table returns to showing all articles
      11. Screenshot: .sisyphus/evidence/task-5-search.png
    Expected Result: Search works, stats remain global
    Evidence: Screenshots

  Scenario: Wiki filter works with pagination
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3001/articles
      2. Select "en.wikipedia" from wiki dropdown
      3. Assert: URL contains "wiki=en.wikipedia"
      4. Assert: All table rows show "en.wikipedia" in wiki column
      5. Click "Next" page
      6. Assert: Still filtered to en.wikipedia
      7. Screenshot: .sisyphus/evidence/task-5-wiki-filter.png
    Expected Result: Wiki filter persists across pages
    Evidence: Screenshot

  Scenario: URL state is shareable
    Tool: Playwright
    Steps:
      1. Navigate directly to http://localhost:3001/articles?page=2&search=test&wiki=en.wikipedia
      2. Assert: Page shows page 2
      3. Assert: Search input contains "test"
      4. Assert: Wiki dropdown shows "en.wikipedia"
      5. Assert: Table is filtered accordingly
    Expected Result: URL state restores correctly
    Evidence: Screenshot

  Scenario: Empty search results handled
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3001/articles
      2. Type "xyznonexistent12345" in search
      3. Wait 500ms
      4. Assert: Table shows "No articles match your search" or similar message
      5. Assert: Summary cards still show global stats
    Expected Result: Empty state is user-friendly
    Evidence: Screenshot
  ```

  **Commit**: YES
  - Message: `feat(web): add pagination, search, and global stats to articles page`
  - Files: `apps/web/src/routes/articles.tsx`
  - Pre-commit: `cd apps/web && bun run build`

---

### Task 6: Add E2E Tests

- [x] 6. Add tests for new functionality

  **What to do**:
  - Add API integration tests for stats endpoint
  - Add API integration tests for search parameter
  - Verify existing tests still pass

  **Must NOT do**:
  - Don't add Playwright E2E tests (agent QA scenarios cover this)
  - Don't test implementation details, only behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding tests to existing test file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None
  - **Blocked By**: Task 5

  **References**:
  - `apps/api/src/__tests__/api.test.ts` - Existing test file
  - Current tests for articles endpoint pagination

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. cd apps/api && bun test
      2. Assert: Exit code 0
      3. Assert: Output shows all tests passing
    Expected Result: No test failures
    Evidence: Test output captured
  ```

  **Commit**: YES
  - Message: `test(api): add tests for stats endpoint and search functionality`
  - Files: `apps/api/src/__tests__/api.test.ts`
  - Pre-commit: `cd apps/api && bun test`

---

## Commit Strategy

| After Task | Message                                                      | Files                           | Verification  |
| ---------- | ------------------------------------------------------------ | ------------------------------- | ------------- |
| 1          | `feat(api): add /api/outreach/articles/stats endpoint`       | outreach.ts                     | bun test      |
| 2          | `feat(api): add search and wiki filter params`               | outreach.ts, outreach.schema.ts | bun test      |
| 3+4        | `feat(web): add pagination component and API client updates` | api.ts, pagination.tsx          | bun run build |
| 5          | `feat(web): integrate pagination/search into articles page`  | articles.tsx                    | bun run build |
| 6          | `test(api): add tests for new endpoints`                     | api.test.ts                     | bun test      |

---

## Success Criteria

### Verification Commands

```bash
# Stats endpoint returns global totals
curl -s http://localhost:3000/api/outreach/articles/stats | jq '.data.totalArticles'
# Expected: 12924 (or current total)

# Search works
curl -s "http://localhost:3000/api/outreach/articles/db?search=climate&limit=5" | jq '.data.articles[].title'
# Expected: Titles containing "climate"

# Pagination + search combo
curl -s "http://localhost:3000/api/outreach/articles/db?search=wiki&page=2&limit=10" | jq '.data.pagination'
# Expected: page=2, totalPages based on filtered count

# Build passes
cd apps/web && bun run build
# Expected: Exit 0

# Tests pass
cd apps/api && bun test
# Expected: All tests pass
```

### Final Checklist

- [x] All "Must Have" present
- [x] All "Must NOT Have" absent (no infinite scroll, no sorting, no fuzzy search)
- [x] Global stats visible regardless of current page
- [x] Pagination controls functional
- [x] Search filters articles server-side
- [x] URL state shareable
- [x] All tests pass
- [x] Build succeeds
