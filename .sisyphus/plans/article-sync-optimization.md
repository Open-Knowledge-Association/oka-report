# Article Sync Optimization: Re-sync, Performance, and Scheduling

## TL;DR

> **Quick Summary**: Re-sync all 46,860 articles from Outreach Dashboard, optimize sync performance with batching/concurrency/progress tracking, and set up scheduled daily syncing.
>
> **Deliverables**:
>
> - Optimized `OutreachArticleSyncService` with batch processing (100 articles/batch, 5 concurrent)
> - Progress tracking in `sync_jobs.metadata` with checkpoint every 1000 articles
> - Duplicate job prevention (409 if sync already running)
> - Scheduled article sync in `scheduler.ts` (daily at 03:00 UTC)
> - Environment variables for configuration
> - Full sync execution to populate all 46K articles
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (dependencies) → Task 2 (optimize service) → Task 3 (scheduler) → Task 4 (run sync)

---

## Context

### Original Request

User identified article count discrepancy:

- **Outreach Dashboard (Live)**: 46,860 articles
- **Local Database**: 12,924 articles
- **Missing**: 33,936 articles (73% of data!)

User requested three priorities:

1. Re-sync all articles from Outreach Dashboard
2. Optimize sync performance for 46K+ articles
3. Set up scheduled syncing for automatic updates

### Interview Summary

**Key Discussions**:

- Current implementation processes articles sequentially with individual upserts - estimated 23-38 minutes for 46K articles
- Need batch processing with concurrency control
- Need progress tracking for resumability and monitoring
- Scheduled sync should be separate from existing full sync (runs at 02:00)

**Research Findings**:

- Existing scheduler uses node-cron (default: `0 2 * * *` for full sync)
- `school=OKA`, `slug=OKA` (from existing code in `apps/web/src/lib/api.ts`)
- SyncJob model has `metadata` JSON field for progress tracking
- `p-limit` already in lockfile (no new dependencies needed)
- Existing pattern: `POST /api/outreach/articles/sync` for manual trigger

### Metis Review

**Identified Gaps** (addressed):

- School/slug values: Found in codebase (`OKA`/`OKA`)
- Concurrent sync prevention: Adding 409 guard
- Editor pre-fetch optimization: Pre-loading editors into Map
- Environment variables: Adding for configuration
- Performance target: < 30 minutes for full sync

---

## Work Objectives

### Core Objective

Optimize the article sync service to handle 46K+ articles efficiently with batching, progress tracking, and scheduled execution.

### Concrete Deliverables

- Refactored `apps/api/src/services/outreach-article-sync.service.ts`
- Updated `apps/api/src/jobs/scheduler.ts` with article sync cron
- Environment variables: `OUTREACH_SCHOOL`, `OUTREACH_SLUG`, `OUTREACH_ARTICLE_SYNC_SCHEDULE`
- Full sync execution with 46K+ articles in database

### Definition of Done

- [x] Sync completes in < 30 minutes for 46K articles
- [x] Progress visible via `/api/sync/history` during sync
- [x] Duplicate sync returns 409 Conflict
- [x] Scheduled sync runs daily at 03:00 UTC
- [x] Article count via `/api/outreach/articles/stats` shows >= 46,000
- [x] All tests pass

### Must Have

- Batch processing with configurable batch size (default: 100)
- Concurrency control with p-limit (default: 5 concurrent batches)
- Progress tracking in sync_jobs.metadata every 1000 articles
- Duplicate job prevention (return 409 if sync already running)
- Editor pre-fetch optimization (Map<externalId, Editor>)
- Scheduled cron job (default: 03:00 UTC daily)
- Environment variable configuration

### Must NOT Have (Guardrails)

