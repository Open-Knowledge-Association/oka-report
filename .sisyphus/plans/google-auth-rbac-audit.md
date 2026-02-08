# Google OAuth + Full RBAC + Audit (TDD)

## TL;DR

> **Quick Summary**: Add Google-only authentication with secure server sessions, enforce role-based access control (`viewer`, `editor`, `admin`) on frontend and API, and persist an audit trail for auth/admin actions.
>
> **Deliverables**:
>
> - Google OAuth auth routes and session handling
> - RBAC middleware + route guards
> - Audit log table + logging service
> - Auth management endpoints (no full admin UI in v1)
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 4 -> Task 7

---

## Context

### Original Request

User requested authentication with Google login and auth management; selected **Full RBAC + Audit** for v1 and **TDD** strategy.

### Interview Summary

**Key decisions**:

- Provider: Google OAuth only (no password login in v1).
- Security model: server session cookie (`httpOnly`) with server-side checks.
- RBAC v1: `viewer`, `editor`, `admin`.
- Include audit logging from first release.

**Research Findings**:

- Frontend integration points: `apps/web/src/routes/__root.tsx`, `apps/web/src/components/Header.tsx`, `apps/web/src/lib/api.ts`.
- Backend integration points: `apps/api/src/index.ts`, `apps/api/src/routes/index.ts`, middleware pattern in `apps/api/src/middleware`.
- Existing test infra: Vitest/Testing Library in web + integration-style tests in API.

### Metis Review

**Gaps resolved**:

- Domain restriction ambiguity -> default to **no domain restriction** (override via env later).
- User onboarding ambiguity -> default to auto-create user on first login with `viewer` role.
- Scope creep risk -> no full user admin UI in v1, only API/management primitives.
- Security guardrails added: CSRF-safe OAuth flow, secure cookies, strict server-side role checks.

---

## Work Objectives

### Core Objective

Implement production-grade Google authentication with enforceable RBAC and auditable admin/auth actions without breaking existing app behavior.

### Concrete Deliverables

- Auth route module: `/api/auth/*`.
- Auth/session middleware for Hono context.
- Role-check middleware and protected route wiring.
- Audit persistence model + audit write helper.
- Frontend auth context + header login/logout identity state.

### Definition of Done

- [x] Unauthenticated access to protected endpoints returns 401.
- [x] Insufficient role returns 403.
- [x] Google login establishes session and `/api/auth/session` returns user.
- [x] Audit records are written for login/logout/role changes/sync triggers.
- [x] Tests pass in RED-GREEN-REFACTOR workflow for each task.

### Must Have

- Server-side auth checks (client checks are UX only).
- `viewer`, `editor`, `admin` role model enforced at API.
- Session revocation (logout invalidates session).
- Audit table with actor/action/target/timestamp.

### Must NOT Have (Guardrails)

- No token storage in localStorage.
- No password/local auth flow in v1.
- No fine-grained permission matrix beyond role-based checks.
- No destructive migration of unrelated tables.

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> Every verification must be executable by agent via command/tool.

### Test Decision

- **Infrastructure exists**: YES
- **Automated tests**: TDD (RED-GREEN-REFACTOR)
- **Framework**: Vitest (+ existing API/web test setup)

### If TDD Enabled

For each implementation task:

1. **RED**: Add failing tests first (`bun test` / `vitest run`).
2. **GREEN**: Implement minimal code to pass.
3. **REFACTOR**: Clean structure while preserving green tests.

### Agent-Executed QA Scenarios

Scenario: Unauthenticated access rejected
Tool: Bash (curl)
Preconditions: API running, auth middleware enabled
Steps: 1. `curl -s -o /tmp/out.json -w "%{http_code}" -X POST http://localhost:3000/api/sync/trigger -H "Content-Type: application/json" -d '{"jobType":"full"}'` 2. Assert status code is `401`. 3. Assert `/tmp/out.json` contains error code `unauthorized`.
Expected Result: Protected endpoint blocked.
Evidence: `.sisyphus/evidence/auth-unauthorized.json`

