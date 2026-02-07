# Fix Pageviews Showing 0 on Articles Page

## TL;DR

> **Quick Summary**: Fix articles showing `pageviews: 0` caused by unhandled Wikimedia API 404 errors. Add per-article try/catch in `syncArticlePageviews()` to gracefully skip articles that return 404 (non-existent on Wikipedia) instead of aborting the entire sync job.
>
> **Deliverables**:
>
> - Modified `apps/api/src/services/sync.service.ts` with 404 error handling
> - New test file `apps/api/src/services/__tests__/sync.service.test.ts`
>
> **Estimated Effort**: Quick
> **Parallel Execution**: NO - sequential (2 dependent tasks)
> **Critical Path**: Task 1 → Task 2

---

## Context

### Original Request

User noticed that on `http://localhost:3001/articles`, some articles show `pageviews: 0` value.

### Interview Summary

**Key Discussions**:

- Error logs revealed: `WikimediaClientError: Wikimedia API request failed, status: 404` for certain articles (e.g., `pt.wikipedia.org` articles)
- Root cause: 404 errors from Wikimedia API abort entire sync job, leaving no pageview rows for affected articles
- Frontend displays 0 when `pageviews` array is empty (correct fallback behavior)

**Research Findings**:

- `WikimediaClient.request()` throws `WikimediaClientError` on non-OK responses (line 100-104 in `client.ts`)
- `syncArticlePageviews()` has NO per-article try/catch (lines 206-244 in `sync.service.ts`)
- `OutreachArticleSyncService` uses `Promise.allSettled` pattern for resilience - established codebase pattern
- `WikimediaClientError` is exported from `@repo/utils` (line 3 in `packages/utils/index.ts`)

### Metis Review

**Identified Gaps** (addressed):

