# Sync Job Manager UI

## TL;DR

> **Quick Summary**: Build a comprehensive Sync Job Manager admin page with real-time SSE progress streaming, job history, trigger controls, cancel/retry functionality.
>
> **Deliverables**:
>
> - SSE streaming endpoint for real-time job updates
> - Cancel job API with cooperative cancellation in services
> - Retry job API
> - Progress tracking for all sync job types
> - Admin page at `/admin/sync-jobs` with full job management UI
>
> **Estimated Effort**: Large (2-3 days)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 (DB Schema) → Task 2 (Cancel API) → Task 4 (SSE) → Task 7 (UI Page)

---

## Context

### Original Request

User wants a dedicated page to manage and monitor sync jobs with:

- Real-time progress updates (tail-like experience)
- Job history with filtering
- Ability to trigger, cancel, and retry jobs
- Live progress bars for running jobs

### Interview Summary

**Key Discussions**:

- Real-time approach: SSE (Server-Sent Events) chosen over polling/WebSocket
- All features requested: history table, progress bar, triggers, details modal, cancel, retry, auto-refresh
- Progress tracking: Add to ALL job types (not just outreach_articles)
- Cancel behavior: Optimistic UI update
- Retry behavior: Fresh start (new job with same params)

### Research Findings

- Hono has built-in SSE support via `streamSSE()` from `hono/streaming`
- Current services use `setTimeout` for background work - need cooperative cancellation
- Progress checkpoints already exist for `outreach_articles` jobs in metadata field
- Existing UI components (SyncButton, SyncStatusCard) can be extended
- Need to add `isCancelled` field to sync_jobs table for cancel support

---

## Work Objectives

### Core Objective

Create a production-ready Sync Job Manager page that provides real-time visibility and control over all background sync operations.

### Concrete Deliverables

- `packages/db/prisma/schema.prisma` - Add `isCancelled` field to SyncJob model
- `apps/api/src/routes/sync.ts` - New endpoints: SSE stream, cancel, retry
- `apps/api/src/services/*.ts` - Add progress tracking and cancellation checks to all sync services
- `apps/web/src/routes/admin/sync-jobs.tsx` - New admin page
- `apps/web/src/components/sync-jobs/` - New UI components (JobTable, JobProgressBar, JobDetailsModal, etc.)
- `apps/web/src/hooks/useSyncJobStream.ts` - SSE subscription hook

### Definition of Done

- [ ] All sync job types report progress via metadata
- [ ] Running jobs can be cancelled via UI
- [ ] Failed jobs can be retried via UI
- [ ] Real-time updates work without page refresh
- [ ] Job details show full metadata and error information

### Must Have

- SSE endpoint streaming job status updates
- Cancel functionality with cooperative cancellation
- Retry functionality for failed jobs
- Progress bars for all job types
- Job history table with status/type filters
- Job details modal with metadata view

### Must NOT Have (Guardrails)

- NO WebSocket implementation (SSE is sufficient)
- NO job queue system (keep using setTimeout pattern)
- NO resume-from-checkpoint for retry (fresh start only)
- NO multi-user conflict handling (single admin assumption)
- NO pagination for job history initially (limit to last 50 jobs)
- NO automatic scheduled job management (only manual triggers from UI)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL verification is executed by the agent using tools (Playwright, curl, etc.)

### Test Decision

- **Infrastructure exists**: YES (bun test exists)
- **Automated tests**: YES (Tests-after for API endpoints)
- **Framework**: bun test

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Every task includes specific QA scenarios using:

- **API endpoints**: curl commands
- **UI verification**: Playwright with specific selectors
- **Database verification**: Prisma queries

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add isCancelled field to database schema
├── Task 3: Add progress tracking to sync.service.ts
└── Task 3b: Add progress tracking to outreach-sync.service.ts

Wave 2 (After Wave 1):
├── Task 2: Cancel job API + cooperative cancellation
├── Task 5: Retry job API
└── Task 4: SSE streaming endpoint

Wave 3 (After Wave 2):
├── Task 6: useSyncJobStream hook
└── Task 7: Sync Jobs admin page
└── Task 8: Job details modal

