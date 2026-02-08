# Fix Plan: `pageview.findMany()` "column does not exist"

## TL;DR

> Runtime error is caused by **schema drift** between Prisma model and actual DB table `pageviews`.
> API now queries fields that are in Prisma schema but not present in the current database.

---

## Suspected Root Cause

- Code path in `apps/api/src/routes/stats.ts` filters by `agentType` and uses latest daily/cumulative rows.
- Prisma model `Pageview` includes `agentType` (mapped to DB column `agent_type`) and related constraints.
- DB likely has older `pageviews` structure (migration not applied), so query fails with "column does not exist".

---

## Recovery Plan

1. **Confirm migration state**
   - Check pending Prisma migrations for `packages/db/prisma/schema.prisma`.
2. **Apply missing migrations**
   - Run deploy migration command against the active DB.
3. **Regenerate Prisma client**
   - Ensure generated client matches current schema.
4. **Restart API process**
   - Restart `api:dev` so runtime uses updated schema/client state.
5. **Smoke test critical endpoints**
   - `GET /api/stats/dashboard`
   - `GET /api/stats/sync-status`
   - `GET /api/sync/status`

---

## Validation Criteria

- No more `Invalid prisma.pageview.findMany()` errors in API logs.
- `dashboard` and `sync-status` return success payloads.
- Bootstrap process continues and scheduler logs show expected gating behavior.

---

## Fallback (if migration cannot run immediately)

- Temporary hotfix branch: remove `agentType` filter in failing queries and use safest compatible selection.
- Mark as temporary and revert after migration is applied.

---

## Operator Command Checklist (for execution agent)

```bash
# 1) check migration status
bunx prisma migrate status --schema packages/db/prisma/schema.prisma

# 2) apply migrations
bunx prisma migrate deploy --schema packages/db/prisma/schema.prisma

# 3) regenerate client
bunx prisma generate --schema packages/db/prisma/schema.prisma

# 4) restart api process
# (use your local process manager/dev script)

# 5) verify endpoints
curl -s http://localhost:3000/api/stats/dashboard
curl -s http://localhost:3000/api/stats/sync-status
curl -s http://localhost:3000/api/sync/status
```
