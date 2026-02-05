# Fix Editor Statistics Page

## TL;DR

> **Quick Summary**: Investigate editor count mismatch (54 local vs 53 Outreach), reconcile data by deleting the extra local editor, and update the Editor Statistics page to use local DB data with internal profile links (falling back to external links when no profile exists).
>
> **Deliverables**:
>
> - Identified and removed extra editor from local DB
> - Editor Statistics page refactored to use `/api/editors` endpoint
> - Internal profile links using TanStack `<Link>` with external fallback
> - Standardized SPA navigation throughout
>
> **Estimated Effort**: Medium (3-4 hours)
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request

User reported: "Benahi halaman editor statistic sesuaikan dengan pekerjaan terbaru mana yang bisa digunakan bersama mana yang tidak, pastikan list editornya di refresh ulang atau di create ulang"

Translation: Fix the Editor Statistics page to align with recent work, refresh/recreate the editor list because there's a mismatch.

### Interview Summary

**Key Discussions**:

- Editor count discrepancy: Outreach Dashboard (53) vs Local DB (54)
- Previous work: Added Created/Author badges, inline editor names, SPA navigation on articles page
- User confirmed: **Outreach Dashboard is source of truth** - extra local editor should be deleted
- User confirmed: **External fallback** for editors without internal profiles

**Research Findings**:

- `editors.tsx` currently fetches from `/api/outreach/users` (live Outreach data), not local DB
- Navigation is mixed: some `<Link>` (SPA), some `<a href>` (full reload)
- Editor profiles exist at `editors.$editorId.tsx` expecting internal Editor.id (string)
- Backend has duplicate sync job creation issue

### Metis Review

**Identified Gaps** (addressed):

- Source of truth decision: Resolved - Outreach Dashboard is authoritative
- Missing profile fallback: Resolved - Link to external Outreach Dashboard
- Scope creep risk: Guardrails set below

---

## Work Objectives

### Core Objective

Fix the editor count mismatch and update the Editor Statistics page to display consistent, DB-backed data with proper internal navigation.

### Concrete Deliverables

- `apps/web/src/routes/editors.tsx` - Updated to use local DB data with internal links
- Local DB cleaned - Extra editor identified and removed
- Consistent SPA navigation using TanStack `<Link>`

### Definition of Done

- [x] Editor count in local DB matches Outreach Dashboard (54)
- [x] Editor Statistics page loads data from local DB endpoint
- [x] Editor links navigate to internal profiles when available, external otherwise
- [x] All navigation uses SPA (no full page reloads within app)

### Must Have

- Investigation task to find the extra editor BEFORE any code changes
- Data reconciliation (delete extra editor)
- Frontend data source change to local DB
- Internal profile links with external fallback

### Must NOT Have (Guardrails)

- ❌ NO rewriting the sync service logic beyond fixing the immediate issue
- ❌ NO changes to the database schema (Editor model)
- ❌ NO changes to other statistics pages (only editors.tsx)
- ❌ NO new features on editor profiles (linking only)
- ❌ NO changes to how Outreach Dashboard API is consumed
- ❌ NO pagination or filtering changes (existing behavior preserved)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> Every criterion uses agent-executed verification via curl, Playwright, or bash.

### Test Decision

- **Infrastructure exists**: YES (bun test available)
- **Automated tests**: NO (this is a data fix + frontend refactor, not new logic)
- **Agent-Executed QA**: ALWAYS (mandatory for all tasks)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Verification by deliverable type:
| Type | Tool | How Agent Verifies |
|------|------|-------------------|
| **Data Investigation** | Bash (curl/jq) | Query APIs, compare datasets, output diffs |
| **Data Fix** | Bash (curl) | API calls to verify counts match |
| **Frontend** | Playwright | Navigate, click links, assert navigation behavior |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
└── Task 1: Investigate editor count mismatch [no dependencies]

Wave 2 (After Wave 1):
├── Task 2: Delete extra editor [depends: 1]
└── Task 3: Update editors.tsx data source [depends: 1 - needs to know structure]

Wave 3 (After Wave 2):
└── Task 4: Add internal profile links with fallback [depends: 2, 3]

Critical Path: Task 1 → Task 2 → Task 4
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With       |
| ---- | ---------- | ------ | -------------------------- |
| 1    | None       | 2, 3   | None (investigation first) |
| 2    | 1          | 4      | 3                          |
| 3    | 1          | 4      | 2                          |
| 4    | 2, 3       | None   | None (final)               |

---

## TODOs

