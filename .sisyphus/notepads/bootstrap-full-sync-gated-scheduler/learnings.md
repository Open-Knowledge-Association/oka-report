## Task 1: Bootstrap State Persistence and Lifecycle Service

### Implementation Details

**BootstrapState Model:**
- Added singleton model with id = "singleton" to enforce single row
- Fields: state (pending/running/completed/failed), timestamps, lease, rootJobId
- Migration applied successfully: 20260208133333_add_bootstrap_state

**BootstrapService:**
- Location: apps/api/src/services/bootstrap.service.ts
- Advisory lock key: 328573382 (hash of 'oka:bootstrap')
- Lock pattern: pg_try_advisory_xact_lock (transaction-scoped)
- Default lease: 48 hours

**Service Methods:**
- getState(): Retrieves current bootstrap state
- startBootstrap(): Atomic transition with advisory lock + UPDATE with state guard
  - Returns {success: boolean, state: BootstrapState}
  - Winner/loser semantics: Only one instance can transition to running
  - Uses WHERE state IN ('pending', 'failed') to guard transition
- failBootstrap(reason): Transitions to failed state with reason
- completeBootstrap(): Transitions to completed state
- retryFailedBootstrap(): Retries from failed state
- isLeaseExpired(): Checks if running lease has expired

**Key Decisions:**
- Used $queryRaw for advisory lock (transaction-scoped only)
- Used $executeRaw for atomic UPDATE with RETURNING to detect race conditions
- Singleton pattern enforced by Prisma unique constraint on id
- Export added to apps/api/src/services/index.ts

**Build Status:**
- moon run api:build: PASSED (1s 441ms)
- No TypeScript errors
- All imports resolved correctly

### Patterns from Existing Code

Referenced sync.service.ts patterns:
- Job metadata update pattern with typed JSON
- Parent/child job relationship via parentJobId
- Cancellation check pattern throughout long-running operations
- Transaction-scoped operations for consistency

### Next Steps

Ready for Task 2:
- Gate scheduler jobs with bootstrap state check
- Add bootstrap-complete precondition to all cron jobs
- Implement skip reason logging when blocked by bootstrap

## Task 2: Scheduler Gating Implementation

### Summary

Implemented bootstrap state gating for all scheduled cron jobs in the scheduler system. All jobs now check bootstrap completion state before execution and emit clear skip reasons when blocked.

### Implementation Details

**Modified Files:**

1. **apps/api/src/jobs/scheduler.ts**
   - Added `BootstrapService` import and instantiation
   - Added bootstrap state check to all 4 cron jobs:
     - `full-sync` (scheduled at env SYNC_SCHEDULE, default "0 2 * * *")
     - `outreach-articles` (scheduled at env OUTREACH_ARTICLE_SYNC_SCHEDULE, default "0 3 * * *")
     - `daily-stats` (scheduled at "15 0 * * *")
     - `daily-backfill` (startup job via setTimeout)

2. **apps/api/src/routes/scheduler.ts**
   - Added `BootstrapService` import
   - Added `bootstrapBlocked` field to all job responses
   - Field computed once per request and shared across all jobs for consistency

**Bootstrap Check Pattern:**

Each scheduled job now follows this execution order:
1. Check if job is disabled via SchedulerSetting (existing)
2. **Check bootstrap state (NEW)**
3. Check database availability (existing)
4. Execute job logic

When bootstrap is incomplete:
```typescript
const bootstrapState = await bootstrapService.getState();
if (!bootstrapState || bootstrapState.state !== "completed") {
  console.log(
    `[Scheduler] Skipping <job-name>: bootstrap incomplete (state: ${bootstrapState?.state || "unknown"})`,
  );
  return;
}
```

**Scheduler API Enhancement:**

The GET /api/scheduler endpoint now returns:
```json
{
  "success": true,
  "data": {
    "timezone": "UTC",
    "jobs": [
      {
        "id": "full-sync",
        "name": "Full Sync",
        "enabled": true,
        "disabledReason": null,
        "bootstrapBlocked": true,  // NEW FIELD
        ...
      }
    ]
  }
}
```

The `bootstrapBlocked` field indicates whether bootstrap is currently preventing job execution.

### Verification

- ✅ All scheduler jobs check bootstrap state before running
- ✅ Jobs skip with descriptive log reason when bootstrap incomplete
- ✅ Scheduler API exposes bootstrap-blocked status per job
- ✅ Build passes: `moon run api:build` completed successfully
- ✅ LSP diagnostics clean on all modified files
- ✅ Existing SchedulerSetting enable/disable controls preserved
- ✅ Bootstrap check occurs AFTER setting.enabled check (as required)

### Design Decisions

**Why Check Bootstrap After Settings Check?**
- Settings check is cheaper (DB lookup vs state evaluation)
- If job is disabled by operator, no need to check bootstrap
- Maintains existing priority: explicit disable > bootstrap gate > execution

**Why Share bootstrapBlocked Value Across Jobs?**
- Bootstrap state is singleton (same for all jobs)
- Single query reduces DB load
- Ensures consistency in API response (all jobs see same state)

**Log Format:**
Followed existing pattern from SchedulerSetting skip logs:
```
[Scheduler] Skipping <job-name>: <reason> (state: <state>)
```

This matches the existing format:
```
[Scheduler] Skipping <job-name>: disabled (reason)
```

### Edge Cases Handled

1. **No bootstrap state exists** (`bootstrapState === null`):
   - Treated as incomplete, jobs are blocked
   - Log shows "state: unknown"

2. **Bootstrap state exists but not completed** (pending/running/failed):
   - Jobs are blocked
   - Log shows actual state for debugging

3. **Scheduler API called during bootstrap**:
   - Returns `bootstrapBlocked: true` for all jobs
   - Does not fail, provides observability

### Testing Notes

The implementation follows defensive patterns:
- Null-safe checks (`!bootstrapState || bootstrapState.state !== "completed"`)
- Fallback to "unknown" state in logs
- Non-blocking errors (jobs skip gracefully, don't crash scheduler)

### Next Steps

This completes Task 2 of the bootstrap gating implementation. The scheduler now respects bootstrap state and provides visibility through the API.

Remaining tasks in the plan:
- Task 3: Wire first-deploy bootstrap orchestration
- Task 4: Switch scheduled sync to incremental mode post-bootstrap
- Task 5: Add bootstrap observability endpoints
- Task 6: QA validation and runbook
