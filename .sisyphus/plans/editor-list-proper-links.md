# Editor List Page - Proper Links to Local Profile

## TL;DR

> **Quick Summary**: Fix the editors list page to fetch from local DB API and link to internal profile pages instead of Wikipedia. Enrich with real-time Outreach stats.
>
> **Deliverables**:
>
> - Updated `/api/editors` endpoint with Outreach stats enrichment
> - Updated `editors.tsx` to use local API and `<Link>` to profile pages
> - Working editor profile links from list → detail page
>
> **Estimated Effort**: Medium (3-4 tasks, ~2-3 hours)
> **Parallel Execution**: NO - sequential
> **Critical Path**: Task 1 (API) → Task 2 (Frontend) → Task 3 (Verify)

---

## Context

### Original Request

User cannot access editor detail pages. Investigation revealed:

1. `editors.tsx` links to Wikipedia user pages, not internal profile pages
2. `editors.tsx` fetches from Outreach API directly, not local DB
3. Editor data IS synced to local DB (53 editors, fully synced)
4. The disconnect prevents the editor detail page from working

### Interview Summary

**Key Decisions**:

- **Data Source**: Fetch editor list from local DB API (`/api/editors`)
- **Stats Source**: Combine - list from DB, enrich with Outreach stats on-demand
- **Links**: Use `<Link to={`/editors/${editor.id}`}>` for internal routing

### Research Findings

- **Database**: 53 editors synced from `outreach_dashboard` source
- **Sync Service**: `OutreachSyncService.syncEditorsFromDashboard()` already exists and works
- **Editor Table**: Has `externalId` field storing Outreach user ID
- **Profile Endpoint**: `/api/editors/:id/profile` exists and works

---

## Work Objectives

### Core Objective

Enable users to click on editor usernames in the list and navigate to the internal editor profile page with full statistics, charts, and achievements.

### Concrete Deliverables

1. `apps/api/src/routes/editors.ts` - Enhanced list endpoint with Outreach stats enrichment
2. `apps/web/src/routes/editors.tsx` - Updated to fetch from local API and use `<Link>`
3. Working navigation: `/editors` → click username → `/editors/{id}` → profile page

### Definition of Done

- [x] Clicking username in editors list navigates to `/editors/{id}`
- [x] Editor profile page loads with correct data
- [x] Stats in list match Outreach Dashboard values
- [x] No console errors

### Must Have

- `<Link>` component for internal navigation (not `<a href>`)
- Real Prisma CUID editor IDs in links (not `outreach-{id}`)
- Loading state while fetching
- Error handling for API failures

### Must NOT Have (Guardrails)

- ❌ Do NOT remove Wikipedia link entirely (can keep as secondary link in profile)
- ❌ Do NOT break existing editor profile page functionality
- ❌ Do NOT modify sync logic
- ❌ Do NOT change database schema

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL tasks verifiable by agent using tools (Playwright, curl, Bash).

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: Tests-after (if time permits)
- **Framework**: vitest + Playwright for E2E

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

| Type         | Tool        | How Agent Verifies                             |
| ------------ | ----------- | ---------------------------------------------- |
| **API**      | Bash (curl) | Send requests, parse JSON, assert fields       |
| **Frontend** | Playwright  | Navigate, click, assert URL change, screenshot |

---

## Execution Strategy

### Sequential Flow

```
Task 1: Enhance /api/editors endpoint
    ↓
Task 2: Update editors.tsx frontend
    ↓
Task 3: E2E verification
```

### Dependency Matrix

| Task | Depends On | Blocks       |
| ---- | ---------- | ------------ |
| 1    | None       | 2            |
| 2    | 1          | 3            |
| 3    | 2          | None (final) |

---

## TODOs