Wave 4 (After Wave 3):
└── Task 9: Integration testing & polish
```

### Dependency Matrix

| Task | Depends On | Blocks        | Can Parallelize With |
| ---- | ---------- | ------------- | -------------------- |
| 1    | None       | 2, 4, 5, 6, 7 | 3, 3b                |
| 2    | 1          | 7             | 4, 5                 |
| 3    | None       | 2             | 1, 3b                |
| 3b   | None       | 2             | 1, 3                 |
| 4    | 1          | 6             | 2, 5                 |
| 5    | 1          | 7             | 2, 4                 |
| 6    | 4          | 7             | None                 |
| 7    | 1, 2, 5, 6 | 8, 9          | None                 |
| 8    | 7          | 9             | None                 |
| 9    | 7, 8       | None          | None                 |

---

## TODOs

- [x] 1. Add isCancelled field to SyncJob schema

  **What to do**:
  - Add `isCancelled Boolean @default(false)` field to SyncJob model in Prisma schema
  - Add index on isCancelled field for efficient queries
  - Run migration: `bunx prisma migrate dev --name add-sync-job-cancelled`
  - Regenerate Prisma client

  **Must NOT do**:
  - Do NOT modify other fields in SyncJob model
  - Do NOT create a new model

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple schema change with straightforward migration
  - **Skills**: `[]`
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 3, 3b)
  - **Blocks**: Tasks 2, 4, 5, 6, 7
  - **Blocked By**: None

  **References**:
  - `packages/db/prisma/schema.prisma:201-234` - Current SyncJob model definition (lines 201-234)
  - `packages/db/prisma/schema.prisma:231-232` - Existing indexes pattern (@@index on status and jobType)

  **Acceptance Criteria**:
  - [ ] `isCancelled` field exists in SyncJob model with default false
  - [ ] Migration created and applied successfully
  - [ ] `bunx prisma generate` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Schema has isCancelled field
    Tool: Bash (grep)
    Steps:
      1. grep -n "isCancelled" packages/db/prisma/schema.prisma
    Expected Result: Line showing "isCancelled Boolean @default(false)"
    Evidence: Command output

  Scenario: Migration applied successfully
    Tool: Bash
    Steps:
      1. cd packages/db && bunx prisma migrate status
    Expected Result: No pending migrations
    Evidence: Command output showing "Database schema is up to date"
  ```

  **Commit**: YES
  - Message: `feat(db): add isCancelled field to SyncJob for job cancellation support`
  - Files: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*`

---

- [x] 2. Implement Cancel Job API with cooperative cancellation

  **What to do**:
  - Add `POST /api/sync/jobs/:id/cancel` endpoint in sync.ts routes
  - Update SyncJob record: set `isCancelled = true`
  - Modify all sync services to check `isCancelled` flag periodically during processing
  - If cancelled, update job status to "cancelled" and stop processing
  - Return 200 with job status on success, 404 if job not found, 400 if job not running

  **Must NOT do**:
  - Do NOT implement force-kill (cooperative cancellation only)
  - Do NOT add AbortController (use DB flag checking instead)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires modifying multiple service files with careful logic
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1, 3, 3b

  **References**:
  - `apps/api/src/routes/sync.ts:1-100` - Existing sync routes pattern
  - `apps/api/src/services/sync.service.ts:50-150` - SyncService methods to modify
  - `apps/api/src/services/outreach-article-sync.service.ts:80-150` - Batch processing loop to add cancellation check
  - `apps/api/src/services/outreach-sync.service.ts:30-80` - Editor sync to add cancellation check

  **Acceptance Criteria**:
  - [ ] POST /api/sync/jobs/:id/cancel endpoint exists
  - [ ] Calling cancel on running job sets isCancelled = true
  - [ ] Running sync services check isCancelled and stop gracefully
  - [ ] Job status becomes "cancelled" after cancellation completes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Cancel running job via API
    Tool: Bash (curl)
    Preconditions: Server running, a sync job is in "running" status
    Steps:
      1. Get running job: curl -s "http://localhost:3000/api/sync/history?limit=1" | jq '.data[0]'
      2. Note the job ID
      3. curl -X POST "http://localhost:3000/api/sync/jobs/{id}/cancel" -H "Content-Type: application/json"
      4. Assert: HTTP status is 200
      5. Wait 5 seconds
      6. curl -s "http://localhost:3000/api/sync/history?limit=1" | jq '.data[0].status'
      7. Assert: status is "cancelled" or job stopped processing
    Expected Result: Job is cancelled
    Evidence: Response bodies captured

  Scenario: Cancel non-existent job returns 404
    Tool: Bash (curl)
    Steps:
      1. curl -s -w "%{http_code}" -X POST "http://localhost:3000/api/sync/jobs/nonexistent123/cancel"
      2. Assert: HTTP status is 404
    Expected Result: 404 Not Found
    Evidence: HTTP status code
  ```

  **Commit**: YES
  - Message: `feat(api): add cancel job endpoint with cooperative cancellation`
  - Files: `apps/api/src/routes/sync.ts`, `apps/api/src/services/*.ts`

