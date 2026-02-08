# Bootstrap Full Sync - Operator Runbook

## Overview

The bootstrap system ensures that first-deployment data synchronization runs to completion before scheduled jobs begin. This prevents race conditions between initial data import and incremental updates.

### Bootstrap Lifecycle

```
pending → running → completed
   ↓         ↓
         failed → (retry) → running
```

- **pending**: Bootstrap not yet started (fresh deploy)
- **running**: Bootstrap full sync in progress
- **completed**: Bootstrap finished successfully, scheduled jobs enabled
- **failed**: Bootstrap failed, requires manual retry

## First Deploy Procedure

### 1. Pre-deployment Checklist

- [ ] Database migrations applied
- [ ] Environment variables configured (`SYNC_SCHEDULE`, `OUTREACH_SCHOOL`, etc.)
- [ ] API server can reach Wikimedia and Outreach Dashboard APIs
- [ ] Sufficient disk space for full sync

### 2. Deploy and Monitor

```bash
# Deploy application
moon run api:deploy

# Watch bootstrap initialization
moon run api:logs | grep -E "(Bootstrap|Server)"
```

Expected log sequence:

```
[Server] Database connection verified
[Server] Bootstrap state reconciled
[Server] Bootstrap pending - triggering first-deploy sync
[Server] Bootstrap watcher started
[Server] Scheduler started
```

### 3. Monitor Bootstrap Progress

```bash
# Check bootstrap status
curl -s http://localhost:3000/api/bootstrap/status | jq

# Watch sync jobs
curl -s http://localhost:3000/api/sync/status | jq '.jobs'
```

### 4. Verify Completion

```bash
# Bootstrap should show "completed"
curl -s http://localhost:3000/api/bootstrap/status | jq '.data.state'

# Scheduler jobs should show bootstrapBlocked: false
curl -s http://localhost:3000/api/scheduler | jq '.data.jobs[] | {id, bootstrapBlocked}'
```

## Monitoring Commands

### Check Bootstrap Status

```bash
curl -s http://localhost:3000/api/bootstrap/status | jq
```

Example responses:

**Pending:**

```json
{
  "success": true,
  "data": {
    "state": "pending",
    "isLeaseExpired": false
  }
}
```

**Running:**

```json
{
  "success": true,
  "data": {
    "state": "running",
    "startedAt": "2026-02-08T14:00:00Z",
    "leaseExpiresAt": "2026-02-10T14:00:00Z",
    "rootJobId": "cmlcb1qju10af8ujgqaedeo3z",
    "isLeaseExpired": false
  }
}
```

**Completed:**

```json
{
  "success": true,
  "data": {
    "state": "completed",
    "startedAt": "2026-02-08T14:00:00Z",
    "completedAt": "2026-02-08T20:30:00Z",
    "isLeaseExpired": false
  }
}
```

**Failed:**

```json
{
  "success": true,
  "data": {
    "state": "failed",
    "failedAt": "2026-02-08T18:00:00Z",
    "failureReason": "Rate limited by Wikimedia API",
    "isLeaseExpired": false
  }
}
```

### Check Scheduler Block Status

```bash
curl -s http://localhost:3000/api/scheduler | jq '.data.jobs[] | {id, bootstrapBlocked}'
```

During bootstrap, all jobs show `bootstrapBlocked: true`. After completion, all show `false`.

### Watch Sync Job Progress

```bash
# Monitor the root bootstrap job
curl -s http://localhost:3000/api/sync/jobs/{rootJobId} | jq '{status, metadata}'

# Or watch via admin UI at /admin/sync-jobs
```

## Recovery Procedures

### Scenario 1: Bootstrap Failed

**Symptoms:**

- Bootstrap status shows `state: "failed"`
- Scheduled jobs remain blocked
- Error message in `failureReason`

**Recovery:**

```bash
# 1. Check failure reason
curl -s http://localhost:3000/api/bootstrap/status | jq '.data.failureReason'

# 2. Address root cause (e.g., fix network, API credentials)

# 3. Retry bootstrap
curl -X POST http://localhost:3000/api/bootstrap/retry

# 4. Verify retry succeeded
curl -s http://localhost:3000/api/bootstrap/status | jq '.data.state'
```

### Scenario 2: Bootstrap Stuck (Lease Expired)

**Symptoms:**

- Bootstrap shows `state: "running"`
- `isLeaseExpired: true`
- Root job may be stuck or failed

