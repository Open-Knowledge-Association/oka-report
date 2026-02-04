# Pageviews by Wiki Language

## TL;DR

> **Quick Summary**: Add articles data from Outreach Dashboard API with pageviews aggregated by wiki language, enabling comprehensive reporting across multiple Wikipedia editions (en, id, fr, etc.).
>
> **Deliverables**:
>
> - Backend: `getArticles()` method + `/api/outreach/articles` endpoint
> - Frontend: `fetchOutreachArticles()` function + new Articles page with wiki breakdown
> - Navigation: Add "Articles" link to sidebar
>
> **Estimated Effort**: Medium (4-5 tasks)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 (types) → Task 2 (client) → Task 3 (API) → Task 4 (frontend fetch) → Task 5 (UI page)

---

## Context

### Original Request

User wants to add **pageviews per wiki language** to make the OKA Stats Platform reporting comprehensive. The Outreach Dashboard shows articles across multiple Wikipedia languages (en, id, fr, etc.), and this data should be displayed in the platform.

### Interview Summary

**Key Discussions**:

- Direct API fetch pattern (no DB storage) - matches existing `/users` implementation
- Client-side grouping by wiki language required (API returns flat article list)
- Reuse existing stats components where possible (shadcn Table, Card)
- Follow `editors.tsx` inline component pattern (no separate component files)

**Research Findings**:

- **API Endpoint**: `GET /courses/{school}/{slug}/articles.json`
- **Response Structure**: `{ course: { articles: [...] } }` with per-article fields: `language`, `project`, `view_count`, `average_views`, `character_sum`, `references_count`, `title`, `url`, `new_article`, `rating`
- **Existing Patterns**:
  - `OutreachDashboardClient.request<T>()` with retry/backoff in `packages/utils/src/outreach-dashboard/client.ts`
  - API route error handling: `{ success, data }` / `{ success, error, details }` in `apps/api/src/routes/outreach.ts`
  - Frontend `apiFetch<T>()` wrapper in `apps/web/src/lib/api.ts`
  - Inline components with shadcn (see `editors.tsx`)

### Metis Review

**Identified Gaps** (addressed):

- **Large dataset handling**: OKA course has ~47K articles (5MB+ payload). Apply default: client-side filtering with loading state; future optimization out of scope.
- **Default sort order**: Default to descending pageviews (most viewed first).
- **Wiki breakdown detail**: Summary cards show count + total pageviews per wiki.
- **Namespace filtering**: Include all namespaces from API (mainspace focus, but API filters already applied).
- **Zero pageview articles**: Include them, sort to bottom.

---

## Work Objectives

### Core Objective

Display Outreach Dashboard articles grouped by wiki language with pageview metrics, enabling comprehensive cross-wiki reporting.

### Concrete Deliverables

- `OutreachArticle` type in `packages/utils/src/outreach-dashboard/types.ts`
- `getArticles(school, slug)` method in `packages/utils/src/outreach-dashboard/client.ts`
- `GET /api/outreach/articles` endpoint in `apps/api/src/routes/outreach.ts`
- `fetchOutreachArticles()` function in `apps/web/src/lib/api.ts`
- `/articles` route in `apps/web/src/routes/articles.tsx`
- Navigation link in `apps/web/src/components/Header.tsx`

### Definition of Done

- [x] `curl localhost:3001/api/outreach/articles?school=OKA&slug=OKA` returns articles JSON
- [x] `/articles` page displays articles table with wiki filter
- [x] Summary cards show per-wiki pageview totals
- [x] Navigation includes "Articles" link

### Must Have

- Articles table with columns: Title (linked), Wiki, Pageviews, Characters, References
- Filter by wiki language (dropdown)
- Sort by pageviews (default descending)
- Summary cards: Total Articles, Total Pageviews, breakdown per wiki
- Loading state while fetching

### Must NOT Have (Guardrails)

- **NO database storage** - Direct API fetch only (matches existing pattern)
- **NO pagination** - Load all articles client-side (defer optimization)
- **NO time-series charts** - API doesn't provide historical pageview data
- **NO separate component files** - Inline in route file like `editors.tsx`
- **NO search/text filter** - Keep scope minimal (wiki filter only)
- **NO article detail pages** - Link to Wikipedia directly

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> Every criterion MUST be verifiable by running a command or using a tool.

### Test Decision

- **Infrastructure exists**: YES (vitest configured in apps/web)
- **Automated tests**: NO (follow existing pattern - no tests for similar pages)
- **Framework**: vitest (available but not used for route pages)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

All verification via Playwright for UI, curl for API.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Add OutreachArticle type