---

- [x] 3. Add progress tracking to sync.service.ts

  **What to do**:
  - Modify `syncEditorContributions()` to track and update progress in metadata
  - Modify `syncArticlePageviews()` to track and update progress in metadata
  - Modify `syncCommonsUploads()` to track and update progress in metadata
  - Progress metadata format: `{ total: number, processed: number, stage: string }`
  - Update metadata periodically (every 10 items or 5 seconds)

  **Must NOT do**:
  - Do NOT change the sync logic itself
  - Do NOT add new dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding existing sync logic and adding instrumentation
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3b)
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:
  - `apps/api/src/services/sync.service.ts` - Sync methods to modify (syncEditorContributions, syncArticlePageviews, syncCommonsUploads)
  - `apps/api/src/services/outreach-article-sync.service.ts:208-220` - Existing progress checkpoint pattern to follow (CHECKPOINT_INTERVAL logic)

  **Acceptance Criteria**:
  - [ ] syncEditorContributions updates metadata with progress
  - [ ] syncArticlePageviews updates metadata with progress
  - [ ] syncCommonsUploads updates metadata with progress
  - [ ] Progress updates happen periodically during sync

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Contributions sync reports progress
    Tool: Bash (curl)
    Preconditions: Server running, editors exist in database
    Steps:
      1. Trigger sync: curl -X POST "http://localhost:3000/api/sync/trigger" -H "Content-Type: application/json" -d '{"jobType":"contributions"}'
      2. Wait 3 seconds
      3. curl -s "http://localhost:3000/api/sync/status" | jq '.data.metadata'
      4. Assert: metadata contains "total" and "processed" fields
    Expected Result: Progress metadata visible
    Evidence: Response showing progress fields
  ```

  **Commit**: YES (groups with 3b)
  - Message: `feat(api): add progress tracking to all sync services`
  - Files: `apps/api/src/services/sync.service.ts`

---

- [x] 3b. Add progress tracking to outreach-sync.service.ts

  **What to do**:
  - Modify `syncEditorsFromDashboard()` to track and update progress in metadata
  - Progress metadata format: `{ total: number, processed: number, stage: string }`
  - Update metadata periodically (every 10 editors)

  **Must NOT do**:
  - Do NOT change outreach-article-sync.service.ts (already has progress tracking)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single service modification following existing pattern
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:
  - `apps/api/src/services/outreach-sync.service.ts` - Editor sync method (syncEditorsFromDashboard)
  - `apps/api/src/services/outreach-article-sync.service.ts:208-220` - Progress checkpoint pattern to copy (metadata update with totalExpected, processed, lastProcessedIndex, errors)

  **Acceptance Criteria**:
  - [ ] syncEditorsFromDashboard updates metadata with progress
  - [ ] Progress format matches other services: `{ total, processed, stage }`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Editor sync reports progress
    Tool: Bash (curl)
    Steps:
      1. curl -X POST "http://localhost:3000/api/sync/outreach" -H "Content-Type: application/json" -d '{"school":"OKA","slug":"OKA"}'
      2. Wait 2 seconds
      3. curl -s "http://localhost:3000/api/sync/status" | jq '.data.metadata'
      4. Assert: metadata contains progress fields
    Expected Result: Progress visible in metadata
    Evidence: Response body
  ```

  **Commit**: YES (groups with 3)
  - Message: `feat(api): add progress tracking to all sync services`
  - Files: `apps/api/src/services/outreach-sync.service.ts`

