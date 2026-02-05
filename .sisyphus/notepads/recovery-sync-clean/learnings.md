# Recovery Sync Clean - Learnings

## Session: ses_3dc0d08abffeq14CPkWDntyrdn

## Date: 2026-02-05

## Status: ✅ COMPLETED

---

## What Was Done

### Problem

Server crashed during article sync at 34% (16,000/46,887 articles), leaving a sync job stuck with `status: "running"`.

### Solution

1. **Checked server status** - API was already running on localhost:3000
2. **Identified stuck job** - Found 1 job with status "running" from previous crash
3. **Reset stuck jobs** - Used Prisma to update status to "failed"
4. **Triggered new sync** - POST to /api/outreach/articles/sync
5. **Verified sync running** - New job ID: cml8zhh6n02m7pbjguqm0dlox
6. **Verified editor relationships** - All sample articles have editorCount: 1

---

## Commands Used

```bash
# Check server
curl -s "http://localhost:3000/api/editors?limit=1" | head -c 100

# Check sync jobs
curl -s "http://localhost:3000/api/sync/history?limit=5" | jq '.data[] | {id, jobType, status}'

# Reset stuck jobs
cd /home/rio/Works/oka/report/packages/db
echo "UPDATE sync_jobs SET status = 'failed' WHERE status = 'running';" | bunx prisma db execute --stdin

# Trigger new sync
curl -X POST "http://localhost:3000/api/outreach/articles/sync" \
  -H "Content-Type: application/json" \
  -d '{"school": "OKA", "slug": "OKA"}'

# Verify sync running
curl -s "http://localhost:3000/api/sync/history?limit=1" | jq '.data[0]'

# Verify articles have editors
curl -s "http://localhost:3000/api/outreach/articles/db?limit=5" | jq '.data.articles | map({title, editorCount: (.editors | length)})'
```

---

## Key Findings

1. **Sync service works correctly** - Articles are properly matched with editors
2. **Prisma db execute** is the fastest way to fix stuck database records
3. **Sync uses upsert** - Re-running sync won't create duplicates
4. **Editor relationships verified** - Sample articles all show editorCount: 1

---

## Files Involved

- `/home/rio/Works/oka/report/apps/api/src/services/outreach-article-sync.service.ts` - Article sync logic
- `/home/rio/Works/oka/report/apps/api/src/routes/sync.ts` - Sync API endpoints
- `/home/rio/Works/oka/report/packages/db/prisma/schema.prisma` - Database schema

---

## Next Steps

- Monitor sync progress via `/api/sync/history`
- Full sync takes ~2-3 hours for 46,887 articles
- Sync will continue running in background