**Recovery:**

```bash
# Check if lease expired
curl -s http://localhost:3000/api/bootstrap/status | jq '.data.isLeaseExpired'

# If true, the system will auto-mark as failed on next restart
# Or manually restart the server to trigger reconciliation

# Then retry
curl -X POST http://localhost:3000/api/bootstrap/retry
```

### Scenario 3: Need to Force Reset (Emergency Only)

**Warning:** Only use if bootstrap is corrupted and retry fails.

```bash
# Manually reset bootstrap state via database
# (Requires database access)
psql $DATABASE_URL -c "UPDATE bootstrap_state SET state='pending', startedAt=NULL, completedAt=NULL, failedAt=NULL, failureReason=NULL, rootJobId=NULL WHERE id='singleton';"

# Then restart server to trigger fresh bootstrap
```

### Scenario 4: Skip Bootstrap (Development Only)

**Warning:** Never skip bootstrap in production.

```bash
# Manually mark complete
curl -X POST http://localhost:3000/api/bootstrap/complete

# Or via database
psql $DATABASE_URL -c "UPDATE bootstrap_state SET state='completed', completedAt=NOW() WHERE id='singleton';"
```

## API Reference

### GET /api/bootstrap/status

Returns current bootstrap state.

**Response:**

```json
{
  "success": true,
  "data": {
    "state": "running",
    "startedAt": "2026-02-08T14:00:00Z",
    "completedAt": null,
    "leaseExpiresAt": "2026-02-10T14:00:00Z",
    "rootJobId": "abc123",
    "failedAt": null,
    "failureReason": null,
    "isLeaseExpired": false
  }
}
```

### POST /api/bootstrap/retry

Retries a failed bootstrap.

**Conditions:**

- Only works if `state: "failed"`
- Returns error if already running or completed

**Response:**

```json
{
  "success": true,
  "data": {
    "state": "running",
    ...
  }
}
```

### GET /api/scheduler

Returns scheduler status including bootstrap blocks.

**Response:**

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
        "bootstrapBlocked": true,
        ...
      }
    ]
  }
}
```

### POST /api/sync/trigger

Triggers a manual sync (only works after bootstrap complete).

**Body:**

```json
{
  "jobType": "full",
  "syncMode": "manual_full" // or "manual_backfill"
}
```

## Troubleshooting

### Bootstrap Not Starting

**Check:**

1. Database migrations applied: `moon run db:migrate`
2. BootstrapState row exists: `psql $DATABASE_URL -c "SELECT * FROM bootstrap_state;"`
3. Server logs for errors: `moon run api:logs`

### Scheduled Jobs Running During Bootstrap

**Symptoms:** Jobs executing while bootstrap incomplete.

**Fix:** This should not happen. Check:

1. Scheduler started after bootstrap check in `index.ts`
2. Bootstrap state is being read correctly
3. No manual override in place

### Duplicate Bootstrap Jobs

**Symptoms:** Multiple root sync jobs created.

**Fix:** The advisory lock should prevent this. If occurring:

1. Check for multi-instance deployment issues
2. Verify advisory lock is working: `SELECT * FROM pg_locks WHERE locktype='advisory';`
3. Kill duplicate jobs and retry

## Best Practices

1. **Monitor First Deploy:** Always watch bootstrap on first deployment to new environment
2. **Don't Restart During Bootstrap:** Unless bootstrap is stuck (lease expired)
3. **Check Lease Timeout:** Default 48h - increase if full sync takes longer
4. **Preserve Failed State:** Don't manually reset without investigating failure reason
5. **Use Incremental After Bootstrap:** Scheduled jobs automatically use incremental mode

## Evidence Artifacts

QA scenarios executed and evidence saved:

- `bootstrap-gate-status.json` - Verified scheduler blocks during bootstrap
- `bootstrap-unblock-status.json` - Verified scheduler unblocks after completion
- `bootstrap-lock-check.json` - Verified multi-instance safety
- `post-bootstrap-incremental.json` - Verified incremental mode after bootstrap
- `backfill-oldest-baseline.json` - Verified backfill from oldest date

## Support

For issues not covered by this runbook:

1. Check server logs: `moon run api:logs`
2. Review sync job details in admin UI: `/admin/sync-jobs`
3. Check database state directly
4. Consult plan documentation: `.sisyphus/plans/bootstrap-full-sync-gated-scheduler.md`