---

- [x] 4. Implement SSE streaming endpoint

  **What to do**:
  - Add `GET /api/sync/stream` endpoint using Hono's `streamSSE()`
  - Stream current job status every 2 seconds
  - Include all running jobs and recently completed jobs (last 5 minutes)
  - Event format: `{ event: "job-update", data: SyncJob[] }`
  - Handle client disconnect gracefully with `stream.onAbort()`

  **Must NOT do**:
  - Do NOT use WebSocket
  - Do NOT implement authentication (admin-only via existing patterns)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: New pattern (SSE) requiring careful implementation
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 5)
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `apps/api/src/routes/sync.ts` - Add new route here
  - Hono SSE docs: `import { streamSSE } from 'hono/streaming'`
  - `apps/api/src/routes/index.ts` - Route mounting pattern

  **Acceptance Criteria**:
  - [ ] GET /api/sync/stream returns SSE content-type
  - [ ] Events stream every 2 seconds while connected
  - [ ] Events contain current job status with metadata
  - [ ] Connection closes cleanly when client disconnects

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: SSE endpoint streams events
    Tool: Bash (curl)
    Steps:
      1. curl -N -H "Accept: text/event-stream" "http://localhost:3000/api/sync/stream" --max-time 10 2>&1 | head -20
      2. Assert: Response contains "event:" and "data:" lines
      3. Assert: Content-Type is text/event-stream
    Expected Result: SSE events received
    Evidence: curl output showing SSE format

  Scenario: SSE includes running job progress
    Tool: Bash
    Preconditions: A sync job is running
    Steps:
      1. Start a sync in background
      2. Connect to SSE stream for 5 seconds
      3. Parse events and check for job with status "running"
      4. Assert: metadata.processed field exists
    Expected Result: Running job with progress in stream
    Evidence: Parsed event data
  ```

  **Commit**: YES
  - Message: `feat(api): add SSE streaming endpoint for real-time job updates`
  - Files: `apps/api/src/routes/sync.ts`

---

- [x] 5. Implement Retry Job API

  **What to do**:
  - Add `POST /api/sync/jobs/:id/retry` endpoint
  - Only allow retry for jobs with status "failed" or "cancelled"
  - Create new job with same `jobType` and trigger the sync
  - Return 200 with new job ID, 404 if not found, 400 if job not retriable

  **Must NOT do**:
  - Do NOT implement resume-from-checkpoint (always fresh start)
  - Do NOT copy old metadata to new job

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple endpoint following existing patterns
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 2, 4)
  - **Blocks**: Task 7
  - **Blocked By**: Task 1

  **References**:
  - `apps/api/src/routes/sync.ts:20-60` - POST /api/sync/trigger pattern to follow
  - `apps/api/src/routes/outreach.ts:80-120` - POST outreach sync pattern

  **Acceptance Criteria**:
  - [ ] POST /api/sync/jobs/:id/retry endpoint exists
  - [ ] Retry on failed job creates new job and starts sync
  - [ ] Retry on running job returns 400 error
  - [ ] Response includes new job ID

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Retry failed job creates new job
    Tool: Bash (curl)
    Preconditions: A sync job exists with status "failed"
    Steps:
      1. Get failed job: curl -s "http://localhost:3000/api/sync/history?limit=10" | jq '.data[] | select(.status=="failed") | .id' | head -1
      2. curl -X POST "http://localhost:3000/api/sync/jobs/{id}/retry" -H "Content-Type: application/json"
      3. Assert: HTTP status is 200
      4. Assert: Response contains newJobId
      5. Verify new job exists: curl -s "http://localhost:3000/api/sync/status" | jq '.data.id'
    Expected Result: New job created and running
    Evidence: Response with newJobId

  Scenario: Retry running job returns 400
    Tool: Bash (curl)
    Preconditions: A sync job is in "running" status
    Steps:
      1. Get running job ID
      2. curl -s -w "%{http_code}" -X POST "http://localhost:3000/api/sync/jobs/{id}/retry"
      3. Assert: HTTP status is 400
    Expected Result: Bad request error
    Evidence: HTTP status 400
  ```

  **Commit**: YES
  - Message: `feat(api): add retry job endpoint for failed/cancelled jobs`
  - Files: `apps/api/src/routes/sync.ts`