Scenario: Role guard rejects viewer for admin action
Tool: Bash (curl)
Preconditions: Test viewer session cookie available
Steps: 1. Call protected admin endpoint with viewer cookie. 2. Assert status code `403`. 3. Assert response code `forbidden`.
Expected Result: Role enforcement works server-side.
Evidence: `.sisyphus/evidence/auth-forbidden.json`

Scenario: Session lifecycle login -> session -> logout
Tool: Bash (curl)
Preconditions: Mock/test auth flow or local OAuth callback fixture in tests
Steps: 1. Trigger test login callback path. 2. Call `/api/auth/session` with returned cookie and assert user payload. 3. Call `/api/auth/logout` and then `/api/auth/session` again. 4. Assert second session request returns 401/null.
Expected Result: Session created and revoked correctly.
Evidence: `.sisyphus/evidence/auth-session-lifecycle.json`

Scenario: Audit trail written for auth/admin events
Tool: Bash (DB query)
Preconditions: Test DB accessible
Steps: 1. Execute login + admin action in test. 2. Query audit table for actor and action keys. 3. Assert rows exist with expected fields (`action`, `actorId`, `createdAt`).
Expected Result: Mandatory audit coverage present.
Evidence: `.sisyphus/evidence/auth-audit.txt`

---

## Execution Strategy

### Parallel Execution Waves

Wave 1:

- Task 1: Auth data model + migrations + test fixtures
- Task 2: Auth route skeleton + session middleware

Wave 2:

- Task 3: Google OAuth flow + session endpoints
- Task 4: RBAC middleware + protected API wiring
- Task 5: Audit logging model + service

Wave 3:

- Task 6: Frontend auth provider + Header login/logout UX
- Task 7: Route guards + API client auth handling
- Task 8: End-to-end TDD verification + evidence capture

Critical Path: 1 -> 2 -> 4 -> 7 -> 8

### Dependency Matrix

| Task | Depends On | Blocks  | Can Parallelize With |
| ---- | ---------- | ------- | -------------------- |
| 1    | None       | 2,5     | None                 |
| 2    | 1          | 3,4,6,7 | 5                    |
| 3    | 2          | 6,7,8   | 5                    |
| 4    | 2          | 7,8     | 5                    |
| 5    | 1          | 8       | 2,3,4                |
| 6    | 2,3        | 7,8     | None                 |
| 7    | 3,4,6      | 8       | None                 |
| 8    | 3,4,5,7    | None    | None                 |

---

## TODOs

- [x] 1. Add auth/audit schema extensions and test fixtures (TDD)

  **What to do**:
  - RED: Add failing tests for user role defaults, session persistence, audit write shape.
  - Add/extend Prisma models for session linkage and audit entries.
  - GREEN: Apply migration and satisfy failing tests.
  - REFACTOR: Keep schema minimal and documented.

  **References**:
  - `packages/db/prisma/schema.prisma`
  - `apps/api/src/__tests__/`

  **Acceptance Criteria**:
  - [x] Migration applies cleanly.
  - [x] Tests for model invariants pass.

- [x] 2. Implement auth middleware and `/api/auth/session|logout` base routes (TDD)

  **What to do**:
  - RED: tests for unauthenticated 401 and session lookup.
  - Create auth middleware that injects `user/session` into context.
  - Add `GET /api/auth/session` and `POST /api/auth/logout`.
  - Mount routes in `apps/api/src/routes/index.ts` and server in `apps/api/src/index.ts`.

  **References**:
  - `apps/api/src/index.ts`
  - `apps/api/src/routes/index.ts`
  - `apps/api/src/middleware/error-handler.ts`

  **Acceptance Criteria**:
  - [x] `/api/auth/session` returns current user for valid session.
  - [x] `/api/auth/logout` revokes session.

