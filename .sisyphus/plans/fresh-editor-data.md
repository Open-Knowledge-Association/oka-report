# Fresh Editor Data from Outreach API

## TL;DR

> **Quick Summary**: Delete all editors from local database and update the Editor Statistics page to fetch fresh data directly from the Outreach Dashboard API, displaying real statistics (character_sum, references_count, total_uploads).
>
> **Deliverables**:
>
> - All editors deleted from local DB
> - `editors.tsx` updated to use Outreach API with real stats
> - Editor count matches Outreach Dashboard (students only, role=0)
>
> **Estimated Effort**: Quick
> **Parallel Execution**: NO - sequential
> **Critical Path**: Task 1 (delete) → Task 2 (update frontend)

---

## Context

### Original Request

User wants to:

1. Delete all editors from the database
2. Move to using fresh data from the Outreach API
3. Fix the editor count mismatch (local shows more than Outreach Dashboard)

### Previous State

- `editors.tsx` was changed to fetch from `/api/editors` (local DB)
- All statistics were hardcoded to `0` because local Editor model doesn't have stats fields
- Local DB contains editors synced previously (including facilitators with role=1)
- Outreach Dashboard "students/overview" only shows students (role=0)

### Root Cause

1. **Count mismatch**: Local DB has ALL users including facilitators, Outreach shows only students
2. **Zero stats**: Local Editor model doesn't have `character_sum_ms`, `references_count`, `total_uploads` fields

### Solution

Revert `editors.tsx` to fetch from Outreach API (`/api/outreach/users`) which has:

- Real statistics (`character_sum_ms`, `references_count`, `total_uploads`)
- `role` field to filter for students only (role=0)

---

## Work Objectives

### Core Objective

Clean slate for editors: delete local data and use Outreach API as the single source of truth for the Editor Statistics page.

### Concrete Deliverables

- All records deleted from `editors` table
- Related records cleaned up (cascade or manual deletion)
- `apps/web/src/routes/editors.tsx` updated to fetch from Outreach API
- Statistics display real values from Outreach

### Definition of Done

- [x] `curl http://localhost:3000/api/editors` returns empty array
- [x] Editor Statistics page loads with real stats from Outreach
- [x] Editor count matches Outreach Dashboard students/overview

### Must Have

- Delete all editor records safely (handle foreign key constraints)
- Use Outreach API for real statistics
- Filter to show only students (role=0) to match Outreach Dashboard

### Must NOT Have (Guardrails)

- DO NOT leave orphaned records in related tables
- DO NOT hardcode statistics to 0
- DO NOT show facilitators (role=1) in the editor list
- DO NOT break existing navigation (Link to editor profile)

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: None for this task (quick data migration + UI fix)
- **Agent-Executed QA**: ALWAYS

### Agent-Executed QA Scenarios (MANDATORY)

**Verification Tool by Deliverable Type:**
| Type | Tool |
|------|------|
| Database cleanup | Bash (curl API) |
| Frontend display | Playwright |

---

## Execution Strategy

### Sequential Execution

```
Task 1: Delete all editors from database
    ↓
Task 2: Update editors.tsx to use Outreach API with real stats
    ↓
Task 3: Verify editor count matches Outreach Dashboard
```

### Dependency Matrix

| Task | Depends On | Blocks |
| ---- | ---------- | ------ |
| 1    | None       | 2, 3   |
| 2    | 1          | 3      |
| 3    | 2          | None   |

---

## TODOs

