# Expand Pageviews Impact to Created + Edited Articles

## TL;DR

> **Quick Summary**: Expand pageviews sync eligibility from created-only articles to program-related articles (created OR edited), keep existing cumulative display behavior, and add explicit created-vs-edited breakdown in reporting.
>
> **Deliverables**:
>
> - Expanded pageviews sync query and progress metadata
> - Backward-compatible stats API with created/edited pageview breakdown
> - Articles UI wording update for total-impact interpretation
> - Backfill runbook for safe rollout
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 4 -> Task 5

---

## Context

### Original Request

User wants article impact to include edited articles as well (not only created articles), while preserving cumulative behavior and backfill capability.

### Interview Summary

**Key Discussions**:

- Current pageviews sync processes only articles with `createdByEditorId != null`.
- This excludes many valid edited-impact articles from pageviews totals.
- User confirmed edited articles should be counted as impact.
- User requested full implementation plan first.

**Research Findings**:

- Pageviews sync filter is in `apps/api/src/services/sync.service.ts` (`syncArticlePageviews`).
- Full sync flow is orchestrated in `apps/api/src/routes/sync.ts` and `apps/api/src/services/sync.service.ts`.
- Scheduled jobs are defined in `apps/api/src/jobs/scheduler.ts`.
- Dashboard pageviews card is computed in `apps/api/src/routes/stats.ts`.
- Articles stats and source-aware pageview selection are in `apps/api/src/routes/articles.ts`.

### Metis Review

**Identified Gaps (addressed)**:

- Missing guardrail for concurrent pageviews runs -> add mutual-exclusion check.
- Ambiguous attribution model -> lock to article-level attribution.
- Missing acceptance criteria for backward compatibility and non-duplication -> added.
- Risk of scope creep into per-editor attribution -> explicitly excluded.

---

## Work Objectives

### Core Objective

Count pageviews impact for all program-related articles (created OR edited) while preserving current behavior for cumulative display and keeping existing API consumers stable.

### Concrete Deliverables

- Updated pageviews eligibility query in `syncArticlePageviews`.
- Updated `/api/stats/dashboard` payload with breakdown fields.
- UI card text/context update in Articles page.
- Backfill execution runbook in `.sisyphus/drafts/` or plan appendix.

### Definition of Done

- [x] Pageviews sync metadata `totalArticles` reflects created+edited eligible set (not only created).
- [x] Dashboard response includes `pageviews` (legacy) plus `pageviewsFromCreatedArticles` and `pageviewsFromEditedArticles`.
- [x] `pageviews === pageviewsFromCreatedArticles + pageviewsFromEditedArticles` for same scope.
- [x] No duplicate `pageview` rows for `(articleId,date,type,agentType)`.

### Must Have

- Include edited-only program articles in pageviews sync eligibility.
- Preserve source-aware selection behavior (Outreach prefers cumulative, MediaWiki prefers daily).
- Keep backward compatibility for existing frontend field `pageviews`.

### Must NOT Have (Guardrails)

- No schema migration for `pageview` table.
- No per-editor pageview attribution implementation.
- No re-architecture of contribution/outreach sync pipeline.
- No destructive rewrite of existing pageview data.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> All verification steps below are agent-executable via commands/tools only.

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: Tests-after
- **Framework**: bun test + project build/type checks

### Agent-Executed QA Scenarios (MANDATORY)

Scenario: Expanded pageviews eligibility is applied
Tool: Bash (curl)
Preconditions: API server running locally
Steps: 1. Trigger pageviews sync job endpoint. 2. Poll `/api/sync/status` until latest pageviews job is `completed`/`failed`. 3. Read latest job metadata and capture `totalArticles`. 4. Assert `totalArticles` is greater than created-only baseline.
Expected Result: job targets created+edited eligible set.
Failure Indicators: `totalArticles` unchanged at created-only size.
Evidence: `.sisyphus/evidence/task-qa-eligibility.json`

Scenario: Dashboard breakdown sums correctly
Tool: Bash (curl)
Preconditions: API server running, sync job completed
Steps: 1. GET `/api/stats/dashboard`. 2. Extract `pageviews`, `pageviewsFromCreatedArticles`, `pageviewsFromEditedArticles`. 3. Assert `pageviews == created + edited`.
Expected Result: arithmetic consistency and backward-compatible field present.
Failure Indicators: missing fields or sum mismatch.
Evidence: `.sisyphus/evidence/task-qa-dashboard-breakdown.json`