---

- [x] 6. Create useSyncJobStream hook

  **What to do**:
  - Create `apps/web/src/hooks/useSyncJobStream.ts`
  - Implement EventSource connection to `/api/sync/stream`
  - Return `{ jobs: SyncJob[], isConnected: boolean, error: Error | null }`
  - Auto-reconnect on disconnect with exponential backoff
  - Clean up EventSource on unmount

  **Must NOT do**:
  - Do NOT use polling as fallback (SSE only)
  - Do NOT add external dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Standard React hook pattern
  - **Skills**: `["frontend-ui-ux"]`
    - frontend-ui-ux: React hooks and state management patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential after Wave 2)
  - **Blocks**: Task 7
  - **Blocked By**: Task 4

  **References**:
  - `apps/web/src/hooks/use-toast.ts` - Existing hook pattern in codebase
  - `apps/web/src/lib/api.ts` - API base URL and types

  **Acceptance Criteria**:
  - [ ] Hook connects to SSE endpoint on mount
  - [ ] Jobs array updates in real-time as events arrive
  - [ ] isConnected reflects actual connection state
  - [ ] Auto-reconnects after disconnect

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Hook provides real-time job updates
    Tool: Playwright
    Preconditions: App running with useSyncJobStream integrated into a test component
    Steps:
      1. Navigate to page using the hook
      2. Trigger a sync via API
      3. Wait 5 seconds
      4. Assert: Job appears in UI without refresh
    Expected Result: Real-time update visible
    Evidence: Screenshot showing job status
  ```

  **Commit**: YES
  - Message: `feat(web): add useSyncJobStream hook for real-time SSE updates`
  - Files: `apps/web/src/hooks/useSyncJobStream.ts`

---

- [x] 7. Create Sync Jobs admin page

  **What to do**:
  - Create `apps/web/src/routes/admin/sync-jobs.tsx` with TanStack Router
  - Implement components:
    - `SyncJobsPage` - Main container with layout
    - `JobHistoryTable` - Table of jobs with columns: Type, Status, Started, Duration, Progress, Actions
    - `JobProgressBar` - Progress bar component for running jobs
    - `TriggerSyncPanel` - Buttons to trigger different sync types
  - Use `useSyncJobStream` for real-time updates
  - Use shadcn/ui components: Table, Button, Badge, Card, Progress
  - Add filters for job type and status

  **Must NOT do**:
  - Do NOT implement pagination (limit to last 50 jobs)
  - Do NOT add authentication (use existing admin pattern)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI-heavy task with multiple components
  - **Skills**: `["frontend-ui-ux"]`
    - frontend-ui-ux: Complex UI composition and shadcn patterns

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential)
  - **Blocks**: Tasks 8, 9
  - **Blocked By**: Tasks 1, 2, 5, 6

  **References**:
  - `apps/web/src/routes/admin/outreach.tsx` - Existing admin page pattern
  - `apps/web/src/components/outreach/SyncButton.tsx` - Trigger button pattern
  - `apps/web/src/components/outreach/SyncStatusCard.tsx` - Status display pattern
  - `apps/web/src/components/ui/` - shadcn/ui components available

  **Acceptance Criteria**:
  - [ ] Page accessible at /admin/sync-jobs
  - [ ] Job history table shows recent jobs
  - [ ] Progress bars show for running jobs
  - [ ] Cancel button works for running jobs
  - [ ] Retry button works for failed jobs
  - [ ] Trigger buttons start new syncs
  - [ ] Status updates in real-time without refresh

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Admin page loads with job history
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3001/admin/sync-jobs
      2. Wait for table to load (selector: table or [data-testid="job-table"])
      3. Assert: Table headers visible (Type, Status, Started, Actions)
      4. Assert: At least one row if jobs exist in DB
      5. Screenshot: .sisyphus/evidence/task-7-page-load.png
    Expected Result: Page loads with job table
    Evidence: Screenshot

  Scenario: Trigger sync button starts new job
    Tool: Playwright
    Steps:
      1. Navigate to /admin/sync-jobs
      2. Click trigger button for "Full Sync" or similar
      3. Wait for new row in table with status "running" or "pending"
      4. Assert: Toast notification appears
      5. Screenshot: .sisyphus/evidence/task-7-trigger-sync.png
    Expected Result: New job appears in table
    Evidence: Screenshot

  Scenario: Cancel button stops running job
    Tool: Playwright
    Preconditions: A sync job is running
    Steps:
      1. Navigate to /admin/sync-jobs
      2. Find row with status "running"
      3. Click Cancel button in that row
      4. Wait 5 seconds
      5. Assert: Status changes to "cancelled" or "cancelling"
      6. Screenshot: .sisyphus/evidence/task-7-cancel-job.png
    Expected Result: Job cancelled
    Evidence: Screenshot

  Scenario: Progress bar updates in real-time
    Tool: Playwright
    Preconditions: A sync job is running with progress
    Steps:
      1. Navigate to /admin/sync-jobs
      2. Find row with status "running"
      3. Note progress bar value
      4. Wait 5 seconds
      5. Assert: Progress bar value has increased (or job completed)
      6. Screenshot: .sisyphus/evidence/task-7-progress-update.png
    Expected Result: Progress increases without refresh
    Evidence: Screenshot series or video
  ```

  **Commit**: YES
  - Message: `feat(web): add Sync Jobs admin page with real-time updates`
  - Files: `apps/web/src/routes/admin/sync-jobs.tsx`, `apps/web/src/components/sync-jobs/*`