- [x] 1. Delete All Editors from Database

  **What to do**:
  - Create a new API endpoint `DELETE /api/editors/all` or use Prisma directly via a script
  - Delete related records first due to foreign key constraints:
    1. Delete from `outreach_article_editors` (has `editorId` FK)
    2. Delete from `contributions` (has `editorId` FK)
    3. Delete from `commons_uploads` (has `editorId` FK)
    4. Delete from `editors`
  - Alternative: Add `onDelete: Cascade` to schema, but that requires migration

  **Recommended approach**: Add a bulk delete endpoint to the API for admin operations

  **Must NOT do**:
  - Leave orphaned records
  - Delete other tables (articles, pageviews, etc.)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
    - Simple database operation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Task 1)
  - **Blocks**: Task 2, Task 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/api/src/routes/editors.ts:86-94` - Existing delete endpoint (soft delete pattern)
  - `packages/db/prisma/schema.prisma:44-53` - Editor model with relations

  **Schema References**:
  - `packages/db/prisma/schema.prisma:317-335` - OutreachArticleEditor (has `editorId` FK with CASCADE)
  - `packages/db/prisma/schema.prisma:94-138` - Contribution (has `editorId` FK, no cascade)
  - `packages/db/prisma/schema.prisma:166-198` - CommonsUpload (has `editorId` FK, no cascade)

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All editors deleted from database
    Tool: Bash (curl)
    Preconditions: API server running on localhost:3000
    Steps:
      1. Before deletion, check editor count:
         curl -s "http://localhost:3000/api/editors" | jq '.data | length'
         → Note the count (should be > 0)
      2. Execute deletion (via new endpoint or direct Prisma script)
      3. Verify editors table is empty:
         curl -s "http://localhost:3000/api/editors" | jq '.data | length'
         → Assert: equals 0
      4. Verify no orphaned OutreachArticleEditor records:
         (This should be handled by CASCADE, but verify)
    Expected Result: Zero editors in database
    Evidence: curl output showing empty data array

  Scenario: Related tables cleaned up
    Tool: Bash (curl or Prisma query)
    Preconditions: Deletion completed
    Steps:
      1. Check contributions table for orphaned records
      2. Check commons_uploads table for orphaned records
      3. Check outreach_article_editors table
    Expected Result: No orphaned records referencing deleted editors
    Evidence: Query results
  ```

  **Commit**: YES
  - Message: `chore(db): delete all editors for fresh Outreach sync`
  - Files: `apps/api/src/routes/editors.ts` (if adding endpoint)
  - Pre-commit: N/A

---

- [x] 2. Update editors.tsx to Use Outreach API with Real Stats

  **What to do**:
  - Revert `editors.tsx` to fetch from `/api/outreach/users` instead of `/api/editors`
  - Use real statistics from Outreach response:
    - `character_sum_ms` (already in response)
    - `references_count` (already in response)
    - `total_uploads` (already in response)
  - Filter for students only: `users.filter(u => u.role === 0)`
  - Update the Link component to work with Outreach user data (use username for profile lookup)

  **Must NOT do**:
  - Hardcode stats to 0
  - Show facilitators (role=1)
  - Break existing profile navigation

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
    - Simple frontend data source change

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Task 2)
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/web/src/lib/api.ts:90-108` - `OutreachUser` type and `fetchOutreachUsers` function (USE THIS)
  - `apps/web/src/routes/editors.tsx:38-44` - Current mapping (REPLACE THIS)

  **Type References**:
  - `apps/web/src/lib/api.ts:90-101` - `OutreachUser` type has all needed fields:
    ```typescript
    export type OutreachUser = {
      id: number;
      username: string;
      character_sum_ms: number;
      references_count: number;
      total_uploads: number;
      role: number; // 0 = student, 1 = facilitator
      // ...
    };
    ```

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Editor Statistics page shows real stats from Outreach
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running (API on 3000, Web on 3001)
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: table to load (no "Loading..." text)
      3. Assert: Editor count in "Total Editors" card matches Outreach Dashboard students
      4. Assert: At least one editor row has non-zero "Characters Added" value
      5. Assert: "Characters Added" total card shows non-zero value
      6. Screenshot: .sisyphus/evidence/task-2-editors-stats.png
    Expected Result: Real statistics displayed, not all zeros
    Evidence: .sisyphus/evidence/task-2-editors-stats.png

  Scenario: Only students shown (no facilitators)
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: table to load
      3. Count visible editor rows
      4. Compare with Outreach Dashboard students count (role=0 only)
         - Fetch Outreach data: curl -s "http://localhost:3000/api/outreach/users?school=OKA&slug=OKA" | jq '[.data.course.users[] | select(.role == 0)] | length'
      5. Assert: Row count matches students-only count
    Expected Result: Editor count matches Outreach Dashboard students/overview
    Evidence: Console output with counts

  Scenario: Editor profile link still works
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running, editor list loaded
    Steps:
      1. Navigate to: http://localhost:3001/editors
      2. Wait for: table to load
      3. Click: First editor username link
      4. Wait for: Navigation to /editors/$editorId
      5. Assert: Profile page loads (or handle if profile needs username-based lookup)
    Expected Result: Navigation to editor profile works
    Evidence: .sisyphus/evidence/task-2-editor-link.png
  ```

  **Commit**: YES
  - Message: `fix(web): use Outreach API for editor stats with real data`
  - Files: `apps/web/src/routes/editors.tsx`
  - Pre-commit: N/A

