# Outreach Dashboard Integration Work Plan

## TL;DR

> **Quick Summary**: Integrate OKA Stats Platform with Wikimedia Outreach Dashboard (https://outreachdashboard.wmflabs.org/courses/OKA/OKA/) to import 53 enrolled editors and their contribution data across 4 wiki projects (en, es, pt, commons). Creates automated sync pipeline for accountability reporting.
>
> **Deliverables**:
>
> - API client for Outreach Dashboard JSON endpoints
> - Sync service to import/update editors with deduplication
> - Database migration for unique externalId constraint
> - Admin UI for manual sync trigger and status monitoring
> - Documentation for API endpoints and data mapping
>
> **Estimated Effort**: Medium (2-3 days)
> **Parallel Execution**: YES - Tasks 1, 2, 3 can run in parallel after schema migration
> **Critical Path**: Schema migration → API Client → Sync Service → Admin UI

---

## Context

### Original Request

User wants to create reporting from the Outreach Dashboard course page (https://outreachdashboard.wmflabs.org/courses/OKA/OKA/) and ensure all data (JSON API or any format) can connect with the OKA Stats Platform application. Need to add missing documentation if incomplete, and create bd issues to break down tasks. Must support accountability reporting for OKA.

### Interview Summary

**Key Discussions**:

- Course URL: https://outreachdashboard.wmflabs.org/courses/OKA/OKA/
- Course ID: 33560
- Available endpoints: course.json, users.json, articles.json, uploads.json, assignments.json
- Public JSON API (no auth required)
- CSV exports require authentication (401 without login)
- 53 editors enrolled, tracking 4 wiki projects
- User wants beads issues created and full integration

**Research Findings**:

- Course stats: 123K edits, 46.8K articles edited, 73.9M words, 2.31B views
- Multi-wiki: en.wikipedia (51 users), pt.wikipedia (18 users), es.wikipedia (15 users), commons.wikimedia
- Words calculated as bytes/6 (matches our methodology)
- Articles.json is >5MB (too large for direct import)
- Existing codebase has WikimediaClient pattern in packages/utils/src/wikimedia/
- Existing SyncService in apps/api/src/services/sync.service.ts
- Schema already has source, externalId fields on Editor model

### Metis Review

**Identified Gaps** (addressed in plan):

- Editor.externalId is NOT @unique - requires migration
- Username format mismatch ("Maye Fernandez" vs "Maye_Fernandez") - needs normalization
- Data authority question (Dashboard vs Wikimedia API) - default to Dashboard for enrolled editors
- Articles.json too large - skip in Phase 1, focus on users first
- Sync frequency - align with existing daily sync pattern

**Critical Questions for User** (see below in Decisions Needed):

1. Data authority when Dashboard and Wikimedia API disagree
2. Historical backfill scope (all 4 years or start fresh)
3. Sync scope (new editors only vs replace roster)

---

## Work Objectives

### Core Objective

Create a complete integration pipeline that imports editor roster and contribution data from the Outreach Dashboard into the OKA Stats Platform, enabling automated accountability reporting without manual data entry.

### Concrete Deliverables

1. `packages/utils/src/outreach-dashboard/client.ts` - HTTP client for Dashboard API
2. `packages/utils/src/outreach-dashboard/types.ts` - TypeScript interfaces for API responses
3. Database migration adding `@unique` to Editor.externalId
4. `apps/api/src/services/outreach-sync.service.ts` - Sync service for Dashboard data
5. `apps/api/src/routes/outreach.ts` - API routes for Dashboard operations
6. `apps/web/src/routes/admin/outreach.tsx` - Admin UI for sync management
7. `docs/OUTREACH_DASHBOARD.md` - Integration documentation

### Definition of Done

- [ ] Can fetch course metadata from Dashboard API
- [ ] Can import all 53 editors with deduplication
- [ ] Sync job tracked in database with proper status
- [ ] Admin UI shows sync status and allows manual trigger
- [ ] All tests pass
- [ ] Documentation complete

### Must Have

- Editor import with deduplication by username
- Source tracking ('outreach_dashboard')
- External ID mapping for future syncs
- Username normalization (spaces → underscores)
- Sync job tracking in database
- Error handling for API failures

### Must NOT Have (Guardrails)

- NO bidirectional sync (read-only from Dashboard)
- NO real-time polling (< 1 hour intervals)
- NO articles.json import in Phase 1 (too large, >5MB)
- NO per-namespace stats tracking (use existing schema only)
- NO assignment tracking (out of scope)
- NO backfill of 4 years historical data without explicit user confirmation

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.

### Test Decision

- **Infrastructure exists**: YES (vitest configured in packages/utils)
- **Automated tests**: Tests-after (no TDD required for integration work)
- **Framework**: bun test / vitest

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

**Verification Tool by Deliverable Type:**

| Type              | Tool                          | How Agent Verifies                             |
| ----------------- | ----------------------------- | ---------------------------------------------- |
| **Backend/API**   | Bash (curl)                   | Send requests, parse JSON, assert fields       |
| **Database**      | Bash (prisma CLI)             | Query database, verify records                 |
| **Frontend/UI**   | Playwright (playwright skill) | Navigate, click, assert DOM                    |
| **Documentation** | Bash (grep)                   | Verify file exists, contains required sections |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately - Schema Foundation):
├── Task 1: Add externalId @unique migration
└── Task 2: Create docs/OUTREACH_DASHBOARD.md

Wave 2 (After Wave 1 - Core Implementation):
├── Task 3: Create OutreachDashboardClient
├── Task 4: Create types.ts for Dashboard API
└── Task 5: Add unit tests for client

Wave 3 (After Wave 2 - Backend Integration):
├── Task 6: Create OutreachSyncService
└── Task 7: Add API routes for Dashboard

Wave 4 (After Wave 3 - Frontend):
├── Task 8: Create admin UI components
└── Task 9: Create admin/outreach.tsx page

Wave 5 (After Wave 4 - Finalization):
└── Task 10: Update bd issue status and verify

Critical Path: Task 1 → Task 3 → Task 6 → Task 8 → Task 10
Parallel Speedup: ~30% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks  | Can Parallelize With |
| ---- | ---------- | ------- | -------------------- |
| 1    | None       | 3, 4, 5 | 2                    |
| 2    | None       | None    | 1                    |
| 3    | 1          | 6       | 4, 5                 |
| 4    | 1          | 6       | 3, 5                 |
| 5    | 1          | 6       | 3, 4                 |
| 6    | 3, 4       | 7       | None                 |
| 7    | 6          | 8       | None                 |
| 8    | 7          | 9       | None                 |
| 9    | 8          | 10      | None                 |
| 10   | 9          | None    | None                 |

---

## TODOs

- [x] 1. Database Migration: Add @unique to Editor.externalId

  **What to do**:
  - Create Prisma migration adding `@unique` attribute to `externalId` field in Editor model
  - Run migration to apply database changes
  - Regenerate Prisma client

  **Must NOT do**:
  - Do NOT change other fields
  - Do NOT drop existing data

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: [git-master]
  - Reason: Simple schema change, needs proper migration workflow

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: Tasks 3, 4, 5, 6
  - **Blocked By**: None

  **References**:
  - `packages/db/prisma/schema.prisma:43` - Editor model externalId field
  - `packages/db/prisma/schema.prisma:18-53` - Full Editor model
  - Prisma docs: https://www.prisma.io/docs/concepts/components/prisma-schema/data-model#unique-attributes

  **Acceptance Criteria**:
  - [x] Migration file created in `packages/db/prisma/migrations/`
  - [x] `externalId String? @unique` in schema
  - [x] `bun run db:migrate` completes successfully
  - [x] `bun run db:generate` creates updated client

  **Agent-Executed QA**:

  ```bash
  cd packages/db && bun prisma migrate dev --name add_external_id_unique
  bun run db:generate
  # Verify: grep -q "@unique" prisma/schema.prisma && echo "PASS" || echo "FAIL"
  ```

  **Commit**: YES
  - Message: `feat(db): add unique constraint to Editor.externalId`
  - Files: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*/`

- [x] 2. Documentation: Create docs/OUTREACH_DASHBOARD.md

  **What to do**:
  - Create comprehensive documentation for Outreach Dashboard integration
  - Include: API endpoints, data mapping, sync workflow, current stats
  - Document OKA course specifics (course ID 33560, URLs, statistics)

  **Must NOT do**:
  - Do NOT include implementation code
  - Do NOT duplicate README content

  **Recommended Agent Profile**:
  - **Category**: writing
  - **Skills**: []
  - Reason: Documentation task, no specialized skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - Current data: course.json shows 33560, 53 editors, 123K edits
  - `docs/HIGH_LEVEL_DESIGN.md` - Follow documentation style
  - Live endpoints: https://outreachdashboard.wmflabs.org/courses/OKA/OKA/course.json

  **Acceptance Criteria**:
  - [x] File created at `docs/OUTREACH_DASHBOARD.md`
  - [x] Contains: API endpoints table, data mapping, course stats
  - [x] Contains: Related bd issues (report-bbr, report-633, etc.)
  - [x] File is >100 lines

  **Agent-Executed QA**:

  ```bash
  test -f docs/OUTREACH_DASHBOARD.md && echo "PASS" || echo "FAIL"
  grep -q "course.json" docs/OUTREACH_DASHBOARD.md && echo "PASS" || echo "FAIL"
  grep -q "33560" docs/OUTREACH_DASHBOARD.md && echo "PASS" || echo "FAIL"
  wc -l docs/OUTREACH_DASHBOARD.md | awk '{print $1 "> 100 ? PASS : FAIL"}'
  ```

  **Commit**: YES
  - Message: `docs: add Outreach Dashboard integration guide`
  - Files: `docs/OUTREACH_DASHBOARD.md`

- [x] 3. Create OutreachDashboardClient in packages/utils

  **What to do**:
  - Create `packages/utils/src/outreach-dashboard/client.ts`
  - Implement HTTP client following WikimediaClient pattern
  - Methods: `getCourse()`, `getUsers()`, `getUploads()`
  - Handle errors, include retry logic

  **Must NOT do**:
  - Do NOT implement getArticles() yet (too large, >5MB)
  - Do NOT add authentication (public API)

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []
  - Reason: Moderate complexity, follows existing patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `packages/utils/src/wikimedia/client.ts:57-173` - Pattern to follow
  - `packages/utils/src/wikimedia/rate-limiter.ts` - Reuse rate limiting
  - Endpoints: `https://outreachdashboard.wmflabs.org/courses/OKA/OKA/{course,users,uploads}.json`

  **Acceptance Criteria**:
  - [x] Client class created with constructor accepting baseUrl
  - [x] `getCourse(school, slug)` returns course metadata
  - [x] `getUsers(school, slug)` returns array of 53 users
  - [x] `getUploads(school, slug)` returns uploads array
  - [x] Proper error handling with custom error class
  - [x] User-Agent header included

  **Agent-Executed QA**:

  ```bash
  bun test packages/utils/src/outreach-dashboard/client.test.ts
  # OR manual test:
  curl -s https://outreachdashboard.wmflabs.org/courses/OKA/OKA/course.json | jq '.course.id'
  # Assert: 33560
  ```

  **Commit**: YES
  - Message: `feat(utils): add OutreachDashboardClient`
  - Files: `packages/utils/src/outreach-dashboard/client.ts`

- [x] 4. Create TypeScript Types for Dashboard API

  **What to do**:
  - Create `packages/utils/src/outreach-dashboard/types.ts`
  - Define interfaces: OutreachCourse, OutreachUser, OutreachUpload
  - Match actual JSON response structure from live API

  **Must NOT do**:
  - Do NOT create types for articles.json (deferred)
  - Do NOT use `any` types

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []
  - Reason: Type definitions only

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 3, 6
  - **Blocked By**: Task 1

  **References**:
  - Live API responses:
    - course.json: `{course: {id, title, student_count, edit_count, ...}}`
    - users.json: `[{id, username, character_sum_ms, ...}]`
    - uploads.json: `[{id, file_name, uploader, ...}]`
  - `packages/utils/src/wikimedia/types.ts` - Pattern to follow

  **Acceptance Criteria**:
  - [x] `OutreachCourse` interface with all metadata fields
  - [x] `OutreachUser` interface with user fields
  - [x] `OutreachUpload` interface with file fields
  - [x] All required fields typed (no `any`)
  - [x] Exported from `packages/utils/src/outreach-dashboard/index.ts`

  **Agent-Executed QA**:

  ```bash
  bun run typecheck
  # OR verify TypeScript compiles without errors
  cd packages/utils && bun tsc --noEmit
  ```

  **Commit**: YES
  - Message: `feat(utils): add Outreach Dashboard API types`
  - Files: `packages/utils/src/outreach-dashboard/types.ts`, `index.ts`

- [x] 5. Add Unit Tests for OutreachDashboardClient

  **What to do**:
  - Create `packages/utils/src/outreach-dashboard/client.test.ts`
  - Mock API responses
  - Test: getCourse, getUsers, error handling

  **Must NOT do**:
  - Do NOT make real HTTP requests in tests (use mocks)

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []
  - Reason: Standard unit testing

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: Task 1

  **References**:
  - `packages/utils/src/wikimedia/__tests__/client.test.ts` - Pattern to follow
  - Vitest docs for mocking fetch

  **Acceptance Criteria**:
  - [x] Test file created
  - [x] Tests for getCourse() with mock response
  - [x] Tests for getUsers() with mock response
  - [x] Tests for error handling (404, 500)
  - [x] All tests pass: `bun test`

  **Agent-Executed QA**:

  ```bash
  cd packages/utils && bun test
  # Assert: All tests pass
  ```

  **Commit**: YES (squash with Task 3)
  - Message: `feat(utils): add OutreachDashboardClient with tests`
  - Files: `packages/utils/src/outreach-dashboard/client.test.ts`

- [x] 6. Create OutreachSyncService

  **What to do**:
  - Create `apps/api/src/services/outreach-sync.service.ts`
  - Implement `syncEditorsFromDashboard()` method
  - Handle: fetch users, normalize usernames, upsert to database
  - Track sync job in SyncJob table

  **Must NOT do**:
  - Do NOT sync articles yet (Phase 2)
  - Do NOT delete existing editors (only add/update)

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []
  - Reason: Business logic, database operations

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 3, 4, 5

  **References**:
  - `apps/api/src/services/sync.service.ts` - Pattern to follow
  - `apps/api/src/services/stats.service.ts` - Service structure
  - Prisma upsert pattern for Editor model

  **Acceptance Criteria**:
  - [x] Service class created
  - [x] `syncEditorsFromDashboard(school, slug)` method
  - [x] Username normalization: spaces → underscores
  - [x] Upsert logic: find by username, create or update
  - [x] Set source='outreach_dashboard', externalId from Dashboard
  - [x] Create SyncJob record with status tracking
  - [x] Return sync result stats (imported, updated, errors)

  **Agent-Executed QA**:

  ```bash
  # After running sync:
  curl -X POST http://localhost:3000/api/sync/outreach \
    -H "Content-Type: application/json" \
    -d '{"school": "OKA", "slug": "OKA"}'

  # Verify:
  curl http://localhost:3000/api/editors?source=outreach_dashboard | jq 'length'
  # Assert: 53
  ```

  **Commit**: YES
  - Message: `feat(api): add OutreachSyncService for editor import`
  - Files: `apps/api/src/services/outreach-sync.service.ts`

- [x] 7. Add API Routes for Dashboard Operations

  **What to do**:
  - Create `apps/api/src/routes/outreach.ts`
  - Routes: GET /api/outreach/course, POST /api/sync/outreach
  - Integrate with existing sync routes

  **Must NOT do**:
  - Do NOT add routes for articles (deferred)

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []
  - Reason: Route handlers, follows existing pattern

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 8
  - **Blocked By**: Task 6

  **References**:
  - `apps/api/src/routes/sync.ts` - Pattern to follow
  - `apps/api/src/routes/stats.ts` - Route structure
  - `apps/api/src/routes/index.ts` - Route registration

  **Acceptance Criteria**:
  - [x] Route file created
  - [x] GET /api/outreach/course - returns course metadata
  - [x] POST /api/sync/outreach - triggers sync job
  - [x] Proper error handling with 400/500 status codes
  - [x] Zod validation for request bodies
  - [x] Route registered in main router

  **Agent-Executed QA**:

  ```bash
  # Test course endpoint:
  curl http://localhost:3000/api/outreach/course | jq '.data.id'
  # Assert: 33560

  # Test sync endpoint:
  curl -X POST http://localhost:3000/api/sync/outreach \
    -H "Content-Type: application/json" \
    -d '{"school": "OKA", "slug": "OKA"}'
  # Assert: 202 Accepted with jobId
  ```

  **Commit**: YES
  - Message: `feat(api): add Outreach Dashboard API routes`
  - Files: `apps/api/src/routes/outreach.ts`, `index.ts`

- [x] 8. Create Admin UI Components for Sync Management

  **What to do**:
  - Create components in `apps/web/src/components/outreach/`
  - SyncButton, SyncStatusCard, LastSyncDisplay
  - Use shadcn/ui components

  **Must NOT do**:
  - Do NOT create complex configuration UI (keep simple)

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: [frontend-ui-ux]
  - Reason: UI components, needs good UX

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 9
  - **Blocked By**: Task 7

  **References**:
  - `apps/web/src/components/ui/` - shadcn/ui components
  - `apps/web/src/components/stats/` - Component patterns
  - TanStack Query for data fetching

  **Acceptance Criteria**:
  - [x] SyncButton component with loading state
  - [x] SyncStatusCard showing last sync info
  - [x] Components use TanStack Query
  - [x] Proper error handling and toast notifications

  **Agent-Executed QA**:

  ```bash
  # Build check:
  moon run web:build
  # Assert: No build errors
  ```

  **Commit**: YES
  - Message: `feat(web): add Outreach Dashboard admin components`
  - Files: `apps/web/src/components/outreach/*.tsx`

- [x] 9. Create Admin Outreach Sync Page

  **What to do**:
  - Create `apps/web/src/routes/admin/outreach.tsx`
  - Page with sync button, status display, editor count
  - Use components from Task 8

  **Must NOT do**:
  - Do NOT add authentication guards (assume public for now)

  **Recommended Agent Profile**:
  - **Category**: visual-engineering
  - **Skills**: [frontend-ui-ux]
  - Reason: Full page, routing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4
  - **Blocks**: Task 10
  - **Blocked By**: Task 8

  **References**:
  - `apps/web/src/routes/admin/editors/index.tsx` - Pattern to follow
  - TanStack Router file-based routing
  - RouteTree.gen.ts for type-safe routes

  **Acceptance Criteria**:
  - [x] Route file created at `admin/outreach.tsx`
  - [x] Page displays Outreach Dashboard info
  - [x] Sync button triggers API call
  - [x] Shows editor count from Dashboard
  - [x] Shows last sync timestamp
  - [x] Route accessible at `/admin/outreach`

  **Agent-Executed QA**:

  ```bash
  # Start dev server:
  moon run web:dev &

  # Verify route exists:
  curl -s http://localhost:3000/admin/outreach | head -20
  # Assert: Contains "Outreach Dashboard" or similar
  ```

  **Commit**: YES
  - Message: `feat(web): add admin Outreach Dashboard sync page`
  - Files: `apps/web/src/routes/admin/outreach.tsx`

- [x] 10. Finalize: Update bd Issues and Verify Integration

  **What to do**:
  - Close bd issues: report-bbr, report-633, report-umv, report-931, report-71k
  - Run full integration test
  - Verify all 53 editors imported

  **Must NOT do**:
  - Do NOT close issues until all acceptance criteria met

  **Recommended Agent Profile**:
  - **Category**: quick
  - **Skills**: []
  - Reason: Final verification

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5
  - **Blocks**: None
  - **Blocked By**: Task 9

  **References**:
  - bd issues: report-bbr, report-633, report-umv, report-931, report-71k

  **Acceptance Criteria**:
  - [x] All 5 bd issues closed with `bd close`
  - [x] Integration test passes: 53 editors in database
  - [x] All API endpoints responding correctly
  - [x] Admin UI functional
  - [x] Documentation complete

  **Agent-Executed QA**:

  ```bash
  # Count editors:
  curl http://localhost:3000/api/editors?source=outreach_dashboard | jq 'length'
  # Assert: 53

  # Check bd status:
  bd ready
  # Assert: No open Outreach Dashboard issues

  # Git status clean:
  git status
  # Assert: All changes committed
  ```

  **Commit**: NO (verification only)

---

## Commit Strategy

| After Task | Message                                                | Files                                              |
| ---------- | ------------------------------------------------------ | -------------------------------------------------- |
| 1          | `feat(db): add unique constraint to Editor.externalId` | schema.prisma, migrations/                         |
| 2          | `docs: add Outreach Dashboard integration guide`       | docs/OUTREACH_DASHBOARD.md                         |
| 3+5        | `feat(utils): add OutreachDashboardClient with tests`  | outreach-dashboard/client.ts, types.ts, \*.test.ts |
| 6          | `feat(api): add OutreachSyncService for editor import` | services/outreach-sync.service.ts                  |
| 7          | `feat(api): add Outreach Dashboard API routes`         | routes/outreach.ts                                 |
| 8          | `feat(web): add Outreach Dashboard admin components`   | components/outreach/\*.tsx                         |
| 9          | `feat(web): add admin Outreach Dashboard sync page`    | routes/admin/outreach.tsx                          |

---

## Success Criteria

### Verification Commands

```bash
# 1. Database migration applied
bun run db:migrate status

# 2. API client works
curl http://localhost:3000/api/outreach/course | jq '.data.id'
# Expected: 33560

# 3. Sync works
curl -X POST http://localhost:3000/api/sync/outreach -H "Content-Type: application/json" -d '{"school":"OKA","slug":"OKA"}'
# Expected: 202 with jobId

# 4. Editors imported
curl http://localhost:3000/api/editors?source=outreach_dashboard | jq 'length'
# Expected: 53

# 5. Admin UI accessible
open http://localhost:3000/admin/outreach
# Expected: Page loads with sync button

# 6. Tests pass
bun test
# Expected: All pass

# 7. Build succeeds
moon run :build
# Expected: Exit code 0
```

### Final Checklist

- [ ] All 10 tasks completed
- [ ] All 5 bd issues closed
- [ ] 53 editors imported from Dashboard
- [ ] API endpoints tested and working
- [ ] Admin UI functional
- [ ] Documentation complete
- [ ] Tests passing
- [ ] Build successful
- [ ] No lint errors

---

## Decisions Needed (Critical Questions from Metis)

Before starting execution, user must answer:

### 1. Data Authority (CRITICAL) ✅ DECIDED

**Question**: When Dashboard stats differ from Wikimedia API (e.g., Dashboard says 15M chars, API says 14.5M), which is the source of truth?

**Decision**: (a) Dashboard is truth for enrolled editors

**Rationale**: Simpler implementation, Dashboard already aggregates data correctly for the 53 enrolled editors.

### 2. Historical Backfill (CRITICAL) ✅ DECIDED

**Question**: Course started 2022-05-06 (4 years ago). Should we backfill all historical data or start from now?

**Decision**: (c) Backfill last 12 months only

**Rationale**: Balanced approach - gets recent meaningful data without overwhelming initial sync.

### 3. Sync Scope (CRITICAL) ✅ DECIDED

**Question**: On sync, should we add only NEW editors or replace the entire roster?

**Decision**: (c) Mark removed editors as inactive, keep history

**Rationale**: Preserves historical data integrity while keeping roster in sync with Dashboard.

### 4. Sync Frequency

**Question**: Dashboard updates every ~3 hours. How often should we sync?

**Options**:

- [ ] (a) Daily (align with existing sync schedule)
- [ ] (b) Every 3 hours (match Dashboard cadence)
- [ ] (c) Manual trigger only

**Default if no answer**: (a) Daily

### 5. Username Normalization

**Question**: Dashboard uses "Maye Fernandez", our schema expects "Maye_Fernandez". Should we normalize on import?

**Options**:

- [ ] (a) Yes, normalize spaces to underscores (recommended)
- [ ] (b) No, store as-is

**Default if no answer**: (a) Yes, normalize

---

## Guardrails Applied (from Metis Review)

| Guardrail                          | Rationale                                             |
| ---------------------------------- | ----------------------------------------------------- |
| NO bidirectional sync              | Dashboard is read-only source of truth                |
| NO real-time polling < 1h          | Respects API rate limits, aligns with batch updates   |
| NO articles.json import in Phase 1 | File is >5MB, requires streaming/pagination solution  |
| NO per-namespace stats             | Keep schema simple, use existing tables only          |
| NO assignment tracking             | Out of scope for accountability reporting             |
| NO backfill without confirmation   | 4 years of data is significant, get explicit approval |

---

## Related Resources

- **Course URL**: https://outreachdashboard.wmflabs.org/courses/OKA/OKA/
- **API Endpoints**:
  - https://outreachdashboard.wmflabs.org/courses/OKA/OKA/course.json
  - https://outreachdashboard.wmflabs.org/courses/OKA/OKA/users.json
  - https://outreachdashboard.wmflabs.org/courses/OKA/OKA/uploads.json
- **bd Issues**: report-bbr, report-633, report-umv, report-931, report-71k
- **Existing Patterns**:
  - `packages/utils/src/wikimedia/client.ts`
  - `apps/api/src/services/sync.service.ts`
  - `apps/api/src/routes/sync.ts`

---

_Plan generated by Prometheus. Execute with `/start-work`_
