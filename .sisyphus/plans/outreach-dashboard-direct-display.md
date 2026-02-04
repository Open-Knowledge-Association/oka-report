# Display Outreach Dashboard Data on Homepage

## TL;DR

> **Quick Summary**: Configure Vite proxy, add missing API endpoint, and update Dashboard/Editors pages to display data directly from Outreach Dashboard API. Most UI components already exist - just need wiring.
>
> **Deliverables**:
>
> - Vite proxy configured for `/api` routes
> - New API endpoint `/api/outreach/users` for fetching user data
> - Dashboard page (`/`) shows Outreach Dashboard stats
> - Editors page (`/editors`) shows user stats from Outreach
>
> **Estimated Effort**: Quick (5 files, ~120 lines)
> **Parallel Execution**: NO - sequential (dependencies between tasks)
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4 → Task 5

---

## Context

### Original Request

User reported that Dashboard (`/`), Editors (`/editors`), and Admin (`/admin/editors`) pages are empty. User wants Outreach Dashboard data (https://outreachdashboard.wmflabs.org/courses/OKA/OKA/) displayed directly on the homepage.

### Interview Summary

**Key Findings**:

- Database has 54 editors but 0 contributions/articles/pageviews
- Frontend on port 3001 can't reach API on port 3000 (no proxy configured)
- User chose "Tampilkan data Outreach Dashboard langsung" approach
- Admin page `/admin/outreach` already works with Outreach data

**Existing Components** (discovered by Metis):

- `OutreachStats` component exists at `apps/web/src/components/outreach/OutreachStats.tsx`
- `SyncStatusCard` and `SyncButton` also exist
- Admin page at `/admin/outreach` demonstrates working pattern

### Metis Review

**Key Insight**: Scope is smaller than expected because UI components already exist.

**Identified Gaps** (addressed):

- Vite proxy missing → Add in Task 1
- OutreachStats not used on Dashboard → Reuse in Task 4
- Editors page data mismatch → Adapt columns in Task 5

### Momus Review (First Pass)

**REJECT Reason**: Missing backend endpoint for Outreach users

**Fix Applied**: Added Task 2 to create `/api/outreach/users` endpoint using existing `OutreachDashboardClient.getUsers()` method.

---

## Work Objectives

### Core Objective

Display Outreach Dashboard statistics on the OKA Stats Platform homepage and editors page, using existing components and API infrastructure.

### Concrete Deliverables

- `apps/web/vite.config.ts` with proxy configuration
- `apps/api/src/routes/outreach.ts` with new `/users` endpoint
- `apps/web/src/lib/api.ts` with Outreach fetch functions
- `apps/web/src/routes/index.tsx` showing Outreach stats
- `apps/web/src/routes/editors.tsx` showing Outreach user data

### Definition of Done

- [x] `http://localhost:3001/api/outreach/course?school=OKA&slug=OKA` returns JSON (not HTML)
- [x] `http://localhost:3001/api/outreach/users?school=OKA&slug=OKA` returns JSON with users array
- [x] Dashboard (`/`) displays editors count, edits, articles, word count from Outreach
- [x] Editors page (`/editors`) shows table with Outreach user data
- [x] No console errors on any page

### Must Have

- Proxy routes `/api` requests to `localhost:3000`
- New `/api/outreach/users` endpoint
- Reuse existing `OutreachStats` component
- Error handling with loading states

### Must NOT Have (Guardrails)

- Creating new UI components when existing ones work
- Storing Outreach data in local database (direct fetch only)
- Breaking the existing `/admin/outreach` page
- Over-engineering with caching layers

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL tasks verified by agent using Playwright, curl, or bash commands.

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: NO (simple wiring task, E2E verification sufficient)
- **Framework**: N/A

### Agent-Executed QA Scenarios (MANDATORY)

All scenarios executed by agent using Playwright or curl.

---

## Execution Strategy

### Dependency Chain (Sequential)

```
Task 1: Add Vite proxy (FIRST - enables frontend API access)
    ↓
Task 2: Add /api/outreach/users endpoint (backend - required by Task 5)
    ↓
Task 3: Add API fetch functions (frontend - depends on endpoints existing)
    ↓
Task 4: Update Dashboard page (depends on fetch functions)
    ↓
Task 5: Update Editors page (depends on fetch functions AND users endpoint)
```

### Agent Dispatch Summary

| Task | Recommended Approach                                 |
| ---- | ---------------------------------------------------- |
| 1    | delegate_task(category="quick", load_skills=[], ...) |
| 2    | Same session - continue after Task 1 verification    |
| 3    | Same session - continue after Task 2                 |
| 4    | Same session - continue after Task 3                 |
| 5    | Same session - continue after Task 4                 |

---

## TODOs

- [x] 1. Add Vite Proxy Configuration

  **What to do**:
  - Open `apps/web/vite.config.ts`
  - Add `server.proxy` configuration to route `/api` to `http://localhost:3000`
  - Restart dev server if running

  **Must NOT do**:
  - Change any other Vite settings
  - Add environment variables for the proxy target (hardcode for now)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]` (no special skills needed)
  - **Reason**: Simple 5-line config change

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (first task)
  - **Blocks**: Tasks 2, 3, 4, 5
  - **Blocked By**: None

  **References**:
  - `apps/web/vite.config.ts:1-22` - Current config without proxy
  - Vite proxy docs: https://vite.dev/config/server-options.html#server-proxy

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: API proxy routes requests to backend
    Tool: Bash (curl)
    Preconditions: Both API (port 3000) and Web (port 3001) dev servers running
    Steps:
      1. curl -s http://localhost:3001/api/outreach/course?school=OKA&slug=OKA
      2. Parse response as JSON
      3. Assert: Response contains "success": true
      4. Assert: Response contains "course" object with "id", "title" fields
    Expected Result: JSON response from API, not HTML 404
    Evidence: curl output captured

  Scenario: Non-API routes still work
    Tool: Bash (curl)
    Preconditions: Web dev server running
    Steps:
      1. curl -s http://localhost:3001/ | head -50
      2. Assert: Response contains "<!DOCTYPE html>"
      3. Assert: Response contains "OKA Stats Platform"
    Expected Result: HTML page served for non-API routes
    Evidence: curl output captured
  ```

  **Commit**: YES
  - Message: `fix(web): add Vite proxy configuration for API routes`
  - Files: `apps/web/vite.config.ts`