---

- [x] 3. Verify Editor Count Matches Outreach Dashboard

  **What to do**:
  - Compare local editor count with Outreach Dashboard
  - Verify the count matches "students/overview" page (role=0 users only)
  - Document the final count

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`playwright`]
    - Verification requires browser automation

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Task 3 - Final)
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:

  **External References**:
  - Outreach Dashboard: `https://outreachdashboard.wmflabs.org/courses/OKA/OKA/students/overview`

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Editor count matches Outreach Dashboard
    Tool: Bash + Playwright
    Preconditions: All previous tasks completed
    Steps:
      1. Get Outreach students count (role=0):
         curl -s "http://localhost:3000/api/outreach/users?school=OKA&slug=OKA" | jq '[.data.course.users[] | select(.role == 0)] | length'
         → Note the count
      2. Open http://localhost:3001/editors
      3. Get displayed "Total Editors" count from the card
      4. Assert: The two counts match exactly
    Expected Result: Local page shows same count as Outreach API (students only)
    Evidence: Screenshot + console output

  Scenario: Cross-verify with Outreach Dashboard website
    Tool: Playwright (playwright skill)
    Preconditions: Internet access available
    Steps:
      1. Navigate to: https://outreachdashboard.wmflabs.org/courses/OKA/OKA/students/overview
      2. Wait for: Page to load
      3. Extract student count from the page
      4. Compare with local /editors page count
      5. Screenshot: .sisyphus/evidence/task-3-outreach-comparison.png
    Expected Result: Counts match (or document any discrepancy)
    Evidence: .sisyphus/evidence/task-3-outreach-comparison.png
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message                                                      | Files                             | Verification           |
| ---------- | ------------------------------------------------------------ | --------------------------------- | ---------------------- |
| 1          | `chore(db): delete all editors for fresh Outreach sync`      | `apps/api/src/routes/editors.ts`  | curl API returns empty |
| 2          | `fix(web): use Outreach API for editor stats with real data` | `apps/web/src/routes/editors.tsx` | Page shows real stats  |

---

## Success Criteria

### Verification Commands

```bash
# Verify editors table is empty
curl -s "http://localhost:3000/api/editors" | jq '.data | length'
# Expected: 0

# Verify Outreach API returns students
curl -s "http://localhost:3000/api/outreach/users?school=OKA&slug=OKA" | jq '[.data.course.users[] | select(.role == 0)] | length'
# Expected: Number of students (should match page count)

# Verify page loads with stats
curl -s "http://localhost:3001/editors" | grep -o "Characters Added"
# Expected: Found in HTML
```

### Final Checklist

- [x] All editors deleted from database
- [x] No orphaned records in related tables
- [x] `editors.tsx` fetches from Outreach API
- [x] Real statistics displayed (not zeros)
- [x] Only students shown (role=0)
- [x] Editor count matches Outreach Dashboard students/overview
- [x] Editor profile links still work
