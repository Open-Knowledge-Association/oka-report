# Fix Article Sync Field Name Mismatch

## TL;DR

> **Quick Summary**: Fix field name mismatch bug in `outreach-sync.service.ts` where snake_case fields (`character_sum`, `references_count`, `new_article`) should be camelCase (`characterSum`, `referencesCount`, `isNewArticle`) to match Prisma schema.
>
> **Deliverables**:
>
> - Fixed field mappings in `outreach-sync.service.ts` lines 154-156 and 164-166
> - Verified sync populates articles in database
>
> **Estimated Effort**: Quick (< 30 min)
> **Parallel Execution**: NO - sequential
> **Critical Path**: Task 1 (fix) → Task 2 (verify)

---

## Context

### Original Request

User reported articles page showing empty data. Investigation revealed sync job completed but stored 0 articles due to Prisma field name errors.

### Interview Summary

**Key Findings**:

- Sync job `cml7jsegf00002gjg4jx0uzzk` shows 46,860 errors with message: `Unknown argument 'character_sum'. Did you mean 'characterSum'?`
- Database has 0 articles despite sync completing
- Root cause: snake_case vs camelCase field name mismatch

**Research Findings**:

- Prisma schema uses camelCase: `characterSum Int`, `referencesCount Int`, `isNewArticle Boolean`
- Outreach Dashboard API returns snake_case: `character_sum`, `references_count`, `new_article`
- There are TWO sync services - `OutreachSyncService` (broken) and `OutreachArticleSyncService` (correct but unused by routes)

### Metis Review

**Identified Gaps** (addressed):

- Duplicate service files exist - will NOT consolidate (scope creep)
- Other service already has correct camelCase - confirms the pattern to follow
- Routes use the broken `OutreachSyncService` - confirmed via grep

---

## Work Objectives

### Core Objective

Fix the 6 field name mappings in `outreach-sync.service.ts` so articles sync correctly to database.

### Concrete Deliverables

- Modified `apps/api/src/services/outreach-sync.service.ts` with correct camelCase field names

### Definition of Done

- [x] Field names corrected (6 changes)
- [x] Sync endpoint returns 0 errors (or significantly reduced)
- [x] Database contains articles after sync
- [x] Unit tests pass

### Must Have

- Change `character_sum` → `characterSum` (2 occurrences)
- Change `references_count` → `referencesCount` (2 occurrences)
- Change `new_article` → `isNewArticle` (2 occurrences)

### Must NOT Have (Guardrails)