Wave 2 (After Wave 1):
├── Task 2: Add getArticles client method
└── (blocked by Task 1)

Wave 3 (After Wave 2):
└── Task 3: Add /api/outreach/articles endpoint

Wave 4 (After Wave 3):
└── Task 4: Add fetchOutreachArticles frontend function

Wave 5 (After Wave 4):
├── Task 5: Create Articles page with wiki breakdown
└── Task 6: Add navigation link (can parallel with Task 5)
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 2      | None                 |
| 2    | 1          | 3      | None                 |
| 3    | 2          | 4      | None                 |
| 4    | 3          | 5      | None                 |
| 5    | 4          | None   | 6                    |
| 6    | None       | None   | 5                    |

### Agent Dispatch Summary

| Wave | Tasks      | Recommended Approach                     |
| ---- | ---------- | ---------------------------------------- |
| 1-4  | 1, 2, 3, 4 | Sequential (type → client → API → fetch) |
| 5    | 5, 6       | Parallel (UI page + navigation)          |

---

## TODOs

- [x] 1. Add OutreachArticle type definition

  **What to do**:
  - Add `OutreachArticle` interface to `packages/utils/src/outreach-dashboard/types.ts`
  - Add `ArticleData` response wrapper type
  - Fields based on actual API response: `id`, `title`, `language`, `project`, `view_count`, `average_views`, `character_sum`, `references_count`, `new_article`, `rating`, `url`, `user_ids`

  **Must NOT do**:
  - Do not modify existing types
  - Do not add types for features not in this plan

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file, small addition, clear pattern to follow
  - **Skills**: `[]`
    - No special skills needed for type definition
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work in this task

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (alone)
  - **Blocks**: Task 2
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References** (existing code to follow):
  - `packages/utils/src/outreach-dashboard/types.ts:154-176` - `OutreachUser` interface pattern showing field naming convention (snake_case from API)
  - `packages/utils/src/outreach-dashboard/types.ts:195-208` - Response wrapper pattern (`CourseData`, `UserData`, `UploadData`)

  **API/Type References** (contracts to implement against):
  - Outreach Dashboard API response (confirmed via live call):
    ```json
    {
      "course": {
        "articles": [
          {
            "id": 670,
            "title": "Alphabet",
            "language": "en",
            "project": "wikipedia",
            "view_count": 1059645,
            "average_views": 1531.28,
            "character_sum": 24,
            "references_count": 0,
            "new_article": false,
            "rating": "c",
            "url": "https://en.wikipedia.org/wiki/Alphabet",
            "user_ids": [28545512]
          }
        ]
      }
    }
    ```

  **Acceptance Criteria**:
  - [ ] `OutreachArticle` interface exists in `packages/utils/src/outreach-dashboard/types.ts`
  - [ ] `ArticleData` response wrapper type exists
  - [ ] TypeScript compiles without errors: `cd packages/utils && bun run tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Types compile successfully
    Tool: Bash
    Preconditions: packages/utils exists with tsconfig.json
    Steps:
      1. cd packages/utils
      2. bun run tsc --noEmit
      3. Assert: exit code 0
    Expected Result: No TypeScript errors
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(utils): add OutreachArticle type for articles API`
  - Files: `packages/utils/src/outreach-dashboard/types.ts`
  - Pre-commit: `cd packages/utils && bun run tsc --noEmit`

---