- [x] 1. **Enhance /api/editors endpoint with Outreach stats**

  **What to do**:
  - Update `GET /api/editors` to return list of editors from database
  - Add option to enrich with Outreach stats (character_sum, references_count, total_uploads)
  - Create a helper function that:
    1. Fetches editors from database
    2. Fetches Outreach users data
    3. Maps Outreach stats to editors by matching `externalId` or `username`
  - Return combined data with both DB fields (id, username) and Outreach stats

  **Must NOT do**:
  - Do NOT modify the Editor model/schema
  - Do NOT change sync logic
  - Do NOT break existing profile endpoint

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
    - Reason: Standard API enhancement, clear scope

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/api/src/routes/editors.ts` - Current editors list endpoint
  - `apps/api/src/routes/outreach.ts:getOutreachUsers` - How to fetch Outreach data

  **API/Type References**:
  - `packages/db/prisma/schema.prisma:28-65` - Editor model with externalId field

  **WHY Each Reference Matters**:
  - editors.ts: The file being modified, current list implementation
  - outreach.ts: Pattern for fetching and using Outreach data

  **Acceptance Criteria**:
  - [x] `GET /api/editors` returns list with id, username, and stats
  - [x] Response includes `characterSum`, `referencesCount`, `uploadsCount`
  - [x] Stats match Outreach Dashboard values
  - [x] Response includes proper Prisma CUID `id` field

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Editors list endpoint returns enriched data
    Tool: Bash (curl)
    Preconditions: API running, editors synced
    Steps:
      1. curl -s "http://localhost:3000/api/editors?limit=5" | jq '.data[0]'
      2. Assert: response has "id" field (CUID format, not "outreach-xxx")
      3. Assert: response has "username" field
      4. Assert: response has "characterSum" or similar stats field
    Expected Result: Enriched editor data
    Evidence: Response body captured

  Scenario: Stats match Outreach values
    Tool: Bash (curl)
    Steps:
      1. Get first editor from /api/editors
      2. Get same user from Outreach API by username
      3. Compare character_sum values
      4. Assert: values match
    Expected Result: Consistent stats
    Evidence: Both responses captured
  ```

  **Commit**: YES
  - Message: `feat(api): enhance /api/editors with Outreach stats enrichment`
  - Files: `apps/api/src/routes/editors.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [x] 2. **Update editors.tsx to use local API and internal links**

  **What to do**:
  - Change data fetching from `fetchOutreachUsers` to `fetch('/api/editors')`
  - Update EditorStats type to match new API response
  - Replace `<a href="...wikipedia...">` with `<Link to={`/editors/${editor.id}`}>`
  - Keep the rest of the UI (cards, table, stats) unchanged
  - Optionally add Wikipedia link as secondary (external link icon)

  **Must NOT do**:
  - Do NOT change the visual design/layout
  - Do NOT remove stats cards
  - Do NOT break loading/error states

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: React component updates with routing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/web/src/routes/editors.tsx` - Current implementation to modify
  - `apps/web/src/routes/articles.tsx` - Example of internal Link usage (if exists)

  **API/Type References**:
  - `apps/web/src/lib/api.ts` - API fetch patterns

  **WHY Each Reference Matters**:
  - editors.tsx: The file being modified
  - TanStack Router Link: Pattern for internal navigation

  **Acceptance Criteria**:
  - [x] Page fetches from `/api/editors` not Outreach API
  - [x] Username links use `<Link to={`/editors/${id}`}>`
  - [x] Clicking username navigates to profile page (no page reload)
  - [x] Stats still display correctly
  - [x] TypeScript compiles without errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Username click navigates to profile
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: table rows visible (timeout: 10s)
      3. Get first username text (store as $username)
      4. Click first username link
      5. Wait for: URL changes to /editors/{id} pattern
      6. Assert: URL matches /editors/[a-z0-9]+
      7. Assert: Profile page shows same username
      8. Screenshot: .sisyphus/evidence/task-2-link-navigation.png
    Expected Result: Internal navigation works
    Evidence: .sisyphus/evidence/task-2-link-navigation.png

  Scenario: Stats still display correctly
    Tool: Playwright (playwright skill)
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: stats cards visible
      3. Assert: "Total Editors" card shows number > 0
      4. Assert: "Characters Added" card shows number > 0
      5. Assert: Table has rows with stats
    Expected Result: Stats displayed
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): update editors page to use local API with internal links`
  - Files: `apps/web/src/routes/editors.tsx`
  - Pre-commit: `bun run tsc --noEmit`

---

- [x] 3. **E2E Verification - Full Flow**

  **What to do**:
  - Test complete flow: List → Click → Profile → Back
  - Verify all data displays correctly
  - Check for console errors
  - Verify mobile responsiveness
  - Document any issues found

  **Must NOT do**:
  - Do NOT skip any verification step
  - Do NOT mark complete if errors found

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]
    - `playwright`: E2E browser automation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - All modified files from Tasks 1-2

  **Acceptance Criteria**:
  - [x] Navigate to /editors - page loads with editor list
  - [x] Click any username - navigates to /editors/{id}
  - [x] Profile page shows: username, stats cards, charts, badges
  - [x] Click browser back - returns to list
  - [x] No console errors throughout flow
  - [x] Works on mobile viewport

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Complete editor flow works
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: table loaded
      3. Count: number of editor rows (store as $count)
      4. Assert: $count > 0
      5. Click: first username link
      6. Wait for: profile page loaded (stats cards visible)
      7. Assert: URL is /editors/{id}
      8. Assert: username displayed matches clicked name
      9. Assert: stats cards visible (Articles, Characters, etc.)
      10. Check console: no errors
      11. Click: browser back button
      12. Assert: back on /editors page
      13. Screenshot: .sisyphus/evidence/task-3-full-flow.png
    Expected Result: Complete flow works without errors
    Evidence: .sisyphus/evidence/task-3-full-flow.png

  Scenario: Mobile viewport works
    Tool: Playwright (playwright skill)
    Steps:
      1. Set viewport: 375x667 (iPhone SE)
      2. Navigate to: /editors
      3. Assert: table scrollable or responsive
      4. Click: username
      5. Assert: profile loads correctly
      6. Screenshot: .sisyphus/evidence/task-3-mobile.png
    Expected Result: Mobile layout works
    Evidence: .sisyphus/evidence/task-3-mobile.png

  Scenario: No console errors
    Tool: Playwright (playwright skill)
    Steps:
      1. Enable console logging
      2. Navigate through: /editors → /editors/{id} → back
      3. Collect all console messages
      4. Assert: no "error" level messages
    Expected Result: Clean console
    Evidence: Console log captured
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message                                                               | Files       | Verification |
| ---------- | --------------------------------------------------------------------- | ----------- | ------------ |
| 1          | `feat(api): enhance /api/editors with Outreach stats enrichment`      | editors.ts  | curl test    |
| 2          | `feat(web): update editors page to use local API with internal links` | editors.tsx | Playwright   |
| 3          | N/A (verification)                                                    | N/A         | Full E2E     |

---

## Success Criteria

### Verification Commands

```bash
# API check
curl -s "http://localhost:3000/api/editors?limit=1" | jq '.data[0] | {id, username}'
# Expected: {"id": "cuid...", "username": "..."}

# Frontend check (via Playwright)
# Navigate to /editors, click first username, verify URL change
```

### Final Checklist

- [x] Username click navigates to internal profile page
- [x] Profile page loads with correct editor data
- [x] Stats in list match Outreach values
- [x] No console errors
- [x] No TypeScript errors
- [x] Mobile responsive