---

- [x] 2. Add Outreach Users API Endpoint

  **What to do**:
  - Open `apps/api/src/routes/outreach.ts`
  - Add new GET endpoint `/users` that accepts `school` and `slug` query params
  - Call `dashboardClient.getUsers(school, slug)` (client already initialized at top of file)
  - Return response in same format as `/course` endpoint: `{ success: true, data: { users: [...] } }`
  - Handle errors consistently with existing `/course` endpoint

  **Must NOT do**:
  - Create new files
  - Modify the sync endpoint
  - Add database operations (this is direct fetch from Outreach Dashboard)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - **Reason**: Adding one endpoint following existing pattern (copy-paste + modify)

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Tasks 3, 5
  - **Blocked By**: Task 1

  **References**:
  - `apps/api/src/routes/outreach.ts:24-61` - Existing `/course` endpoint to use as template
  - `apps/api/src/routes/outreach.ts:8-10` - `dashboardClient` already initialized
  - `packages/utils/src/outreach-dashboard/client.ts:89-91` - `getUsers(school, slug)` method
  - `packages/utils/src/outreach-dashboard/types.ts:199-204` - `UserData` response type

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Users endpoint returns user data
    Tool: Bash (curl)
    Preconditions: API server running on port 3000
    Steps:
      1. curl -s "http://localhost:3000/api/outreach/users?school=OKA&slug=OKA"
      2. Parse response as JSON
      3. Assert: Response contains "success": true
      4. Assert: Response contains "data" object
      5. Assert: data contains "users" array OR data.course.users array
      6. Assert: users array has length > 0
      7. Assert: First user has "username" field
    Expected Result: JSON response with users array
    Evidence: curl output captured

  Scenario: Users endpoint validates params
    Tool: Bash (curl)
    Preconditions: API server running
    Steps:
      1. curl -s "http://localhost:3000/api/outreach/users"
      2. Assert: Response contains "success": false
      3. Assert: Response contains error about missing params
      4. Assert: HTTP status is 400
    Expected Result: Proper error for missing params
    Evidence: curl output captured
  ```

  **Commit**: YES
  - Message: `feat(api): add Outreach users endpoint`
  - Files: `apps/api/src/routes/outreach.ts`

---

- [x] 3. Add Outreach API Fetch Functions

  **What to do**:
  - Open `apps/web/src/lib/api.ts`
  - Add `fetchOutreachCourse()` function to fetch course data from `/api/outreach/course?school=OKA&slug=OKA`
  - Add `fetchOutreachUsers()` function to fetch users data from `/api/outreach/users?school=OKA&slug=OKA`
  - Follow existing `apiFetch` pattern for error handling
  - Add TypeScript types for return values

  **Must NOT do**:
  - Modify existing fetch functions
  - Add complex caching logic
  - Create new files
  - Hardcode different school/slug values (use OKA/OKA as default)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - **Reason**: Adding 2 small functions following existing pattern

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `apps/web/src/lib/api.ts:21-36` - Existing `apiFetch` function pattern
  - `apps/web/src/routes/admin/outreach.tsx:17-26` - Working fetch example
  - `packages/utils/src/outreach-dashboard/types.ts:8-152` - `OutreachCourse` type
  - `packages/utils/src/outreach-dashboard/types.ts:154-176` - `OutreachUser` type

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: TypeScript compiles without errors
    Tool: Bash
    Preconditions: None
    Steps:
      1. cd apps/web && bun run tsc --noEmit
      2. Assert: Exit code is 0
      3. Assert: No type errors in output
    Expected Result: Clean TypeScript compilation
    Evidence: Command output captured

  Scenario: Functions are exported correctly
    Tool: Bash
    Preconditions: None
    Steps:
      1. grep -n "export.*fetchOutreachCourse" apps/web/src/lib/api.ts
      2. grep -n "export.*fetchOutreachUsers" apps/web/src/lib/api.ts
      3. Assert: Both functions found
    Expected Result: Both functions exported
    Evidence: grep output
  ```

  **Commit**: YES
  - Message: `feat(web): add Outreach Dashboard API fetch functions`
  - Files: `apps/web/src/lib/api.ts`