- [x] 1. Investigate Editor Count Mismatch

  **What to do**:
  - Fetch all editors from local DB via `/api/editors`
  - Fetch all users from Outreach Dashboard via `/api/outreach/users?school=OKA&slug=OKA`
  - Extract usernames from both sources
  - Compare and identify the extra editor(s) in local DB
  - Document the finding (username, ID, how it got there)

  **Must NOT do**:
  - Do NOT delete anything yet - investigation only
  - Do NOT modify any code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple data comparison task, no code changes
  - **Skills**: [`playwright`]
    - `playwright`: May need to check web UI state if needed
  - **Skills Evaluated but Omitted**:
    - `git-master`: No git operations needed for investigation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1 (alone)
  - **Blocks**: Tasks 2, 3, 4
  - **Blocked By**: None (can start immediately)

  **References**:

  **API Endpoint References**:
  - `apps/api/src/routes/editors.ts` - GET `/api/editors` endpoint returns all editors from DB
  - `apps/api/src/routes/outreach.ts` - GET `/api/outreach/users` proxies Outreach Dashboard

  **Why Each Reference Matters**:
  - `editors.ts`: Returns `{ success: true, data: Editor[] }` - use to get all local editors
  - `outreach.ts`: Returns Outreach Dashboard response - need to extract `.course?.users ?? .users`

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Get local editor count and list
    Tool: Bash (curl)
    Preconditions: API server running on localhost:3001
    Steps:
      1. curl -s http://localhost:3001/api/editors | jq '.data | length'
      2. curl -s http://localhost:3001/api/editors | jq '.data[].username' | sort > /tmp/local_editors.txt
      3. Assert: Count should be 54 (or current local count)
    Expected Result: List of 54 usernames saved to /tmp/local_editors.txt
    Evidence: File /tmp/local_editors.txt

  Scenario: Get Outreach Dashboard editor count and list
    Tool: Bash (curl)
    Preconditions: API server running on localhost:3001
    Steps:
      1. curl -s "http://localhost:3001/api/outreach/users?school=OKA&slug=OKA" | jq '(.course?.users // .users // .data?.course?.users // .data?.users // []) | length'
      2. curl -s "http://localhost:3001/api/outreach/users?school=OKA&slug=OKA" | jq '(.course?.users // .users // .data?.course?.users // .data?.users // []) | .[].username' | sort > /tmp/outreach_editors.txt
      3. Assert: Count should be 53
    Expected Result: List of 53 usernames saved to /tmp/outreach_editors.txt
    Evidence: File /tmp/outreach_editors.txt

  Scenario: Identify the extra editor
    Tool: Bash (diff/comm)
    Preconditions: Both files from above scenarios exist
    Steps:
      1. comm -23 /tmp/local_editors.txt /tmp/outreach_editors.txt > /tmp/extra_editors.txt
      2. cat /tmp/extra_editors.txt
      3. Assert: Should show 1 username (the extra editor)
      4. Get full details: curl -s http://localhost:3001/api/editors | jq --arg u "$(cat /tmp/extra_editors.txt | tr -d '\"')" '.data[] | select(.username == $u)'
    Expected Result: Extra editor username and full record identified
    Evidence: /tmp/extra_editors.txt and console output with editor details
  ```

  **Commit**: NO (investigation only, no code changes)

---

- [x] 2. Delete Extra Editor from Local Database

  **What to do**:
  - Use the editor ID found in Task 1
  - Call DELETE `/api/editors/:id` to remove the extra editor
  - **IMPORTANT**: DELETE is a soft-delete (sets `isActive=false`). Use `?isActive=true` filter when verifying counts.
  - Verify the count of ACTIVE editors now matches Outreach Dashboard (53)
  - Alternatively, if DELETE doesn't exist or fails, use the bulk approach: trigger a clean re-sync

  **Must NOT do**:
  - Do NOT delete multiple editors without verification
  - Do NOT modify the sync service code
  - Do NOT touch the database directly (use API only)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single API call to delete one record
  - **Skills**: `[]`
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `git-master`: No git operations needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3)
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:

  **API Endpoint References**:
  - `apps/api/src/routes/editors.ts:67-80` - DELETE `/api/editors/:id` endpoint (soft-deletes by setting isActive=false)
  - `apps/api/src/routes/outreach.ts:45-75` - POST `/api/outreach/sync` for re-sync if needed

  **Why Each Reference Matters**:
  - `editors.ts DELETE`: Primary method to remove the extra editor
  - `outreach.ts POST sync`: Fallback - can trigger full re-sync if delete doesn't work

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Delete the extra editor
    Tool: Bash (curl)
    Preconditions: Extra editor ID known from Task 1
    Steps:
      1. curl -X DELETE http://localhost:3001/api/editors/{EDITOR_ID}
      2. Assert: Response status 200 or 204
      3. curl -s "http://localhost:3001/api/editors?isActive=true" | jq '.data | length'
      4. Assert: Count of ACTIVE editors is now 53
    Expected Result: Editor soft-deleted (isActive=false), active count matches Outreach Dashboard
    Evidence: curl response and new count

  Scenario: Verify counts match after deletion
    Tool: Bash (curl)
    Preconditions: Delete completed
    Steps:
      1. LOCAL=$(curl -s "http://localhost:3001/api/editors?isActive=true" | jq '.data | length')
      2. OUTREACH=$(curl -s "http://localhost:3001/api/outreach/users?school=OKA&slug=OKA" | jq '(.course?.users // .users // .data?.course?.users // .data?.users // []) | length')
      3. Assert: $LOCAL == $OUTREACH (both should be 53)
    Expected Result: Local active editors and Outreach counts match
    Evidence: Console output showing matching counts

  Scenario: Fallback - Re-sync if delete fails
    Tool: Bash (curl)
    Preconditions: DELETE endpoint failed or editor still exists
    Steps:
      1. curl -X POST http://localhost:3001/api/outreach/sync -H "Content-Type: application/json" -d '{"school":"OKA","slug":"OKA"}'
      2. Wait 5 seconds for async sync to complete
      3. curl -s http://localhost:3001/api/editors | jq '.data | length'
      4. Assert: Count is 53 after re-sync
    Expected Result: Re-sync aligns counts
    Evidence: Sync response and final count
  ```

  **Commit**: NO (data operation only)