---

- [x] 8. Add Job Details Modal

  **What to do**:
  - First, add shadcn Dialog and Progress components: `bunx shadcn@latest add dialog progress`
  - Create `JobDetailsModal` component using shadcn Dialog
  - Show full job information: id, type, status, timestamps, duration
  - Show metadata as formatted JSON or structured view
  - Show error message and stack trace if failed
  - Show errorDetails array if present in metadata
  - Trigger modal on row click or "View Details" button

  **Must NOT do**:
  - Do NOT allow editing job data
  - Do NOT show raw JSON only (format it nicely)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with design considerations
  - **Skills**: `["frontend-ui-ux"]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 7)
  - **Blocks**: Task 9
  - **Blocked By**: Task 7

  **Prerequisites**:
  - Add shadcn Dialog component first: `bunx shadcn@latest add dialog`

  **References**:
  - shadcn Dialog docs: https://ui.shadcn.com/docs/components/dialog
  - `apps/web/src/components/ui/card.tsx` - Existing shadcn component pattern to follow
  - `apps/web/src/routes/admin/sync-jobs.tsx` - Page to integrate with (created in Task 7)

  **Acceptance Criteria**:
  - [ ] Modal opens on row click or button click
  - [ ] Shows all job fields in readable format
  - [ ] Metadata displayed in collapsible sections
  - [ ] Error information highlighted for failed jobs
  - [ ] Modal closes on backdrop click or X button

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: View details of completed job
    Tool: Playwright
    Steps:
      1. Navigate to /admin/sync-jobs
      2. Click on a job row or "View Details" button
      3. Wait for modal (role="dialog")
      4. Assert: Modal contains job ID
      5. Assert: Modal contains status
      6. Assert: Modal contains metadata section
      7. Screenshot: .sisyphus/evidence/task-8-details-modal.png
    Expected Result: Modal shows job details
    Evidence: Screenshot

  Scenario: Failed job shows error information
    Tool: Playwright
    Preconditions: A failed job exists in history
    Steps:
      1. Open details for failed job
      2. Assert: Error section visible with error message
      3. Assert: Error styled distinctively (red text or alert)
      4. Screenshot: .sisyphus/evidence/task-8-error-display.png
    Expected Result: Error clearly visible
    Evidence: Screenshot
  ```

  **Commit**: YES
  - Message: `feat(web): add job details modal with metadata and error display`
  - Files: `apps/web/src/components/sync-jobs/JobDetailsModal.tsx`

---

