# Bootstrap Full Sync with Gated Scheduler

## TL;DR

> **Quick Summary**: Introduce a DB-atomic bootstrap lifecycle with transaction-scoped advisory locks that runs first-deploy full sync exactly once, blocks all scheduled/API sync entrypoints until bootstrap completion, then switches scheduled runs to `scheduled_incremental` windows (latest 30 days) while preserving explicit historical backfill from oldest data.
>
> **Deliverables**:
>
> - Bootstrap singleton state machine + lease persistence
> - Scheduler gating for all cron jobs
> - Centralized sync trigger service (single enforcement point)
> - Post-bootstrap incremental sync mode
> - Backfill-from-oldest runbook and verification
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 3 -> Task 6

---

## Context

### Original Request

On first deployment, run full sync (Outreach + Wikimedia), block all schedules until finished, then run only incremental sync windows (around last 1 month). Backfill must start from oldest data.

### Interview Summary

**Key Discussions**:

- Full sync can run very long and currently overlaps with scheduler timelines.
- First-run bootstrap should have strict gating semantics.
- Post-bootstrap operation should be fast and incremental.
- Historical completion should be explicit backfill, not hidden in daily scheduler.

**Research Findings**:

- Scheduler jobs are independent cron handlers in `apps/api/src/jobs/scheduler.ts`.
- Full sync orchestration exists in `apps/api/src/routes/sync.ts` and `apps/api/src/services/sync.service.ts`.
- Existing incremental capability already exists via `since` logic in sync services.
- Earliest-date derivation exists in `apps/api/src/services/stats.service.ts` (`getEarliestActivityDate`).

### Metis Review

**Identified Gaps (addressed)**:

- Missing bootstrap state persistence -> add singleton bootstrap state.
- Multi-instance race risk -> add Postgres advisory lock.
- Potential deadlock if bootstrap fails -> add timeout + failed/retry path.
- Missing acceptance criteria for scheduler blocking and restart behavior -> added.

---

## Work Objectives

### Core Objective

Guarantee deterministic first-run data initialization and prevent schedule overlap until bootstrap is complete, then maintain freshness via incremental sync only.

### Concrete Deliverables

- Bootstrap state storage and service layer.
- Scheduler precondition gate (`blockedByBootstrap`) for all schedules.
- Incremental mode execution after bootstrap complete.
- API endpoints for bootstrap status/control.
- Backfill policy tied to oldest available local activity date.

### Definition of Done

- [x] Fresh deployment enters bootstrap state and starts bootstrap sync.
- [x] While bootstrap is `pending/running`, all scheduled jobs are skipped.
- [x] After bootstrap `completed`, schedules run normally and sync uses incremental mode.
- [x] Backfill process starts from earliest available activity date.
- [x] Restart and multi-instance behavior is safe and idempotent.

### Must Have

- Bootstrap state machine: `pending`, `running`, `completed`, `failed`.
- Timeout safeguard (default 48h) to avoid indefinite lock.
- Transaction-scoped advisory lock (`pg_try_advisory_xact_lock`) to avoid duplicate bootstrap runners.
- Lease fields (`leaseExpiresAt`, `rootJobId`) with startup reconciliation for stale `running` state.
- Single sync start entrypoint used by scheduler, startup, and API routes.
- Explicit observability endpoint for current bootstrap state.

### Must NOT Have (Guardrails)

- No scheduler system rewrite (keep existing node-cron structure).
- No new external infra dependency (no Redis lock dependency).
- No destructive data reset to re-bootstrap.
- No hidden implicit mode switches without persisted state.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> Every acceptance criterion must be verifiable via command/tool execution.

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: YES (tests-after)
- **Framework**: bun/moon test-build stack

### Agent-Executed QA Scenarios (MANDATORY)

Scenario: Fresh bootstrap blocks scheduler jobs
Tool: Bash (curl)
Preconditions: Fresh state (`bootstrap_state` pending), API running
Steps: 1. GET `/api/bootstrap/status` 2. GET `/api/scheduler` 3. Attempt `POST /api/sync/trigger` 4. Assert bootstrap state in `pending|running` 5. Assert each scheduled job exposes bootstrap block=true (or skip reason shows bootstrap lock) 6. Assert API trigger is rejected due to bootstrap gate
Expected Result: no cron task proceeds while bootstrap incomplete.
Failure Indicators: any scheduled job executes or API trigger starts sync with bootstrap incomplete.
Evidence: `.sisyphus/evidence/bootstrap-gate-status.json`

Scenario: Bootstrap completion unblocks schedules
Tool: Bash (curl)
Preconditions: Bootstrap finished
Steps: 1. GET `/api/bootstrap/status` 2. GET `/api/scheduler` 3. Assert state=`completed` 4. Assert jobs are no longer bootstrap-blocked
Expected Result: normal scheduler operation resumes.
Failure Indicators: jobs remain blocked after completion.
Evidence: `.sisyphus/evidence/bootstrap-unblock-status.json`