---

- [x] 3. Update editors.tsx to Use Local DB Data

  **What to do**:
  - Change `fetchOutreachUsers` call to use `/api/editors` (or create a new fetch function)
  - Update the component to map Editor[] instead of OutreachUser[]
  - Preserve existing column display: Username, Characters Added, References Added, Total Uploads
  - Handle missing fields gracefully (default to 0)

  **Must NOT do**:
  - Do NOT change the page layout or add new columns
  - Do NOT add pagination (keep existing behavior)
  - Do NOT modify other pages

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file frontend change, straightforward data mapping
  - **Skills**: `[]`
    - No special skills needed (simple React/TypeScript change)
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed - no visual design changes
    - `playwright`: Will be used in QA, not for implementation

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 2)
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1 (need to understand data structure)

  **References**:

  **Pattern References**:
  - `apps/web/src/routes/articles.tsx:1-50` - How useQuery is set up, TanStack Query patterns
  - `apps/web/src/routes/articles.tsx:200-250` - Table rendering pattern with null guards

  **API/Type References**:
  - `apps/web/src/lib/api.ts:Editor` - Editor type definition (id, username, isActive, source)
  - `apps/web/src/lib/api.ts:fetchEditors` - Check if exists, or create similar to fetchArticles

  **Current Implementation**:
  - `apps/web/src/routes/editors.tsx` - Current implementation using fetchOutreachUsers

  **Why Each Reference Matters**:
  - `articles.tsx`: Follow same useQuery pattern for consistency
  - `api.ts Editor`: Use this type for the new data source
  - `editors.tsx`: The file to modify

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Editors page loads with local DB data
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running on localhost:3000, API on localhost:3001
    Steps:
      1. Navigate to: http://localhost:3000/editors
      2. Wait for: table visible (timeout: 10s)
      3. Open DevTools Network tab (or intercept)
      4. Assert: Network request to /api/editors (NOT /api/outreach/users)
      5. Assert: Table has 53 rows (matching editor count)
      6. Screenshot: .sisyphus/evidence/task-3-editors-page.png
    Expected Result: Page loads editors from local DB endpoint
    Evidence: .sisyphus/evidence/task-3-editors-page.png

  Scenario: Editor data displays correctly
    Tool: Playwright (playwright skill)
    Preconditions: Editors page loaded
    Steps:
      1. Navigate to: http://localhost:3000/editors
      2. Wait for: table tbody tr visible
      3. Assert: First row has username cell (not empty)
      4. Assert: Numeric columns show numbers (not "undefined" or errors)
      5. Assert: No console errors related to .toLocaleString() on undefined
    Expected Result: All editor data renders without errors
    Evidence: Console log screenshot

  Scenario: Error handling for missing fields
    Tool: Playwright (playwright skill)
    Preconditions: Page loaded
    Steps:
      1. Navigate to: http://localhost:3000/editors
      2. Check browser console for errors
      3. Assert: No TypeError related to undefined.toLocaleString()
      4. Assert: Missing numeric fields show 0 or "-" instead of crashing
    Expected Result: Graceful handling of missing data
    Evidence: Console screenshot showing no errors
  ```

  **Commit**: YES
  - Message: `refactor(web): switch editors page to use local DB data`
  - Files: `apps/web/src/routes/editors.tsx`, `apps/web/src/lib/api.ts` (if new fetch function added)
  - Pre-commit: `bun run --filter=@oka/web build`

---

- [x] 4. Add Internal Profile Links with External Fallback

  **What to do**:
  - Replace `<a href={contribution_url}>` with TanStack `<Link>` to `/editors/$editorId`
  - Add fallback: if editor has no internal profile data, link to external contribution_url
  - Use the same pattern as articles.tsx for SPA navigation
  - Ensure hover states and styling are preserved

  **Must NOT do**:
  - Do NOT modify the editor profile page itself
  - Do NOT add new functionality to links (tooltips, etc.)
  - Do NOT change link styling

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple link replacement following existing pattern
  - **Skills**: `[]`
    - No special skills needed
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: Not needed - no visual changes
    - `playwright`: Used for QA only

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential, final task)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 2, 3

  **References**:

  **Pattern References**:
  - `apps/web/src/routes/articles.tsx:285-310` - How Link is used for editor navigation with params
  - `apps/web/src/routes/articles.tsx:1-10` - Link import from @tanstack/react-router

  **Type References**:
  - `apps/web/src/lib/api.ts:Editor` - Editor.id is the string to use as editorId param

  **Current Implementation**:
  - `apps/web/src/routes/editors.tsx` - Current implementation with `<a href={contribution_url}>`

  **Why Each Reference Matters**:
  - `articles.tsx Link pattern`: Exact pattern to copy - `<Link to="/editors/$editorId" params={{ editorId: editor.id }}>`
  - `Editor type`: Confirms editor.id is the correct field for internal links

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Internal profile link works (SPA navigation)
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, editors page loaded
    Steps:
      1. Navigate to: http://localhost:3000/editors
      2. Wait for: table visible
      3. Find first editor with internal profile (has id)
      4. Click: first editor username link
      5. Wait for: URL change (timeout: 5s)
      6. Assert: URL matches /editors/[id] pattern (e.g., /editors/cuid123...)
      7. Assert: NO full page reload (check window.performance.navigation.type or observe no loading flash)
      8. Screenshot: .sisyphus/evidence/task-4-profile-navigation.png
    Expected Result: SPA navigation to editor profile
    Evidence: .sisyphus/evidence/task-4-profile-navigation.png

  Scenario: External fallback link works
    Tool: Playwright (playwright skill)
    Preconditions: Page has editor without internal profile OR we can test with contribution_url
    Steps:
      1. Navigate to: http://localhost:3000/editors
      2. Find editor that should have external link (if any exist after data alignment)
      3. If external link exists: Assert href points to outreachdashboard.wmflabs.org or wiki URL
      4. If all internal: Assert all links use TanStack Link (no plain <a> with external href)
    Expected Result: External links work correctly OR all links are internal
    Evidence: DOM inspection screenshot

  Scenario: Navigation back to editors list
    Tool: Playwright (playwright skill)
    Preconditions: On editor profile page
    Steps:
      1. Start on editor profile page /editors/[id]
      2. Click browser back button (or navigation to /editors)
      3. Assert: Returns to /editors
      4. Assert: Table still shows 53 editors (data preserved via SPA)
    Expected Result: SPA back navigation works
    Evidence: Screenshot of returned editors list

  Scenario: No console errors during navigation
    Tool: Playwright (playwright skill)
    Preconditions: None
    Steps:
      1. Open console listener
      2. Navigate to: http://localhost:3000/editors
      3. Click: first editor link
      4. Wait for profile page
      5. Click back/navigate to /editors
      6. Assert: No console errors during entire flow
    Expected Result: Clean navigation without errors
    Evidence: Console log
  ```

  **Commit**: YES
  - Message: `feat(web): add internal profile links to editors page with external fallback`
  - Files: `apps/web/src/routes/editors.tsx`
  - Pre-commit: `bun run --filter=@oka/web build`

---

## Commit Strategy

| After Task | Message                                                                        | Files               | Verification |
| ---------- | ------------------------------------------------------------------------------ | ------------------- | ------------ |
| 3          | `refactor(web): switch editors page to use local DB data`                      | editors.tsx, api.ts | bun build    |
| 4          | `feat(web): add internal profile links to editors page with external fallback` | editors.tsx         | bun build    |

---

## Success Criteria

### Verification Commands

```bash
# Editor counts match (active editors only - DELETE is soft-delete)
curl -s "http://localhost:3001/api/editors?isActive=true" | jq '.data | length'
# Expected: 53

# Page loads without errors
bun run --filter=@oka/web build
# Expected: Build succeeds

# TypeScript compiles
bun run --filter=@oka/web typecheck
# Expected: No type errors
```

### Final Checklist

- [x] Local editor count matches Outreach Dashboard (54)
- [x] Editors page uses /api/editors endpoint
- [x] All internal editor links use TanStack `<Link>`
- [x] External fallback works for editors without profiles
- [x] No TypeScript errors
- [x] Build succeeds
- [x] No console errors during navigation