- [x] 9. Integration testing and polish

  **What to do**:
  - Test full workflow: trigger → monitor → cancel → retry
  - Add loading states and error boundaries
  - Add empty states for no jobs
  - Ensure mobile responsiveness
  - Add link to sync-jobs page in admin navigation
  - Clean up any console errors or warnings

  **Must NOT do**:
  - Do NOT add new features
  - Do NOT refactor existing code

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI polish and testing
  - **Skills**: `["frontend-ui-ux", "playwright"]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (final)
  - **Blocks**: None (final task)
  - **Blocked By**: Tasks 7, 8

  **References**:
  - All previous task files
  - `apps/web/src/routes/__root.tsx` - Navigation integration

  **Acceptance Criteria**:
  - [ ] Full workflow works end-to-end
  - [ ] No console errors
  - [ ] Loading states show during data fetch
  - [ ] Empty state shows when no jobs
  - [ ] Page works on mobile viewport
  - [ ] Navigation link added to admin menu

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full workflow - trigger, monitor, cancel
    Tool: Playwright
    Steps:
      1. Navigate to /admin/sync-jobs
      2. Trigger an article sync
      3. Wait for job to appear with "running" status
      4. Observe progress bar increasing
      5. Click Cancel
      6. Assert: Status becomes "cancelled"
      7. Screenshot: .sisyphus/evidence/task-9-full-workflow.png
    Expected Result: Complete workflow succeeds
    Evidence: Screenshot series

  Scenario: Empty state displays correctly
    Tool: Playwright
    Preconditions: No jobs in database (or mock empty state)
    Steps:
      1. Navigate to /admin/sync-jobs
      2. Assert: Empty state message visible
      3. Assert: Trigger buttons still accessible
      4. Screenshot: .sisyphus/evidence/task-9-empty-state.png
    Expected Result: Graceful empty state
    Evidence: Screenshot

  Scenario: Mobile viewport works
    Tool: Playwright
    Steps:
      1. Set viewport to 375x667 (iPhone SE)
      2. Navigate to /admin/sync-jobs
      3. Assert: Page is usable, no horizontal scroll
      4. Assert: Table scrolls horizontally or cards stack
      5. Screenshot: .sisyphus/evidence/task-9-mobile.png
    Expected Result: Mobile-friendly layout
    Evidence: Screenshot
  ```

  **Commit**: YES
  - Message: `feat(web): complete sync job manager with polish and navigation`
  - Files: Various UI files, navigation config

---

## Commit Strategy

| After Task | Message                                                            | Files                                     | Verification          |
| ---------- | ------------------------------------------------------------------ | ----------------------------------------- | --------------------- |
| 1          | `feat(db): add isCancelled field to SyncJob`                       | schema.prisma, migrations                 | prisma migrate status |
| 3 + 3b     | `feat(api): add progress tracking to all sync services`            | sync.service.ts, outreach-sync.service.ts | bun test              |
| 2          | `feat(api): add cancel job endpoint with cooperative cancellation` | sync.ts, services/\*                      | curl test             |
| 4          | `feat(api): add SSE streaming endpoint`                            | sync.ts                                   | curl SSE test         |
| 5          | `feat(api): add retry job endpoint`                                | sync.ts                                   | curl test             |
| 6          | `feat(web): add useSyncJobStream hook`                             | useSyncJobStream.ts                       | -                     |
| 7          | `feat(web): add Sync Jobs admin page`                              | sync-jobs.tsx, components/\*              | playwright            |
| 8          | `feat(web): add job details modal`                                 | JobDetailsModal.tsx                       | playwright            |
| 9          | `feat(web): complete sync job manager with polish`                 | various                                   | playwright            |

---

## Success Criteria

### Verification Commands

```bash
# Check schema migration
cd packages/db && bunx prisma migrate status

# Test SSE endpoint
curl -N -H "Accept: text/event-stream" "http://localhost:3000/api/sync/stream" --max-time 5

# Test cancel endpoint
curl -X POST "http://localhost:3000/api/sync/jobs/{id}/cancel"

# Test retry endpoint
curl -X POST "http://localhost:3000/api/sync/jobs/{id}/retry"

# Verify UI loads
curl -s "http://localhost:3001/admin/sync-jobs" | head -100
```

### Final Checklist

- [ ] All sync job types report progress in metadata
- [ ] SSE endpoint streams job updates every 2 seconds
- [ ] Cancel stops running jobs cooperatively
- [ ] Retry creates new jobs for failed/cancelled ones
- [ ] Admin page shows real-time job status
- [ ] Job details modal shows full information
- [ ] Mobile viewport works
- [ ] No console errors