- DO NOT touch `outreach-article-sync.service.ts` (it's already correct)
- DO NOT consolidate or refactor the duplicate services
- DO NOT change API type definitions (snake_case is correct there)
- DO NOT add new mapper functions - direct mapping only

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks MUST be verifiable WITHOUT any human action.

### Test Decision

- **Infrastructure exists**: YES (bun test)
- **Automated tests**: Tests-after (verify existing tests still pass)
- **Framework**: bun test

### Agent-Executed QA Scenarios (MANDATORY)

**Verification Tool by Deliverable Type:**

| Type            | Tool               | How Agent Verifies                |
| --------------- | ------------------ | --------------------------------- |
| **Code Fix**    | Edit tool          | Replace snake_case with camelCase |
| **API/Backend** | Bash (curl)        | Trigger sync, check response      |
| **Database**    | Bash (curl to API) | Query articles count via API      |

---

## Execution Strategy

### Sequential Execution

```
Task 1: Fix field name mappings in outreach-sync.service.ts
    │
    ▼
Task 2: Verify fix - run unit tests
    │
    ▼
Task 3: Trigger article sync and verify database populated
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 2, 3   | None                 |
| 2    | 1          | 3      | None                 |
| 3    | 2          | None   | None                 |

### Agent Dispatch Summary

| Task | Recommended Agent                                    |
| ---- | ---------------------------------------------------- |
| 1    | delegate_task(category="quick", load_skills=[], ...) |
| 2    | delegate_task(category="quick", load_skills=[], ...) |
| 3    | delegate_task(category="quick", load_skills=[], ...) |

---

## TODOs

- [x] 1. Fix field name mappings in outreach-sync.service.ts

  **What to do**:
  - Open `apps/api/src/services/outreach-sync.service.ts`
  - In the `create` block (lines ~154-157), change:
    - `character_sum:` → `characterSum:`
    - `references_count:` → `referencesCount:`
    - `new_article:` → `isNewArticle:`
  - In the `update` block (lines ~164-167), change the same 3 fields
  - Total: 6 field name changes

  **Must NOT do**:
  - Do NOT modify the values (keep `article.character_sum`, `article.references_count`, `article.new_article`)
  - Do NOT touch `outreach-article-sync.service.ts`

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple find-replace, single file, < 10 lines changed
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 2, 3
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/api/src/services/outreach-article-sync.service.ts:54-56` - Correct camelCase mapping pattern to follow

  **API/Type References**:
  - `packages/db/prisma/schema.prisma` - OutreachArticle model with camelCase fields

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Field names are correctly changed to camelCase
    Tool: Bash (grep)
    Preconditions: File exists
    Steps:
      1. grep -n "characterSum" apps/api/src/services/outreach-sync.service.ts
      2. Assert: Output shows 2 lines (create and update blocks)
      3. grep -n "referencesCount" apps/api/src/services/outreach-sync.service.ts
      4. Assert: Output shows 2 lines
      5. grep -n "isNewArticle" apps/api/src/services/outreach-sync.service.ts
      6. Assert: Output shows 2 lines
      7. grep -n "character_sum:" apps/api/src/services/outreach-sync.service.ts
      8. Assert: No output (snake_case keys removed)
    Expected Result: All 6 field names changed to camelCase
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `fix(api): correct field name mapping in article sync service`
  - Files: `apps/api/src/services/outreach-sync.service.ts`
  - Pre-commit: None

---

- [x] 2. Verify unit tests still pass

  **What to do**:
  - Run existing unit tests to ensure no regressions
  - Check that the fix doesn't break other functionality

  **Must NOT do**:
  - Do NOT add new tests (out of scope)
  - Do NOT modify test files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Just running existing tests
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:

  **Test References**:
  - `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts` - Existing article sync tests

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Unit tests pass
    Tool: Bash (bun test)
    Preconditions: Dependencies installed, fix applied
    Steps:
      1. cd /home/rio/Works/oka/report
      2. bun test apps/api/src/services/__tests__/
      3. Assert: Exit code 0
      4. Assert: Output contains "passed" or no "failed"
    Expected Result: All existing tests pass
    Evidence: Test output captured
  ```

  **Commit**: NO (grouped with Task 1)

---

- [x] 3. Trigger article sync and verify database populated

  **What to do**:
  - Ensure API server is running
  - Trigger article sync via POST endpoint
  - Verify articles are now in database via GET endpoint

  **Must NOT do**:
  - Do NOT modify sync service further
  - Do NOT attempt full 46K sync if server is slow (test with small sample)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Just API calls to verify
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None
  - **Blocked By**: Task 1, 2

  **References**:

  **API References**:
  - `apps/api/src/routes/outreach.ts` - POST /api/outreach/articles/sync endpoint
  - `apps/api/src/routes/outreach.ts` - GET /api/outreach/articles/db endpoint

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Article sync succeeds without errors
    Tool: Bash (curl)
    Preconditions: API server running on localhost:3000, fix applied
    Steps:
      1. curl -s -X POST "http://localhost:3000/api/outreach/articles/sync" \
           -H "Content-Type: application/json" \
           -d '{"school":"OKA","slug":"OKA"}'
      2. Assert: Response contains "success": true
      3. Wait 5 seconds for sync to process
      4. Query sync job status or check metadata
    Expected Result: Sync job accepted and completes without mass errors
    Evidence: curl response captured

  Scenario: Database now contains articles
    Tool: Bash (curl)
    Preconditions: Sync completed
    Steps:
      1. curl -s "http://localhost:3000/api/outreach/articles/db?limit=5" | jq '.data.pagination.total'
      2. Assert: total > 0 (articles exist in database)
      3. curl -s "http://localhost:3000/api/outreach/articles/db?limit=1" | jq '.data.articles[0].title'
      4. Assert: title is not null/empty
    Expected Result: Articles are queryable from database
    Evidence: Article count and sample captured
  ```

  **Commit**: NO (no code changes)

---

## Commit Strategy

| After Task | Message                                                        | Files                    | Verification |
| ---------- | -------------------------------------------------------------- | ------------------------ | ------------ |
| 1          | `fix(api): correct field name mapping in article sync service` | outreach-sync.service.ts | bun test     |

---

## Success Criteria

### Verification Commands

```bash
# 1. Verify field names changed
grep -c "characterSum" apps/api/src/services/outreach-sync.service.ts
# Expected: 2

# 2. Verify no snake_case keys remain
grep -c "character_sum:" apps/api/src/services/outreach-sync.service.ts
# Expected: 0

# 3. Unit tests pass
bun test apps/api/src/services/__tests__/

# 4. Articles exist in database after sync
curl -s "http://localhost:3000/api/outreach/articles/db" | jq '.data.pagination.total'
# Expected: > 0
```

### Final Checklist

- [x] All "Must Have" changes present (6 field name fixes)
- [x] All "Must NOT Have" absent (no changes to other files)
- [x] Unit tests pass
- [x] Articles appear in database after sync

---

## Follow-Up Issues (Out of Scope)

Create issues for future work:

1. **Consolidate duplicate OutreachSync services** - `OutreachSyncService` and `OutreachArticleSyncService` have overlapping functionality
2. **Add unit tests for OutreachSyncService.syncArticlesFromDashboard** - Currently only `OutreachArticleSyncService` has tests