Scenario: Duplicate guard for pageview rows
Tool: Bash (DB query command in repo standard)
Preconditions: DB reachable
Steps: 1. Run grouped query on pageview key `(articleId,date,type,agentType)` with count > 1. 2. Assert zero rows returned.
Expected Result: no duplicate pageview records.
Failure Indicators: any duplicate group returned.
Evidence: `.sisyphus/evidence/task-qa-duplicates.txt`

Scenario: Negative path - concurrent pageviews trigger
Tool: Bash (curl)
Preconditions: first pageviews job running
Steps: 1. Trigger pageviews job. 2. Immediately trigger again. 3. Assert second request returns conflict/guard response.
Expected Result: only one active pageviews job allowed.
Failure Indicators: both triggers accepted as running jobs.
Evidence: `.sisyphus/evidence/task-qa-concurrency-guard.json`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start Immediately):

- Task 1: Expand pageviews eligibility + concurrency guard
- Task 3: Add backfill runbook + operational docs

Wave 2 (After Wave 1):

- Task 2: Dashboard breakdown fields
- Task 4: Articles UI card context update
- Task 5: Verification suite and evidence capture

Critical Path: Task 1 -> Task 2 -> Task 4 -> Task 5

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 2,4,5  | 3                    |
| 2    | 1          | 4,5    | 3                    |
| 3    | None       | 5      | 1,2                  |
| 4    | 2          | 5      | 3                    |
| 5    | 1,2,4      | None   | None                 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents                                            |
| ---- | ----- | ------------------------------------------------------------- |
| 1    | 1,3   | quick/unspecified-low with `git-master` + project conventions |
| 2    | 2,4,5 | quick for API/UI updates, unspecified-low for integrated QA   |

---

## TODOs

- [x] 1. Expand pageviews eligibility to created+edited and add mutual-exclusion guard

  **What to do**:
  - Replace created-only article filter in `syncArticlePageviews` with OR eligibility: `createdByEditorId` OR program edit relation.
  - Add guard to prevent concurrent active pageviews sync jobs.
  - Preserve existing date window and upsert logic.

  **Must NOT do**:
  - Do not alter DB schema.
  - Do not change pageview key semantics.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: core pipeline logic with data correctness risk.
  - **Skills**: `git-master`
    - `git-master`: safe incremental edits and verification discipline.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: not required for backend logic.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: 2,4,5
  - **Blocked By**: None

  **References**:
  - `apps/api/src/services/sync.service.ts` - pageviews eligibility filter and sync loop.
  - `apps/api/src/services/sync.service.ts` - active job helpers and lifecycle methods for guard reuse.
  - `apps/api/src/routes/sync.ts` - trigger path behavior and expected conflict handling.

  **Acceptance Criteria**:
  - [x] Pageviews job metadata `totalArticles` includes edited-only eligible articles.
  - [x] Second concurrent pageviews trigger is rejected.
  - [x] Existing successful pageviews upsert behavior remains intact.

- [x] 2. Add dashboard pageviews breakdown fields (created vs edited)

  **What to do**:
  - Extend `/api/stats/dashboard` response with breakdown fields.
  - Keep legacy `pageviews` field as total impact for backward compatibility.
  - Implement deterministic classification:
    - created: `createdByEditorId != null`
    - edited-only: related editor activity but no creator.

  **Must NOT do**:
  - Do not remove/rename existing `pageviews` field.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded route-level aggregation update.
  - **Skills**: `git-master`
    - `git-master`: controlled API contract evolution.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 4,5
  - **Blocked By**: 1

  **References**:
  - `apps/api/src/routes/stats.ts` - current dashboard totals and pageview selection.
  - `apps/api/src/routes/articles.ts` - source-aware pageview interpretation pattern.

  **Acceptance Criteria**:
  - [x] Response contains `pageviews`, `pageviewsFromCreatedArticles`, `pageviewsFromEditedArticles`.
  - [x] `pageviews == pageviewsFromCreatedArticles + pageviewsFromEditedArticles`.