---

- [x] 4. Update Dashboard Page with Outreach Stats

  **What to do**:
  - Open `apps/web/src/routes/index.tsx`
  - Import `OutreachStats` component from `@/components/outreach`
  - Import `fetchOutreachCourse` from `@/lib/api`
  - Add `useQuery` to fetch Outreach course data using `fetchOutreachCourse()`
  - Replace the existing stat cards section with `OutreachStats` component
  - Keep the Quick Actions and About sections
  - Add loading and error states

  **Must NOT do**:
  - Remove existing Quick Actions section
  - Remove About section
  - Create new components
  - Remove the `fetchOverallStats` import (may be used elsewhere)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - **Reason**: Straightforward React component integration

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - `apps/web/src/routes/index.tsx:1-121` - Current Dashboard page
  - `apps/web/src/components/outreach/OutreachStats.tsx:1-79` - Component to reuse
  - `apps/web/src/components/outreach/OutreachStats.tsx:5-17` - Props interface showing required shape
  - `apps/web/src/routes/admin/outreach.tsx:13-26` - Query pattern to follow
  - `apps/web/src/routes/admin/outreach.tsx:60` - How to pass course data to OutreachStats

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Dashboard displays Outreach stats
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running on localhost:3000 (API) and localhost:3001 (Web)
    Steps:
      1. Navigate to: http://localhost:3001/
      2. Wait for: network idle (timeout: 10s)
      3. Assert: Page contains text "OKA" (course title)
      4. Assert: Page contains text "Editors" label
      5. Assert: Page contains text "Edits" label
      6. Assert: Page contains text "Articles" label
      7. Assert: Page contains numeric values (not just "-")
      8. Screenshot: .sisyphus/evidence/task-4-dashboard.png
    Expected Result: Dashboard shows Outreach statistics with real numbers
    Evidence: .sisyphus/evidence/task-4-dashboard.png

  Scenario: Dashboard handles API error gracefully
    Tool: Playwright (playwright skill)
    Preconditions: Web server running but API server stopped
    Steps:
      1. Stop API server (or temporarily block /api/outreach)
      2. Navigate to: http://localhost:3001/
      3. Wait for: 5 seconds
      4. Assert: Page does not crash (no white screen)
      5. Assert: Page shows loading or "Loading course statistics..." message
    Expected Result: Graceful degradation, no crash
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): display Outreach Dashboard stats on homepage`
  - Files: `apps/web/src/routes/index.tsx`

---

- [x] 5. Update Editors Page with Outreach User Data

  **What to do**:
  - Open `apps/web/src/routes/editors.tsx`
  - Import `fetchOutreachUsers` from `@/lib/api`
  - Replace `fetchEditorStats()` query with `fetchOutreachUsers()`
  - Update table columns to match Outreach user data:
    - Username (keep)
    - Characters Added (from `character_sum_ms`)
    - References Added (from `references_count`)
    - Total Uploads (from `total_uploads`)
  - Update summary cards to aggregate available metrics
  - Add external link to user's `contribution_url`

  **Must NOT do**:
  - Keep incompatible columns (edits, articlesCreated, pageviews from old schema)
  - Create complex data transformations
  - Add pagination (keep simple for now)
  - Break if users array is empty

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - **Reason**: Table column remapping, straightforward

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (last task)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2, 3, 4

  **References**:
  - `apps/web/src/routes/editors.tsx:1-142` - Current Editors page
  - `packages/utils/src/outreach-dashboard/types.ts:154-176` - OutreachUser type with fields:
    - `username: string`
    - `character_sum_ms: number` (main space characters)
    - `character_sum_us: number` (user space characters)
    - `character_sum_draft: number` (draft space characters)
    - `references_count: number`
    - `total_uploads: number`
    - `contribution_url: string`
    - `role: number` (0 = student)
  - `apps/web/src/routes/admin/outreach.tsx:28-37` - Fetching pattern example

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Editors page shows Outreach user data
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: table visible (timeout: 10s)
      3. Assert: Table header contains "Username"
      4. Assert: Table header contains "Characters" or "Chars"
      5. Assert: Table header contains "References" or "Refs"
      6. Assert: Table header contains "Uploads"
      7. Assert: Table contains at least one user row
      8. Screenshot: .sisyphus/evidence/task-5-editors.png
    Expected Result: Editors table populated with Outreach data
    Evidence: .sisyphus/evidence/task-5-editors.png

  Scenario: Editors page shows summary stats
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: network idle
      3. Assert: Page contains "Total Editors" card or text
      4. Assert: Total count displayed is > 0
    Expected Result: Summary cards show aggregated stats
    Evidence: Screenshot captured

  Scenario: Empty users handled gracefully
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, API returns empty users array
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: network idle
      3. Assert: Page shows "No editor statistics available" or similar message
      4. Assert: No JavaScript errors in console
    Expected Result: Graceful empty state
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): display Outreach user stats on Editors page`
  - Files: `apps/web/src/routes/editors.tsx`