- [x] 3. Implement Google OAuth login/callback flow (TDD)

  **What to do**:
  - RED: tests for callback success/failure/state mismatch.
  - Add Google signin redirect + callback handlers.
  - Auto-provision first-login user as `viewer`.
  - Persist secure session cookie.

  **References**:
  - `apps/api/src/routes/auth.ts` (new)
  - `apps/api/src/services/` auth helpers

  **Acceptance Criteria**:
  - [x] Successful callback creates session.
  - [x] Invalid state/callback path rejected.

- [x] 4. Add role middleware and protect admin/mutating endpoints (TDD)

  **What to do**:
  - RED: tests for 403 on role mismatch.
  - Add role guard middleware (`requireRole`).
  - Apply to mutating endpoints and admin operations.

  **References**:
  - `apps/api/src/routes/sync.ts`
  - `apps/api/src/routes/scheduler.ts`
  - `apps/api/src/routes/editors.ts`

  **Acceptance Criteria**:
  - [x] Viewer cannot execute admin actions.
  - [x] Admin/editor permissions match policy.

- [x] 5. Implement audit logging for auth/admin actions (TDD)

  **What to do**:
  - RED: tests assert audit rows are created.
  - Add audit write helper and table usage.
  - Hook into login/logout/role-change/sync-trigger actions.

  **References**:
  - `apps/api/src/services/` (audit service)
  - `packages/db/prisma/schema.prisma`

  **Acceptance Criteria**:
  - [x] Audit events persist with actor/action/timestamp.

- [x] 6. Add frontend auth provider and Header auth UX (TDD)

  **What to do**:
  - RED: component tests for signed-out/signed-in header states.
  - Add auth context/provider and session hydration.
  - Add Header actions: Sign in with Google / Logout / identity display.

  **References**:
  - `apps/web/src/routes/__root.tsx`
  - `apps/web/src/components/Header.tsx`
  - `apps/web/src/test-utils.tsx`

  **Acceptance Criteria**:
  - [x] Header reflects auth state correctly.

- [x] 7. Protect frontend routes + API client auth handling (TDD)

  **What to do**:
  - RED: route guard tests and 401 handling tests.
  - Update `apiFetch` for session-aware requests and 401 behavior.
  - Add route guards for `/admin/*` paths.

  **References**:
  - `apps/web/src/lib/api.ts`
  - `apps/web/src/router.tsx`
  - `apps/web/src/routeTree.gen.ts`

  **Acceptance Criteria**:
  - [x] Unauthenticated users redirected/blocked from protected UI routes.
  - [x] API client handles 401 consistently.

- [x] 8. Execute full verification suite and capture evidence

  **What to do**:
  - Run API/web tests + build.
  - Run curl/DB checks from QA scenarios.
  - Save artifacts under `.sisyphus/evidence/`.

  **Acceptance Criteria**:
  - [x] All TDD suites green (18 tests pass).
  - [x] Both API and Web builds pass.

---

## Commit Strategy

| After Task | Message                                             | Files                      | Verification          |
| ---------- | --------------------------------------------------- | -------------------------- | --------------------- |
| 1          | `feat(auth): add auth and audit data models`        | prisma schema + tests      | migration + tests     |
| 2-3        | `feat(auth): add google oauth and session routes`   | api routes/services        | api tests             |
| 4-5        | `feat(auth): enforce rbac and audit logging`        | middleware/routes/services | api tests + db checks |
| 6-7        | `feat(web): add auth provider and protected routes` | web routes/components/lib  | web tests + build     |
| 8          | `test(auth): add e2e verification evidence`         | evidence files             | full verification     |

---

## Success Criteria

### Verification Commands

```bash
# API tests/build
moon run api:build

# Web tests/build
moon run web:build

# Session + auth checks
curl -s http://localhost:3000/api/auth/session
curl -s http://localhost:3000/api/scheduler
```

### Final Checklist

- [x] Google login works end-to-end.
- [x] RBAC blocks unauthorized actions.
- [x] Audit events are persisted for required actions.
- [x] Admin routes are protected.
- [x] Test and build pipeline remains green.