- ❌ New npm dependencies (use existing p-limit)
- ❌ New API endpoints (use existing `/api/outreach/articles/sync`)
- ❌ Database schema changes (use existing metadata JSON field)
- ❌ WebSocket/SSE for progress (use polling via `/api/sync/history`)
- ❌ Incremental sync (Outreach API doesn't support change detection)
- ❌ UI progress indicators (out of scope)
- ❌ Worker queue architecture (future enhancement)
- ❌ Retry queue for failed articles (collect errors, re-run full sync)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision

- **Infrastructure exists**: YES (bun test in apps/api)
- **Automated tests**: Tests-after (update existing test file)
- **Framework**: bun test

### Agent-Executed QA Scenarios (MANDATORY)

All verifications use curl for API testing and bash for command execution.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add environment variables and types
└── Task 2: Refactor OutreachArticleSyncService (can start prep)

Wave 2 (After Wave 1):
├── Task 3: Add duplicate job prevention
└── Task 4: Update scheduler with article sync cron

Wave 3 (After Wave 2):
├── Task 5: Add/update tests
└── Task 6: Execute full sync and verify

Critical Path: Task 1 → Task 2 → Task 4 → Task 6
```

### Dependency Matrix

| Task | Depends On | Blocks  | Can Parallelize With |
| ---- | ---------- | ------- | -------------------- |
| 1    | None       | 2, 3, 4 | -                    |
| 2    | 1          | 3, 5, 6 | -                    |
| 3    | 2          | 6       | 4                    |
| 4    | 1          | 6       | 3                    |
| 5    | 2          | 6       | 3, 4                 |
| 6    | 3, 4, 5    | None    | -                    |

---

## TODOs

### Task 1: Add Environment Variables and Types

- [x] 1. Configure environment variables and progress types

  **What to do**:
  - Add environment variables to `.env.example` (if exists) or document:
    - `OUTREACH_SCHOOL` (default: "OKA")
    - `OUTREACH_SLUG` (default: "OKA")
    - `OUTREACH_ARTICLE_SYNC_SCHEDULE` (default: "0 3 \* \* \*")
  - Create TypeScript interface for sync progress in the service file:
    ```typescript
    interface SyncProgress {
      totalExpected: number;
      processed: number;
      lastProcessedIndex: number;
      errors: number;
    }
    ```

  **Must NOT do**:
  - Don't create new config files
  - Don't add new npm dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file additions, clear pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundation task)
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 2, 3, 4
  - **Blocked By**: None

  **References**:
  - `apps/api/src/jobs/scheduler.ts:5-8` - Existing env pattern with `process.env.SYNC_SCHEDULE ?? "0 2 * * *"`
  - `apps/api/src/services/outreach-article-sync.service.ts:4-9` - Current SyncResult interface

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Types compile without errors
    Tool: Bash
    Steps:
      1. cd apps/api && bun run build 2>&1 || true
      2. Assert: No TypeScript errors related to SyncProgress
    Expected Result: Build succeeds or only unrelated errors
    Evidence: Build output captured
  ```

  **Commit**: YES
  - Message: `feat(api): add environment variables and types for article sync optimization`
  - Files: `apps/api/src/services/outreach-article-sync.service.ts`
  - Pre-commit: `cd apps/api && bun test`

---

### Task 2: Refactor OutreachArticleSyncService with Batching and Progress

- [x] 2. Optimize sync service with batching, concurrency, and progress tracking

  **What to do**:
  - Import `pLimit` from `p-limit`
  - Add configuration constants:
    ```typescript
    const BATCH_SIZE = 100;
    const CONCURRENCY = 5;
    const CHECKPOINT_INTERVAL = 1000;
    ```
  - Pre-fetch all editors into `Map<string, Editor>` before processing
  - Implement `chunkArray<T>(array: T[], size: number): T[][]` helper
  - Refactor `syncArticlesFromDashboard`:
    1. Create sync job with initial progress in metadata
    2. Fetch all articles from dashboard (single API call)
    3. Pre-fetch all editors: `prisma.editor.findMany()` → Map by externalId
    4. Process articles in batches using p-limit:
       - Use `Promise.allSettled` for error resilience
       - Update progress in metadata every CHECKPOINT_INTERVAL
    5. Store final results in job metadata
  - Extract `processArticleBatch` method for clarity
  - Handle individual article errors gracefully (collect, don't throw)

  **Must NOT do**:
  - Don't use `bottleneck` (use p-limit which is already available)
  - Don't add retry logic for individual articles
  - Don't modify the API endpoint behavior

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex refactoring with multiple interconnected changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Wave 1 (sequential after Task 1)
  - **Blocks**: Tasks 3, 5, 6
  - **Blocked By**: Task 1

  **References**:
  - `apps/api/src/services/outreach-article-sync.service.ts` - Current implementation to refactor
  - `apps/api/src/services/sync.service.ts:142-170` - Job lifecycle pattern (createSyncJob, startSyncJob, completeSyncJob)
  - `packages/utils/src/wikimedia/rate-limiter.ts` - Rate limiter pattern (optional reference)
  - `node_modules/p-limit/index.d.ts` - p-limit types (verify import syntax)

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Service compiles without errors
    Tool: Bash
    Steps:
      1. cd apps/api && bun run build
      2. Assert: Exit code 0
    Expected Result: TypeScript compilation succeeds
    Evidence: Build output

  Scenario: Batch processing works correctly (unit test level)
    Tool: Bash
    Steps:
      1. cd apps/api && bun test --grep "sync"
      2. Assert: Tests pass
    Expected Result: Sync-related tests pass
    Evidence: Test output

  Scenario: Progress is tracked in metadata
    Tool: Bash (curl) - Run after Task 6 executes sync
    Steps:
      1. During sync, poll: curl -s http://localhost:3000/api/sync/history?jobType=outreach_articles | jq '.data[0].metadata'
      2. Assert: metadata contains "processed" and "totalExpected" fields
      3. Assert: processed increases over time
    Expected Result: Progress visible in job metadata
    Evidence: API response showing progress fields
  ```

  **Commit**: YES
  - Message: `feat(api): optimize article sync with batching, concurrency, and progress tracking`
  - Files: `apps/api/src/services/outreach-article-sync.service.ts`
  - Pre-commit: `cd apps/api && bun test`

---

### Task 3: Add Duplicate Job Prevention

- [x] 3. Prevent concurrent syncs by checking for running jobs

  **What to do**:
  - At the start of `syncArticlesFromDashboard`, check for existing running job:
    ```typescript
    const runningJob = await this.prisma.syncJob.findFirst({
      where: {
        jobType: "outreach_articles",
        status: "running",
      },
    });
    if (runningJob) {
      throw new Error(`Sync already in progress (job ID: ${runningJob.id})`);
    }
    ```
  - Update the route handler in `outreach.ts` to catch this error and return 409:
    ```typescript
    if (error.message.includes("Sync already in progress")) {
      return c.json({ success: false, error: error.message }, 409);
    }
    ```

  **Must NOT do**:
  - Don't add new API endpoints
  - Don't change success response format

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Small, focused change
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: Task 2

  **References**:
  - `apps/api/src/services/outreach-article-sync.service.ts:20-35` - Start of syncArticlesFromDashboard
  - `apps/api/src/routes/outreach.ts:164-245` - POST /articles/sync handler with error handling

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Second sync request returns 409 while sync is running
    Tool: Bash (curl)
    Preconditions: API server running, a sync is in progress
    Steps:
      1. Start a sync (or mock a running job in DB)
      2. curl -s -X POST http://localhost:3000/api/outreach/articles/sync \
           -H "Content-Type: application/json" \
           -d '{"school":"OKA","slug":"OKA"}' \
           -w "\n%{http_code}"
      3. Assert: HTTP status is 409
      4. Assert: Response contains "Sync already in progress"
    Expected Result: 409 Conflict returned
    Evidence: Response body and status code

  Scenario: Sync starts normally when no job running
    Tool: Bash (curl)
    Preconditions: No running sync jobs
    Steps:
      1. Ensure no running jobs: Check /api/sync/history
      2. curl -s -X POST http://localhost:3000/api/outreach/articles/sync \
           -H "Content-Type: application/json" \
           -d '{"school":"OKA","slug":"OKA"}' \
           -w "\n%{http_code}"
      3. Assert: HTTP status is 200 or 202
      4. Assert: Response contains jobId
    Expected Result: Sync starts successfully
    Evidence: Response with job ID
  ```

  **Commit**: YES (group with Task 4)
  - Message: `feat(api): add duplicate job prevention for article sync`
  - Files: `apps/api/src/services/outreach-article-sync.service.ts`, `apps/api/src/routes/outreach.ts`
  - Pre-commit: `cd apps/api && bun test`

---

### Task 4: Add Scheduled Article Sync to Scheduler

- [x] 4. Configure scheduler to run article sync daily

  **What to do**:
  - Import `OutreachArticleSyncService` in scheduler.ts
  - Import `OutreachDashboardClient` from utils
  - Read environment variables:
    ```typescript
    const outreachSchool = process.env.OUTREACH_SCHOOL ?? "OKA";
    const outreachSlug = process.env.OUTREACH_SLUG ?? "OKA";
    const outreachSchedule = process.env.OUTREACH_ARTICLE_SYNC_SCHEDULE ?? "0 3 * * *";
    ```
  - Add second cron job for article sync:
    ```typescript
    cron.schedule(outreachSchedule, async () => {
      console.log(
        `[Scheduler] Starting outreach article sync (school=${outreachSchool}, slug=${outreachSlug})`,
      );
      try {
        const result = await outreachArticleSyncService.syncArticlesFromDashboard(
          outreachSchool,
          outreachSlug,
        );
        console.log(
          `[Scheduler] Outreach article sync completed: ${result.imported} imported, ${result.updated} updated, ${result.errors} errors`,
        );
      } catch (error) {
        console.error("[Scheduler] Outreach article sync failed:", error);
      }
    });
    ```
  - Add startup log: `console.log(\`[Scheduler] Outreach article sync scheduled: ${outreachSchedule}\`);`

  **Must NOT do**:
  - Don't change the existing full sync schedule
  - Don't add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Following existing pattern in same file
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 3)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `apps/api/src/jobs/scheduler.ts` - Existing scheduler implementation
  - `apps/api/src/services/outreach-article-sync.service.ts` - Service to call
  - `packages/utils/src/outreach-dashboard/client.ts` - Dashboard client

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Scheduler logs article sync schedule on startup
    Tool: Bash
    Steps:
      1. Start API server and capture startup logs
      2. grep for "Outreach article sync scheduled"
      3. Assert: Log contains the schedule pattern
    Expected Result: Schedule logged on startup
    Evidence: Startup log output

  Scenario: TypeScript compiles with scheduler changes
    Tool: Bash
    Steps:
      1. cd apps/api && bun run build
      2. Assert: Exit code 0
    Expected Result: No compilation errors
    Evidence: Build output
  ```

  **Commit**: YES (group with Task 3)
  - Message: `feat(api): add scheduled outreach article sync (daily 03:00 UTC)`
  - Files: `apps/api/src/jobs/scheduler.ts`
  - Pre-commit: `cd apps/api && bun test`

---

### Task 5: Add/Update Tests

- [x] 5. Add tests for optimized sync service

  **What to do**:
  - Update existing test file `apps/api/src/__tests__/api.test.ts`:
    - Add test for duplicate job prevention (409 response)
    - Add test verifying progress metadata structure
  - Optionally update `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts`:
    - Test batch processing logic
    - Test error collection (individual article failures don't stop sync)

  **Must NOT do**:
  - Don't add E2E tests requiring real Outreach Dashboard
  - Don't test internal implementation details

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding tests to existing structure
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 3, 4)
  - **Parallel Group**: Wave 2/3
  - **Blocks**: Task 6
  - **Blocked By**: Task 2

  **References**:
  - `apps/api/src/__tests__/api.test.ts:95-175` - Existing article sync tests
  - `apps/api/src/services/__tests__/outreach-article-sync.service.test.ts` - Service unit tests

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All tests pass
    Tool: Bash
    Steps:
      1. cd apps/api && bun test
      2. Assert: Exit code 0
      3. Assert: No test failures in output
    Expected Result: All tests pass
    Evidence: Test output showing pass count
  ```

  **Commit**: YES
  - Message: `test(api): add tests for optimized article sync with duplicate prevention`
  - Files: `apps/api/src/__tests__/api.test.ts`
  - Pre-commit: `cd apps/api && bun test`

---

### Task 6: Execute Full Sync and Verify

- [x] 6. Trigger full article sync and verify completion

  **What to do**:
  - Start the API server if not running
  - Trigger the article sync via API:
    ```bash
    curl -X POST http://localhost:3000/api/outreach/articles/sync \
      -H "Content-Type: application/json" \
      -d '{"school":"OKA","slug":"OKA"}'
    ```
  - Monitor progress via polling `/api/sync/history`
  - Wait for completion (expect < 30 minutes)
  - Verify article count via `/api/outreach/articles/stats`
  - Document any errors from job metadata

  **Must NOT do**:
  - Don't run multiple syncs simultaneously
  - Don't interrupt sync mid-process

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Execution and verification, no code changes
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (final task)
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Tasks 3, 4, 5

  **References**:
  - `apps/api/src/routes/outreach.ts:164` - POST /articles/sync endpoint
  - `apps/api/src/routes/outreach.ts:330` - GET /articles/stats endpoint

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Full sync completes successfully
    Tool: Bash (curl)
    Preconditions: API server running with optimized sync service
    Steps:
      1. Trigger sync:
         JOB_ID=$(curl -s -X POST http://localhost:3000/api/outreach/articles/sync \
           -H "Content-Type: application/json" \
           -d '{"school":"OKA","slug":"OKA"}' | jq -r '.data.jobId // .jobId')
         echo "Job ID: $JOB_ID"
      2. Poll until complete (max 60 iterations × 30s = 30 min):
         for i in {1..60}; do
           RESULT=$(curl -s "http://localhost:3000/api/sync/history?jobType=outreach_articles&limit=1")
           STATUS=$(echo "$RESULT" | jq -r '.data[0].status')
           PROGRESS=$(echo "$RESULT" | jq -r '.data[0].metadata.processed // "N/A"')
           TOTAL=$(echo "$RESULT" | jq -r '.data[0].metadata.totalExpected // "N/A"')
           echo "[$i] Status: $STATUS, Progress: $PROGRESS/$TOTAL"
           [ "$STATUS" = "completed" ] && break
           [ "$STATUS" = "failed" ] && echo "FAILED" && exit 1
           sleep 30
         done
      3. Assert: STATUS equals "completed"
    Expected Result: Sync completes with status "completed"
    Evidence: Final job status and metadata

  Scenario: Article count matches Outreach Dashboard
    Tool: Bash (curl)
    Preconditions: Sync completed successfully
    Steps:
      1. TOTAL=$(curl -s http://localhost:3000/api/outreach/articles/stats | jq '.data.totalArticles')
         echo "Total articles: $TOTAL"
      2. Assert: TOTAL >= 46000
    Expected Result: Article count is at least 46,000
    Evidence: Stats API response

  Scenario: Sync completes in under 30 minutes
    Tool: Bash
    Steps:
      1. Record start time before sync
      2. Record end time after sync completes
      3. Calculate duration in seconds
      4. Assert: Duration < 1800 (30 minutes)
    Expected Result: Sync is performant
    Evidence: Duration log

  Scenario: Progress was tracked during sync
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:3000/api/sync/history?jobType=outreach_articles&limit=1" | jq '.data[0].metadata'
      2. Assert: metadata contains "processed", "totalExpected", "imported", "updated", "errors"
    Expected Result: All progress fields present
    Evidence: Metadata structure
  ```

  **Commit**: NO (execution only, no code changes)

---

## Commit Strategy

| After Task | Message                                                                              | Files                                                       | Verification |
| ---------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- | ------------ |
| 1          | `feat(api): add environment variables and types for article sync optimization`       | outreach-article-sync.service.ts                            | bun test     |
| 2          | `feat(api): optimize article sync with batching, concurrency, and progress tracking` | outreach-article-sync.service.ts                            | bun test     |
| 3+4        | `feat(api): add duplicate job prevention and scheduled article sync`                 | outreach-article-sync.service.ts, outreach.ts, scheduler.ts | bun test     |
| 5          | `test(api): add tests for optimized article sync`                                    | api.test.ts                                                 | bun test     |
| 6          | -                                                                                    | -                                                           | -            |

---

## Success Criteria

### Verification Commands

```bash
# 1. Verify article count after sync
curl -s http://localhost:3000/api/outreach/articles/stats | jq '.data.totalArticles'
# Expected: >= 46000

# 2. Verify sync job completed
curl -s "http://localhost:3000/api/sync/history?jobType=outreach_articles&limit=1" | jq '.data[0].status'
# Expected: "completed"

# 3. Verify progress tracking
curl -s "http://localhost:3000/api/sync/history?jobType=outreach_articles&limit=1" | jq '.data[0].metadata'
# Expected: {"totalExpected":46860,"processed":46860,"imported":X,"updated":Y,"errors":Z,...}

# 4. Verify duplicate prevention
# (while sync running) Returns 409:
curl -s -X POST http://localhost:3000/api/outreach/articles/sync \
  -H "Content-Type: application/json" \
  -d '{"school":"OKA","slug":"OKA"}' -w "\n%{http_code}"

# 5. Build passes
cd apps/api && bun run build
# Expected: Exit 0

# 6. Tests pass
cd apps/api && bun test
# Expected: All tests pass
```

### Final Checklist

- [x] All "Must Have" present:
  - [x] Batch processing with configurable batch size
  - [x] Concurrency control with p-limit
  - [x] Progress tracking in metadata
  - [x] Duplicate job prevention
  - [x] Editor pre-fetch optimization
  - [x] Scheduled cron job
  - [x] Environment variable configuration
- [x] All "Must NOT Have" absent:
  - [x] No new npm dependencies
  - [x] No new API endpoints
  - [x] No database schema changes
  - [x] No WebSocket/SSE
- [x] Sync completes in < 30 minutes
- [x] Article count >= 46,000
- [x] All tests pass
- [x] Build succeeds