---

## Commit Strategy

| After Task | Message                                                   | Files          | Verification |
| ---------- | --------------------------------------------------------- | -------------- | ------------ |
| 1          | `fix(web): add Vite proxy configuration for API routes`   | vite.config.ts | curl test    |
| 2          | `feat(api): add Outreach users endpoint`                  | outreach.ts    | curl test    |
| 3          | `feat(web): add Outreach Dashboard API fetch functions`   | api.ts         | tsc --noEmit |
| 4          | `feat(web): display Outreach Dashboard stats on homepage` | index.tsx      | Playwright   |
| 5          | `feat(web): display Outreach user stats on Editors page`  | editors.tsx    | Playwright   |

---

## Success Criteria

### Verification Commands

```bash
# Proxy works
curl -s http://localhost:3001/api/outreach/course?school=OKA&slug=OKA | jq '.success'
# Expected: true

# Users endpoint works
curl -s http://localhost:3000/api/outreach/users?school=OKA&slug=OKA | jq '.success'
# Expected: true

# TypeScript compiles
cd apps/web && bun run tsc --noEmit
# Expected: exit 0, no errors

# Dev server starts without errors
moon run :dev
# Expected: No crashes, both servers running
```

### Final Checklist

- [x] Dashboard (`/`) shows Outreach stats with actual numbers
- [x] Editors (`/editors`) shows table with user data (characters, references, uploads)
- [x] Admin (`/admin/outreach`) still works (regression check)
- [x] No TypeScript errors
- [x] No console errors in browser
- [x] All 5 commits pushed to remote