Scenario: Multi-instance safety lock
Tool: Bash (curl)
Preconditions: Bootstrap start endpoint available
Steps: 1. Trigger bootstrap start request A 2. Immediately trigger bootstrap start request B 3. Assert B returns conflict/already-running signal 4. Assert only one bootstrap root sync job is created
Expected Result: only one bootstrap runner allowed.
Failure Indicators: two parallel bootstrap runs accepted.
Evidence: `.sisyphus/evidence/bootstrap-lock-check.json`

Scenario: Post-bootstrap scheduled mode is incremental
Tool: Bash (curl)
Preconditions: Bootstrap completed
Steps: 1. Wait for bootstrap completion 2. Observe next scheduled sync metadata 3. Assert mode=`scheduled_incremental` and window policy=last 30 days 4. Trigger manual full/backfill and assert mode remains explicit (`manual_full`/`manual_backfill`)
Expected Result: routine sync avoids full historical pass.
Failure Indicators: scheduled mode runs historical full, or manual modes are silently remapped.
Evidence: `.sisyphus/evidence/post-bootstrap-incremental.json`

Scenario: Backfill starts from oldest available activity
Tool: Bash (curl + DB query command)
Preconditions: Existing data in local DB
Steps: 1. Compute earliest date from contributions/pageviews/uploads/articles 2. Trigger backfill with auto-start or explicit endpoint 3. Assert start date equals computed earliest date
Expected Result: backfill baseline anchored to oldest data.
Failure Indicators: backfill starts later than earliest available date.
Evidence: `.sisyphus/evidence/backfill-oldest-baseline.json`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Foundation):

- Task 1: Add bootstrap state model and service
- Task 2: Add scheduler gate and lock checks

Wave 2 (Behavior):

- Task 3: Wire bootstrap startup + completion transitions
- Task 4: Implement post-bootstrap incremental mode

Wave 3 (Ops & Validation):

- Task 5: Expose bootstrap status/control endpoints
- Task 6: QA verification suite + runbook

Critical Path: Task 1 -> Task 2 -> Task 3 -> Task 6

### Dependency Matrix

| Task | Depends On | Blocks  | Can Parallelize With |
| ---- | ---------- | ------- | -------------------- |
| 1    | None       | 2,3,5,6 | None                 |
| 2    | 1          | 3,6     | 5                    |
| 3    | 1,2        | 4,6     | 5                    |
| 4    | 3          | 6       | 5                    |
| 5    | 1          | 6       | 2,3,4                |
| 6    | 2,3,4,5    | None    | None                 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents                |
| ---- | ----- | --------------------------------- |
| 1    | 1,2   | `unspecified-high` + `git-master` |
| 2    | 3,4   | `unspecified-high` + `git-master` |
| 3    | 5,6   | `quick/writing` + `git-master`    |

---

## TODOs

- [x] 1. Implement bootstrap state persistence and lifecycle service

  **What to do**:
  - Add singleton bootstrap state model (pending/running/completed/failed) with lease + root-job linkage.
  - Add service methods: get, start (atomic), fail, complete, retry-failed, timeout evaluation.
  - Ensure start transition is DB-atomic with state guard and winner/loser semantics.

  **Must NOT do**:
  - Do not add non-essential states.
  - Do not introduce external lock infra.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: 2,3,5,6
  - **Blocked By**: None

  **References**:
  - `apps/api/src/jobs/scheduler.ts` - existing precondition style.
  - `apps/api/src/services/sync.service.ts` - job metadata update patterns.
  - `packages/db/prisma/schema.prisma` - persistence model definitions.

  **Acceptance Criteria**:
  - [x] Bootstrap state exists and is queryable at runtime.
  - [x] Timeout transition, lease expiry, and failure state are represented.

- [x] 2. Gate all scheduler jobs by bootstrap state + advisory lock

  **What to do**:
  - Add bootstrap-complete precondition before every cron execution.
  - Use transaction-scoped advisory lock for bootstrap and per-job start guards.
  - Emit skip reason in logs/metadata when blocked by bootstrap.

  **Must NOT do**:
  - Do not remove existing per-job enable/disable controls.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: 3,6
  - **Blocked By**: 1

  **References**:
  - `apps/api/src/jobs/scheduler.ts` - cron registrations and settings checks.
  - `apps/api/src/routes/scheduler.ts` - scheduler visibility payload.

  **Acceptance Criteria**:
  - [x] Scheduled jobs do not run while bootstrap incomplete.
  - [x] API/startup paths also reject sync starts while bootstrap incomplete.
  - [x] Concurrent bootstrap start attempts are rejected safely.

