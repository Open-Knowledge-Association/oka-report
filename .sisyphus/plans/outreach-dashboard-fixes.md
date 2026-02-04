# Outreach Dashboard Integration - Bug Fixes

## TL;DR

> **Quick Summary**: Fix two critical bugs discovered after the initial Outreach Dashboard integration: missing TanStack Router Route export and no data import.
>
> **Deliverables**:
>
> - Fixed `admin/outreach.tsx` with proper TanStack Router export
> - 53 editors imported from Outreach Dashboard to database
>
> **Estimated Effort**: Quick (30 minutes)
> **Parallel Execution**: NO - sequential fixes
> **Critical Path**: Fix Route → Verify Build → Import Data → Verify → Push

---

## Context

### Original Plan

The Outreach Dashboard Integration plan (`.sisyphus/plans/outreach-dashboard-integration.md`) shows all 10 tasks complete, but testing revealed:

1. The admin outreach page doesn't work because it's missing the TanStack Router Route export
2. No editors were actually imported (database has 0 records)

### What Exists

- All implementation files are in place
- 4 commits are local (not pushed to origin)
- API client, sync service, routes, and UI components exist

---

## TODOs

- [x] 1. Fix TanStack Router Route Export

  **What to do**:
  - Modify `apps/web/src/routes/admin/outreach.tsx`
  - Add `import { createFileRoute } from "@tanstack/react-router"`
  - Add `export const Route = createFileRoute("/admin/outreach")({ component: OutreachAdminPage })`
  - Remove `export default` from the function

  **Must NOT do**:
  - Do NOT change the component logic
  - Do NOT rename the component function

  **References**:
  - Pattern: `apps/web/src/routes/admin/editors/index.tsx:1,17-19` - createFileRoute pattern
  - Current file: `apps/web/src/routes/admin/outreach.tsx` - needs fix

  **Acceptance Criteria**:
  - [x] `grep -q "createFileRoute" apps/web/src/routes/admin/outreach.tsx` → PASS
  - [x] `grep -q "export const Route" apps/web/src/routes/admin/outreach.tsx` → PASS
  - [x] `moon run web:build` → No errors

  **Commit**: YES
  - Message: `fix(web): add TanStack Router Route export to admin/outreach`
  - Files: `apps/web/src/routes/admin/outreach.tsx`

- [x] 2. Verify Build Succeeds

  **What to do**:
  - Run `moon run web:build` to verify no TypeScript or build errors
  - Verify the route tree is regenerated correctly

  **Acceptance Criteria**:
  - [x] `moon run web:build` exits with code 0
  - [x] `grep -q "outreach" apps/web/src/routeTree.gen.ts` → PASS

  **Commit**: NO (verification only)

- [x] 3. Import Editors from Outreach Dashboard

  **What to do**:
  - Start the API server
  - Call POST /api/sync/outreach to trigger sync
  - Verify 53 editors are imported

  **References**:
  - API endpoint: `apps/api/src/routes/outreach.ts`
  - Sync service: `apps/api/src/services/outreach-sync.service.ts`

  **Acceptance Criteria**:
  - [x] `curl -X POST http://localhost:3000/api/sync/outreach -H "Content-Type: application/json" -d '{"school":"OKA","slug":"OKA"}'` → 200/202
  - [x] `curl http://localhost:3000/api/editors?source=outreach_dashboard | jq 'length'` → 54 (53 students + 1 instructor)
  - [x] Database contains editors with source='outreach_dashboard'

  **Commit**: NO (data import, no code changes)

- [x] 4. Verify Full Integration

  **What to do**:
  - Start both API and web dev servers
  - Navigate to /admin/outreach
  - Verify page loads and shows data

  **Acceptance Criteria**:
  - [x] `moon run api:dev` starts successfully
  - [x] `moon run web:dev` starts successfully
  - [x] `/admin/outreach` page loads without errors
  - [x] Page shows course stats (Course ID: 33560)
  - [x] Page shows imported editor count

  **Commit**: NO (verification only)

- [x] 5. Push All Commits to Remote

  **What to do**:
  - Git pull --rebase to sync with remote
  - Push all local commits (4 existing + 1 fix)
  - Verify push succeeds

  **Acceptance Criteria**:
  - [x] `git push` succeeds
  - [x] `git status` shows "up to date with origin"

  **Commit**: NO (push existing commits)

---

## Commit Strategy

| After Task | Message                                                        | Files              |
| ---------- | -------------------------------------------------------------- | ------------------ |
| 1          | `fix(web): add TanStack Router Route export to admin/outreach` | admin/outreach.tsx |

---

## Success Criteria

### Final Checklist

- [x] TanStack Router Route export added
- [x] Build succeeds
- [x] 54 editors imported to database (53 students + 1 instructor)
- [x] Admin outreach page accessible at /admin/outreach
- [x] All commits pushed to remote