- Error scope question: Catch only 404 (article doesn't exist), let other errors (500, network) propagate
- Logging level: Use `console.warn` (auditable but not alarming)
- Future tracking: Out of scope for this fix (no DB schema changes)

---

## Work Objectives

### Core Objective

Prevent Wikimedia API 404 errors from aborting the entire pageview sync job. Articles that return 404 should be skipped gracefully, allowing other articles to sync successfully.

### Concrete Deliverables

- `apps/api/src/services/sync.service.ts` - Modified with per-article error handling
- `apps/api/src/services/__tests__/sync.service.test.ts` - New test file for sync service

### Definition of Done

- [x] `bun test apps/api/src/services/__tests__/sync.service.test.ts` passes with all test cases
- [x] 404 errors log warning and continue to next article
- [x] Non-404 errors still propagate (sync job fails)
- [x] Existing behavior unchanged for successful syncs

### Must Have

- Per-article try/catch around `getPageviews()` call
- Check for `WikimediaClientError` with status 404 specifically
- Warning log with article identifiers: `{ articleId, title, wikiProject }`
- Continue to next article on 404 (don't abort loop)

### Must NOT Have (Guardrails)

- DO NOT modify `packages/utils/src/wikimedia/client.ts` - error handling belongs at service layer
- DO NOT modify `packages/utils/src/wikimedia/pageviews.ts` - breaks API contract
- DO NOT add database schema changes - out of scope
- DO NOT catch non-404 errors silently - let them propagate
- DO NOT use `Promise.allSettled` - changes concurrency model, simple try/catch preserves sequential semantics
- DO NOT add retry logic for 404s - 404 means article doesn't exist, retrying won't help

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> The executing agent verifies using `bun test` commands only.

### Test Decision

- **Infrastructure exists**: YES (bun:test already used in project)
- **Automated tests**: YES (TDD)
- **Framework**: bun:test

### Test Pattern Reference

Follow existing pattern from `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts`:

- Mock `PrismaClient` with `mock()` functions
- Mock `WikimediaClient` similarly
- Use `describe/it/expect/beforeEach` from `bun:test`

---

## Execution Strategy

### Execution Order

```
Task 1: Add 404 error handling to syncArticlePageviews
  └─ Depends on: None

Task 2: Add unit tests for sync.service.ts
  └─ Depends on: Task 1
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 2      | None                 |
| 2    | 1          | None   | None                 |

### Agent Dispatch Summary

| Order | Task | Recommended Agent                               |
| ----- | ---- | ----------------------------------------------- |
| 1     | 1    | delegate_task(category="quick", load_skills=[]) |
| 2     | 2    | delegate_task(category="quick", load_skills=[]) |

---

## TODOs

- [x] 1. Add 404 error handling to syncArticlePageviews

  **What to do**:
  - Import `WikimediaClientError` from `@repo/utils` at top of file
  - Wrap the `getPageviews()` call (lines 213-218) in try/catch block
  - Catch `WikimediaClientError` specifically and check for `status === 404`
  - On 404: log warning with article details, use `continue` to skip to next article
  - On non-404 error: re-throw to preserve existing failure behavior

  **Implementation**:

  ```typescript
  // At top of file, add to existing imports:
  import { WikimediaClientError } from "@repo/utils";

  // In syncArticlePageviews(), wrap getPageviews call:
  for (const article of articles) {
    if (jobId && (await this.checkCancelled(jobId))) {
      return syncedCount;
    }

    const startDate = since ?? article.articleCreatedAt ?? new Date();
    const endDate = new Date();

    let pageviews: Array<{ date: string; views: number }>;
    try {
      pageviews = await this.wikimediaClient.getPageviews(
        article.title,
        toPageviewsProject(article.wikiProject),
        formatDateForPageviews(startDate),
        formatDateForPageviews(endDate),
      );
    } catch (error) {
      if (error instanceof WikimediaClientError && error.status === 404) {
        console.warn(
          `Pageviews unavailable for article "${article.title}" (${article.id}) on ${article.wikiProject}: 404 Not Found`,
        );
        continue; // Skip this article, proceed to next
      }
      throw error; // Re-throw non-404 errors
    }

    for (const item of pageviews) {
      // ... existing upsert logic unchanged ...
    }
  }
  ```

  **Must NOT do**:
  - DO NOT catch errors globally (must be per-article)
  - DO NOT catch non-404 errors
  - DO NOT modify WikimediaClient or pageviews.ts

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file modification, clear implementation pattern, < 30 lines changed
  - **Skills**: `[]`
    - Reason: No specialized skills needed for this straightforward code change

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `apps/api/src/services/sync.service.ts:196-244` - Current syncArticlePageviews method that needs modification
  - `apps/api/src/services/sync.service.ts:213-218` - Exact location of getPageviews call to wrap

  **API/Type References**:
  - `packages/utils/src/wikimedia/client.ts:36-50` - WikimediaClientError class definition with `status` property
  - `packages/utils/index.ts:3` - Export of WikimediaClientError from @repo/utils

  **Test References**:
  - `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts:405-464` - Error handling test patterns to follow

  **WHY Each Reference Matters**:
  - `sync.service.ts:213-218`: This is the EXACT code to wrap in try/catch
  - `client.ts:36-50`: Shows WikimediaClientError has `status` property for checking 404
  - `index.ts:3`: Confirms import path as `@repo/utils`

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios (MANDATORY):**

  ```
  Scenario: Verify import statement added
    Tool: Bash (grep)
    Steps:
      1. grep "WikimediaClientError" apps/api/src/services/sync.service.ts
      2. Assert: Output contains import from "@repo/utils"
    Expected Result: Import statement present at top of file
    Evidence: grep output

  Scenario: Verify try/catch structure exists
    Tool: Bash (grep)
    Steps:
      1. grep -A5 "try {" apps/api/src/services/sync.service.ts | grep "getPageviews"
      2. Assert: getPageviews call is inside try block
    Expected Result: try/catch wraps getPageviews call
    Evidence: grep output

  Scenario: Verify 404 check exists
    Tool: Bash (grep)
    Steps:
      1. grep "status === 404" apps/api/src/services/sync.service.ts
      2. Assert: Output contains the 404 status check
    Expected Result: Specific 404 handling logic present
    Evidence: grep output

  Scenario: Verify console.warn with article info
    Tool: Bash (grep)
    Steps:
      1. grep -E "console.warn.*article" apps/api/src/services/sync.service.ts
      2. Assert: Warning includes article title and 404 message
    Expected Result: Descriptive warning log present
    Evidence: grep output

  Scenario: TypeScript compiles without errors
    Tool: Bash
    Steps:
      1. cd apps/api && bun run tsc --noEmit
      2. Assert: Exit code 0
    Expected Result: No type errors
    Evidence: Command output / exit code
  ```

  **Commit**: YES
  - Message: `fix(api): handle 404 errors gracefully in pageview sync`
  - Files: `apps/api/src/services/sync.service.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

- [x] 2. Add unit tests for sync.service.ts 404 handling

  **What to do**:
  - Create new test file `apps/api/src/services/__tests__/sync.service.test.ts`
  - Mock `PrismaClient` and `WikimediaClient` following outreach-article-sync pattern
  - Test case 1: Single article returns 404 → sync completes with 0 pageviews synced
  - Test case 2: Middle article returns 404 → other articles synced successfully
  - Test case 3: Non-404 error (e.g., 500) → error propagates, sync fails
  - Test case 4: All articles return 404 → sync completes with 0 pageviews

  **Must NOT do**:
  - DO NOT test unrelated sync service functionality
  - DO NOT add integration tests (unit tests only)
  - DO NOT modify existing test files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: New test file following established patterns, well-documented requirements
  - **Skills**: `[]`
    - Reason: Standard test patterns already established in codebase

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 1)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts:1-71` - Test file structure, imports, beforeEach setup
  - `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts:443-464` - Error handling test pattern (how to make mock throw)

  **API/Type References**:
  - `apps/api/src/services/sync.service.ts:38-42` - SyncService constructor signature (prisma, wikimediaClient)
  - `packages/utils/src/wikimedia/client.ts:36-50` - WikimediaClientError for throwing in mocks

  **Test References**:
  - `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts` - Full test file as template

  **WHY Each Reference Matters**:
  - `outreach-article-sync.service.test.ts:1-71`: Copy the mock setup pattern exactly
  - `outreach-article-sync.service.test.ts:443-464`: Shows how to make mocks throw errors for testing
  - `sync.service.ts:38-42`: Constructor params to know what to mock

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios (MANDATORY):**

  ```
  Scenario: Test file exists and compiles
    Tool: Bash
    Steps:
      1. test -f apps/api/src/services/__tests__/sync.service.test.ts
      2. Assert: File exists (exit code 0)
      3. cd apps/api && bun run tsc --noEmit
      4. Assert: Compiles without errors
    Expected Result: Test file created and valid TypeScript
    Evidence: Command outputs

  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. cd apps/api && bun test src/services/__tests__/sync.service.test.ts
      2. Assert: All tests pass (exit code 0)
      3. Assert: Output shows 4+ test cases
    Expected Result: All 404 handling tests pass
    Evidence: Test output with pass count

  Scenario: 404 test case exists
    Tool: Bash (grep)
    Steps:
      1. grep "404" apps/api/src/services/__tests__/sync.service.test.ts
      2. Assert: Multiple references to 404 handling
    Expected Result: 404 test scenarios present
    Evidence: grep output

  Scenario: Error propagation test exists
    Tool: Bash (grep)
    Steps:
      1. grep -E "(500|propagate|throw|non-404)" apps/api/src/services/__tests__/sync.service.test.ts
      2. Assert: Non-404 error test present
    Expected Result: Test for error propagation exists
    Evidence: grep output
  ```

  **Commit**: YES
  - Message: `test(api): add unit tests for pageview sync 404 handling`
  - Files: `apps/api/src/services/__tests__/sync.service.test.ts`
  - Pre-commit: `bun test apps/api/src/services/__tests__/sync.service.test.ts`

---

## Commit Strategy

| After Task | Message                                                    | Files                | Verification           |
| ---------- | ---------------------------------------------------------- | -------------------- | ---------------------- |
| 1          | `fix(api): handle 404 errors gracefully in pageview sync`  | sync.service.ts      | `bun run tsc --noEmit` |
| 2          | `test(api): add unit tests for pageview sync 404 handling` | sync.service.test.ts | `bun test`             |

---

## Success Criteria

### Verification Commands

```bash
# TypeScript compilation
cd apps/api && bun run tsc --noEmit  # Expected: exit 0, no errors

# Run new tests
bun test apps/api/src/services/__tests__/sync.service.test.ts  # Expected: all tests pass

# Run all API tests (regression check)
cd apps/api && bun test  # Expected: all tests pass
```

### Final Checklist

- [x] Import of `WikimediaClientError` added to sync.service.ts
- [x] try/catch wraps `getPageviews()` call
- [x] 404 errors logged with `console.warn` and article details
- [x] Non-404 errors re-thrown (propagate to caller)
- [x] Test file created with 4+ test cases
- [x] All tests pass
- [x] TypeScript compiles without errors
- [x] No changes to `packages.utils/`