- [x] 3. Wire first-deploy bootstrap orchestration and completion rules

  **What to do**:
  - On startup, if bootstrap pending, trigger bootstrap flow through centralized trigger service.
  - Persist `rootJobId` and derive completion from root/child job terminal states.
  - Add startup reconciliation for stale `running` (expired lease, missing/terminal root job).
  - Handle restart idempotently (safe retry from failed/expired state only).

  **Must NOT do**:
  - Do not silently mark complete without root job evidence.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 4,6
  - **Blocked By**: 1,2

  **References**:
  - `apps/api/src/routes/sync.ts` - full pipeline ordering.
  - `apps/api/src/services/sync.service.ts` - parent/child job progress model.

  **Acceptance Criteria**:
  - [x] Bootstrap completes only when required components finish.
  - [x] Restart during bootstrap does not corrupt or duplicate data.

- [x] 4. Switch scheduled sync behavior to post-bootstrap incremental mode

  **What to do**:
  - Add sync mode metadata (`bootstrap_full`, `scheduled_incremental`, `manual_full`, `manual_backfill`).
  - Ensure pageviews and contributions use incremental windows after bootstrap complete.
  - Keep manual historical backfill as explicit operator action.

  **Must NOT do**:
  - Do not remove ability to run explicit full/backfill manually.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 6
  - **Blocked By**: 3

  **References**:
  - `apps/api/src/services/sync.service.ts` - existing `since` logic.
  - `apps/api/src/jobs/scheduler.ts` - schedule entrypoints.

  **Acceptance Criteria**:
  - [x] Routine scheduled sync executes `scheduled_incremental` behavior only.
  - [x] Manual full/backfill remain explicit and not silently remapped.
  - [x] Metadata clearly identifies execution mode.

- [x] 5. Add bootstrap observability endpoints and scheduler status flags

  **What to do**:
  - Add `GET /api/bootstrap/status`.
  - Add optional trigger/retry-failed endpoint (guarded for ops use); avoid destructive reset.
  - Surface bootstrap-blocked status in scheduler payload.

  **Must NOT do**:
  - Do not require UI redesign before API visibility is usable.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 with Task 6 prep
  - **Blocks**: 6
  - **Blocked By**: 1

  **References**:
  - `apps/api/src/routes/scheduler.ts` - existing scheduler API shape.
  - `apps/api/src/routes/*.ts` - route patterns and error contracts.

  **Acceptance Criteria**:
  - [x] Bootstrap status endpoint returns deterministic machine-readable state.
  - [x] Scheduler endpoint exposes whether bootstrap currently blocks each job.

- [x] 6. Validate end-to-end behavior and publish runbook

  **What to do**:
  - Execute QA scenarios for gate, unlock, lock safety, mode switch, and oldest-date backfill baseline.
  - Save evidence artifacts under `.sisyphus/evidence/`.
  - Publish operator runbook for first deploy and recovery.

  **Must NOT do**:
  - Do not rely on manual UI-only verification.

  **Recommended Agent Profile**:
  - **Category**: `writing`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 final
  - **Blocks**: None
  - **Blocked By**: 2,3,4,5

  **References**:
  - `apps/api/src/services/stats.service.ts` - earliest activity baseline logic.
  - `apps/api/src/jobs/scheduler.ts` - expected cron behavior.
  - `.sisyphus/evidence/` - artifact destination.

  **Acceptance Criteria**:
  - [x] All mandatory scenarios pass via command execution.
  - [x] Runbook includes recovery steps for failed/stuck bootstrap.

---

## Commit Strategy

| After Task | Message                                                    | Files                         | Verification               |
| ---------- | ---------------------------------------------------------- | ----------------------------- | -------------------------- |
| 1          | `feat(sync): add bootstrap lifecycle state`                | db schema + bootstrap service | API build/typecheck        |
| 2          | `feat(scheduler): gate jobs during bootstrap`              | scheduler jobs/routes         | scheduler endpoint checks  |
| 3-4        | `feat(sync): bootstrap orchestration and incremental mode` | sync route/service            | sync trigger/status checks |
| 5          | `feat(api): expose bootstrap status`                       | bootstrap/scheduler routes    | curl contract checks       |
| 6          | `docs(ops): add bootstrap runbook and evidence`            | docs + evidence paths         | scenario script outputs    |

---

## Success Criteria

### Verification Commands

```bash
# Check bootstrap state
curl -s http://localhost:3000/api/bootstrap/status

# Check scheduler block flags
curl -s http://localhost:3000/api/scheduler

# Trigger sync and inspect mode metadata
curl -s -X POST http://localhost:3000/api/sync/trigger -H "Content-Type: application/json" -d '{"jobType":"full"}'
curl -s http://localhost:3000/api/sync/status

# Trigger backfill and verify baseline behavior
curl -s -X POST http://localhost:3000/api/stats/history/backfill -H "Content-Type: application/json" -d '{"startDate":"2022-01-01","endDate":"2022-01-31"}'
```

### Final Checklist

- [x] First deploy enters bootstrap and blocks schedules.
- [x] Bootstrap completion unblocks all schedules.
- [x] Routine scheduled sync is incremental only.
- [x] Backfill strategy anchors from oldest available data.
- [x] Failure/restart path is documented and verifiable.
- [x] No sync execution path (scheduler/startup/API) bypasses bootstrap gate.