- [x] 2. Add getArticles method to OutreachDashboardClient

  **What to do**:
  - Add `getArticles(school: string, slug: string): Promise<ArticleData>` method
  - Follow exact pattern of existing `getCourse`, `getUsers`, `getUploads` methods
  - Endpoint: `/courses/${school}/${slug}/articles.json`

  **Must NOT do**:
  - Do not add caching or transformation logic
  - Do not modify retry/backoff logic
  - Do not add pagination (API doesn't support it)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single method addition, exact pattern copy from existing methods
  - **Skills**: `[]`
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 (sequential)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1 (needs ArticleData type)

  **References**:

  **Pattern References** (existing code to follow):
  - `packages/utils/src/outreach-dashboard/client.ts:85-95` - Existing `getCourse`, `getUsers`, `getUploads` methods showing exact pattern to follow

  **API/Type References** (contracts to implement against):
  - `packages/utils/src/outreach-dashboard/types.ts` - `ArticleData` type (from Task 1)
  - Outreach Dashboard API endpoint: `GET /courses/{school}/{slug}/articles.json`

  **Acceptance Criteria**:
  - [ ] `getArticles` method exists in `OutreachDashboardClient` class
  - [ ] Method signature: `getArticles(school: string, slug: string): Promise<ArticleData>`
  - [ ] TypeScript compiles: `cd packages/utils && bun run tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: getArticles method compiles and follows pattern
    Tool: Bash
    Preconditions: Task 1 complete (ArticleData type exists)
    Steps:
      1. cd packages/utils
      2. bun run tsc --noEmit
      3. Assert: exit code 0
      4. grep -n "getArticles" src/outreach-dashboard/client.ts
      5. Assert: method found
    Expected Result: Method exists and compiles
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(utils): add getArticles method to OutreachDashboardClient`
  - Files: `packages/utils/src/outreach-dashboard/client.ts`
  - Pre-commit: `cd packages/utils && bun run tsc --noEmit`

---

- [x] 3. Add /api/outreach/articles endpoint

  **What to do**:
  - Add `GET /articles` route to `apps/api/src/routes/outreach.ts`
  - Accept query params: `school`, `slug`
  - Return `{ success: true, data: ArticleData }` on success
  - Return `{ success: false, error: "...", details: "..." }` on error
  - Follow exact pattern of existing `/course` and `/users` endpoints

  **Must NOT do**:
  - Do not add filtering/pagination at API level
  - Do not transform or aggregate data
  - Do not add new route file (add to existing outreach.ts)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single endpoint addition, exact pattern copy
  - **Skills**: `[]`
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Task 4
  - **Blocked By**: Task 2 (needs getArticles method)

  **References**:

  **Pattern References** (existing code to follow):
  - `apps/api/src/routes/outreach.ts:24-61` - `/course` endpoint pattern (query params, validation, error handling, response shape)
  - `apps/api/src/routes/outreach.ts:69-106` - `/users` endpoint pattern (identical structure)

  **API/Type References** (contracts to implement against):
  - Response shape: `{ success: boolean, data: ArticleData }` or `{ success: false, error: string, details: string }`

  **Acceptance Criteria**:
  - [ ] `GET /api/outreach/articles` endpoint exists
  - [ ] Returns 400 if school or slug missing
  - [ ] Returns 200 with articles data on success
  - [ ] TypeScript compiles: `cd apps/api && bun run tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Articles endpoint returns data
    Tool: Bash (curl)
    Preconditions: API server running on localhost:3001
    Steps:
      1. Start API server if not running: cd apps/api && bun run dev &
      2. Wait 3 seconds for server startup
      3. curl -s "http://localhost:3001/api/outreach/articles?school=OKA&slug=OKA" | head -c 500
      4. Assert: response contains "success":true
      5. Assert: response contains "articles"
    Expected Result: JSON response with articles array
    Evidence: Response body captured

  Scenario: Articles endpoint validates params
    Tool: Bash (curl)
    Preconditions: API server running
    Steps:
      1. curl -s "http://localhost:3001/api/outreach/articles"
      2. Assert: response contains "success":false
      3. Assert: response contains "Missing required query parameters"
    Expected Result: 400 error with validation message
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `feat(api): add /api/outreach/articles endpoint`
  - Files: `apps/api/src/routes/outreach.ts`
  - Pre-commit: `cd apps/api && bun run tsc --noEmit`

---

- [x] 4. Add fetchOutreachArticles frontend function

  **What to do**:
  - Add `OutreachArticle` type export to `apps/web/src/lib/api.ts`
  - Add `fetchOutreachArticles()` async function
  - Follow exact pattern of `fetchOutreachUsers()` (extract articles from nested response)
  - Return `OutreachArticle[]` array

  **Must NOT do**:
  - Do not add client-side transformation
  - Do not add caching logic
  - Do not duplicate type definition (reference from pattern)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single function addition, exact pattern copy
  - **Skills**: `[]`
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: No UI work in this task

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (sequential)
  - **Blocks**: Task 5
  - **Blocked By**: Task 3 (needs API endpoint)

  **References**:

  **Pattern References** (existing code to follow):
  - `apps/web/src/lib/api.ts:83-101` - `OutreachUser` type and `fetchOutreachUsers()` function pattern

  **API/Type References** (contracts to implement against):
  - API response shape: `{ course: { articles: OutreachArticle[] } }`
  - Fields needed in type: `id`, `title`, `language`, `project`, `view_count`, `average_views`, `character_sum`, `references_count`, `new_article`, `rating`, `url`

  **Acceptance Criteria**:
  - [ ] `OutreachArticle` type exported from `apps/web/src/lib/api.ts`
  - [ ] `fetchOutreachArticles()` function exists
  - [ ] Function returns `Promise<OutreachArticle[]>`
  - [ ] TypeScript compiles: `cd apps/web && bun run tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Frontend fetch function compiles
    Tool: Bash
    Preconditions: Task 3 complete
    Steps:
      1. cd apps/web
      2. bun run tsc --noEmit
      3. Assert: exit code 0
      4. grep -n "fetchOutreachArticles" src/lib/api.ts
      5. Assert: function found
    Expected Result: Function exists and compiles
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(web): add fetchOutreachArticles API function`
  - Files: `apps/web/src/lib/api.ts`
  - Pre-commit: `cd apps/web && bun run tsc --noEmit`

---

- [x] 5. Create Articles page with wiki language breakdown

  **What to do**:
  - Create `apps/web/src/routes/articles.tsx` with TanStack Router file route
  - Use `useQuery` with `fetchOutreachArticles()` for data fetching
  - Compute aggregates client-side:
    - Total articles count
    - Total pageviews sum
    - Per-wiki breakdown: `{ wiki: string, count: number, pageviews: number }[]`
  - Summary cards (shadcn Card): Total Articles, Total Pageviews, unique wikis count
  - Per-wiki summary table showing count and pageviews per wiki
  - Articles table (shadcn Table):
    - Columns: Title (linked to Wikipedia), Wiki, Pageviews, Characters, References
    - Sort by pageviews descending (default)
  - Wiki filter dropdown (shadcn Select):
    - Options: "All" + dynamic list from data
    - Filter articles table when selected
  - Loading state while data loads

  **Must NOT do**:
  - **NO separate component files** - Inline everything in route file (like editors.tsx)
  - **NO pagination** - Load all articles
  - **NO search/text filter** - Wiki dropdown filter only
  - **NO time-series chart** - Not available from API
  - **NO virtualization** - Defer performance optimization

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI page creation with data display, cards, tables, filtering
  - **Skills**: `["frontend-ui-ux"]`
    - `frontend-ui-ux`: Needed for proper layout, component composition, responsive design
  - **Skills Evaluated but Omitted**:
    - `playwright`: QA verification (done separately via scenarios)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 6)
  - **Blocks**: None
  - **Blocked By**: Task 4 (needs fetchOutreachArticles)

  **References**:

  **Pattern References** (existing code to follow):
  - `apps/web/src/routes/editors.tsx:1-143` - Complete page pattern: file route setup, useQuery, summary cards, data table, loading state
  - `apps/web/src/routes/editors.tsx:26-42` - Aggregate computation pattern (reduce over array)
  - `apps/web/src/routes/editors.tsx:50-87` - Summary cards layout with shadcn Card, CardHeader, CardTitle, CardContent
  - `apps/web/src/routes/editors.tsx:89-139` - Table layout with shadcn Table components

  **API/Type References** (contracts to implement against):
  - `apps/web/src/lib/api.ts` - `OutreachArticle` type and `fetchOutreachArticles()` function

  **External References** (libraries and frameworks):
  - shadcn Select: For wiki filter dropdown - `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"`

  **Acceptance Criteria**:
  - [ ] `/articles` route accessible in browser
  - [ ] Summary cards display: Total Articles, Total Pageviews, Wikis count
  - [ ] Per-wiki breakdown table shows count and pageviews per wiki
  - [ ] Articles table displays with all columns
  - [ ] Wiki filter dropdown filters table
  - [ ] Article titles link to Wikipedia
  - [ ] Loading state shows while fetching
  - [ ] TypeScript compiles: `cd apps/web && bun run tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Articles page loads and displays data
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running (API on 3001, Web on 3000)
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible (timeout: 30s) - large dataset may take time
      3. Assert: h1 text contains "Article" or "Wiki"
      4. Assert: At least one Card component visible (summary cards)
      5. Assert: Table with data rows visible
      6. Screenshot: .sisyphus/evidence/task-5-articles-page-loaded.png
    Expected Result: Page shows summary cards and articles table
    Evidence: .sisyphus/evidence/task-5-articles-page-loaded.png

  Scenario: Wiki filter changes table content
    Tool: Playwright (playwright skill)
    Preconditions: Articles page loaded with data
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table tbody tr visible (timeout: 30s)
      3. Count: initial row count
      4. Click: Select trigger (wiki filter dropdown)
      5. Wait for: SelectContent visible
      6. Click: First non-"All" option (e.g., "en")
      7. Wait for: table to update (500ms)
      8. Count: filtered row count
      9. Assert: filtered count <= initial count (filtering reduced or kept same)
      10. Screenshot: .sisyphus/evidence/task-5-wiki-filter-applied.png
    Expected Result: Table filters to selected wiki
    Evidence: .sisyphus/evidence/task-5-wiki-filter-applied.png

  Scenario: Article title links to Wikipedia
    Tool: Playwright (playwright skill)
    Preconditions: Articles page loaded with data
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table tbody tr visible (timeout: 30s)
      3. Find: first anchor tag in table body
      4. Assert: href contains "wikipedia.org"
      5. Assert: target="_blank" attribute present
    Expected Result: Article links open Wikipedia in new tab
    Evidence: DOM assertion logged

  Scenario: Loading state displays initially
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, cache cleared
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Immediately check for: "Loading" text OR spinner/skeleton visible
      3. Screenshot: .sisyphus/evidence/task-5-loading-state.png (if captured in time)
    Expected Result: Loading indicator shown during fetch
    Evidence: .sisyphus/evidence/task-5-loading-state.png
  ```

  **Commit**: YES
  - Message: `feat(web): add Articles page with wiki language breakdown`
  - Files: `apps/web/src/routes/articles.tsx`
  - Pre-commit: `cd apps/web && bun run tsc --noEmit`

---

- [x] 6. Add Articles navigation link

  **What to do**:
  - Add `{ to: "/articles", label: "Articles" }` to `navItems` array in `apps/web/src/components/Header.tsx`
  - Position after "Editors" in navigation order

  **Must NOT do**:
  - Do not change navigation styling
  - Do not add icons (none used in current nav)
  - Do not modify mobile nav separately (uses same navItems array)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line addition to array
  - **Skills**: `[]`
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Trivial change, no design decisions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 5 (with Task 5)
  - **Blocks**: None
  - **Blocked By**: None (navigation can exist before page)

  **References**:

  **Pattern References** (existing code to follow):
  - `apps/web/src/components/Header.tsx:5-9` - `navItems` array pattern

  **Acceptance Criteria**:
  - [ ] "Articles" link appears in sidebar navigation
  - [ ] Link navigates to `/articles` route
  - [ ] TypeScript compiles: `cd apps/web && bun run tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Articles navigation link visible and works
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:3000/
      2. Wait for: nav visible
      3. Assert: Link with text "Articles" visible in nav
      4. Click: "Articles" link
      5. Wait for: URL contains "/articles"
      6. Assert: URL is http://localhost:3000/articles
      7. Screenshot: .sisyphus/evidence/task-6-navigation-link.png
    Expected Result: Articles link in nav, navigates correctly
    Evidence: .sisyphus/evidence/task-6-navigation-link.png
  ```

  **Commit**: YES (groups with Task 5)
  - Message: `feat(web): add Articles navigation link`
  - Files: `apps/web/src/components/Header.tsx`
  - Pre-commit: `cd apps/web && bun run tsc --noEmit`

---

## Commit Strategy

| After Task | Message                                                          | Files                                                                    | Verification           |
| ---------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------- |
| 1          | `feat(utils): add OutreachArticle type for articles API`         | `packages/utils/src/outreach-dashboard/types.ts`                         | `bun run tsc --noEmit` |
| 2          | `feat(utils): add getArticles method to OutreachDashboardClient` | `packages/utils/src/outreach-dashboard/client.ts`                        | `bun run tsc --noEmit` |
| 3          | `feat(api): add /api/outreach/articles endpoint`                 | `apps/api/src/routes/outreach.ts`                                        | `bun run tsc --noEmit` |
| 4          | `feat(web): add fetchOutreachArticles API function`              | `apps/web/src/lib/api.ts`                                                | `bun run tsc --noEmit` |
| 5+6        | `feat(web): add Articles page with wiki language breakdown`      | `apps/web/src/routes/articles.tsx`, `apps/web/src/components/Header.tsx` | `bun run tsc --noEmit` |

---

## Success Criteria

### Verification Commands

```bash
# API endpoint returns data
curl -s "http://localhost:3001/api/outreach/articles?school=OKA&slug=OKA" | jq '.success'
# Expected: true

# TypeScript compiles across workspace
bun run tsc --noEmit  # from root
# Expected: no errors

# Page accessible
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/articles
# Expected: 200
```

### Final Checklist

- [x] All "Must Have" features present:
  - [x] Articles table with Title, Wiki, Pageviews, Characters, References
  - [x] Wiki filter dropdown
  - [x] Summary cards (Total Articles, Total Pageviews, Wiki count)
  - [x] Loading state
- [x] All "Must NOT Have" enforced:
  - [x] No database storage (direct API fetch)
  - [x] No pagination
  - [x] No separate component files
  - [x] No search/text filter
- [x] All TypeScript compiles
- [x] Navigation link works