- [x] 3. Add operational runbook for incremental backfill after eligibility expansion

  **What to do**:
  - Document preflight checks, trigger sequence, monitoring steps, and rollback-safe notes.
  - Include range strategy (small window first, then wider ranges) for stability.

  **Must NOT do**:
  - Do not introduce new scheduler jobs in this task.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: operator-focused procedural documentation.
  - **Skills**: `git-master`
    - `git-master`: versioned ops guidance with auditable changes.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5
  - **Blocked By**: None

  **References**:
  - `apps/api/src/jobs/scheduler.ts` - active schedule timings and overlap context.
  - `apps/api/src/routes/stats.ts` - snapshot and history backfill endpoints.
  - `apps/api/src/routes/sync.ts` - job trigger/cancel/retry endpoints.

  **Acceptance Criteria**:
  - [x] Runbook includes exact commands for trigger, polling, and verification.
  - [x] Runbook includes rollback-safe instructions.

- [x] 4. Update Articles page card context for total impact semantics

  **What to do**:
  - Keep card title stable unless product decision says otherwise.
  - Add concise explanatory subtext/tooltip that total views include created+edited impact.
  - Optionally render created/edited split if API fields are present.

  **Must NOT do**:
  - Do not redesign page layout.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: small FE wording/state binding update.
  - **Skills**: `frontend-ui-ux`, `git-master`
    - `frontend-ui-ux`: clear explanatory microcopy.
    - `git-master`: safe incremental UI patching.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 5
  - **Blocked By**: 2

  **References**:
  - `apps/web/src/routes/articles.tsx` - summary cards rendering.
  - `apps/web/src/lib/api.ts` - dashboard response typing.

  **Acceptance Criteria**:
  - [x] UI reflects total impact definition clearly.
  - [x] No runtime/type errors from new optional fields.

- [x] 5. End-to-end verification and evidence capture

  **What to do**:
  - Execute API/build checks and capture evidence files for eligibility, breakdown, and concurrency guard.
  - Validate no duplicates and backward compatibility.

  **Must NOT do**:
  - Do not rely on manual browser-only confirmation.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: deterministic verification workflow.
  - **Skills**: `git-master`
    - `git-master`: disciplined verification + diff review.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2 final
  - **Blocks**: None
  - **Blocked By**: 1,2,4

  **References**:
  - `apps/api/src/routes/stats.ts` - dashboard response contract.
  - `apps/api/src/services/sync.service.ts` - job metadata fields.
  - `.sisyphus/evidence/` - output location for verification artifacts.

  **Acceptance Criteria**:
  - [x] Evidence files saved for all mandatory QA scenarios.
  - [x] Build/type/test commands pass for touched modules.

---

## Commit Strategy

| After Task | Message                                                           | Files                                                         | Verification                 |
| ---------- | ----------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------- |
| 1          | `feat(sync): include edited articles in pageviews eligibility`    | `apps/api/src/services/sync.service.ts`                       | API build + targeted checks  |
| 2          | `feat(stats): add created-vs-edited pageview breakdown`           | `apps/api/src/routes/stats.ts`                                | endpoint response assertions |
| 3          | `docs(ops): add pageviews eligibility expansion backfill runbook` | docs/runbook file                                             | command dry-run review       |
| 4          | `chore(web): clarify article views total impact semantics`        | `apps/web/src/routes/articles.tsx`, `apps/web/src/lib/api.ts` | web build                    |
| 5          | `test(verification): capture created-edited impact evidence`      | `.sisyphus/evidence/*`                                        | scripted QA evidence         |

---

## Success Criteria

### Verification Commands

```bash
# API build/type check
moon run api:build

# Web build/type check
moon run web:build

# Trigger + poll sync (example)
curl -X POST http://localhost:3000/api/sync/trigger -H "Content-Type: application/json" -d '{"jobType":"pageviews"}'
curl http://localhost:3000/api/sync/status

# Dashboard breakdown check
curl http://localhost:3000/api/stats/dashboard
```

### Final Checklist

- [x] Created+edited eligibility active in pageviews sync.
- [x] Dashboard total and breakdown consistent.
- [x] Articles page wording reflects total-impact semantics.
- [x] Backfill runbook available and tested on small date window.
- [x] No duplicate pageview rows.
