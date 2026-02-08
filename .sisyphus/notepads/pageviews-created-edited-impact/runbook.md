# Pageviews Eligibility Expansion - Operator Runbook

## Overview

This runbook guides operators through expanding pageviews sync eligibility from created-only articles to created+edited articles. After this change, pageviews will track both:

- Articles **created** by tracked editors (original behavior)
- Articles **edited** by tracked editors (new behavior)

## What Changed

### Before

- Pageviews sync only processed articles with `createdByEditorId != null`
- Approximately ~13k articles eligible

### After

- Pageviews sync processes articles with `createdByEditorId` OR active editor contributions
- Approximately ~46k articles eligible

## Pre-Deployment Checklist

Before deploying the eligibility expansion:

- [ ] Review current pageviews data: `SELECT COUNT(*) FROM pageviews;`
- [ ] Estimate additional API load (~3x more articles)
- [ ] Ensure Wikimedia API rate limits are sufficient
- [ ] Schedule during low-traffic period
- [ ] Notify team of potential sync duration increase

## Post-Deployment Backfill Procedure

### Option 1: Let Scheduled Sync Handle It (Recommended)

The scheduled daily sync will automatically pick up edited-only articles on its next run:

```bash
# Check when next sync is scheduled
curl http://localhost:3000/api/scheduler | jq '.data.jobs[] | select(.id == "full-sync") | .schedule'

# Monitor the next sync execution
curl http://localhost:3000/api/sync/status
```

### Option 2: Manual Immediate Backfill

If you need to backfill immediately:

```bash
# 1. Trigger manual pageviews sync
# Note: This runs incrementally (last 30 days by default)
curl -X POST http://localhost:3000/api/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"jobType":"pageviews"}'

# 2. Get the job ID from response and monitor
# Example: {"jobId": "cmlcb1qju10af8ujgqaedeo3z"}

# 3. Poll for completion
curl http://localhost:3000/api/sync/jobs/{jobId} | jq '{status, metadata}'

# 4. Verify expanded article count in metadata
# Look for totalArticles > previous baseline (~13k)
```

### Option 3: Full Historical Backfill

For complete historical data on edited-only articles:

```bash
# Trigger full sync with manual_full mode
curl -X POST http://localhost:3000/api/sync/trigger \
  -H "Content-Type: application/json" \
  -d '{"jobType":"full","syncMode":"manual_full"}'

# This will process all eligible articles from creation date
# Warning: May take several hours
```

## Monitoring Progress

### Check Dashboard Breakdown

```bash
# Get pageviews breakdown
curl http://localhost:3000/api/stats/dashboard | jq '.data | {
  total: .pageviews,
  created: .pageviewsFromCreatedArticles,
  edited: .pageviewsFromEditedArticles
}'
```

Expected after backfill:

```json
{
  "total": 2500000000,
  "created": 1800000000,
  "edited": 700000000
}
```

Note: `total` may be slightly less than `created + edited` due to source-aware calculation differences (cumulative vs daily).

### Monitor Sync Job

```bash
# List active sync jobs
curl http://localhost:3000/api/sync/status | jq '.jobs[] | {id, jobType, status, metadata}'

# Check specific job
curl http://localhost:3000/api/sync/jobs/{jobId} | jq '{
  status,
  startedAt,
  metadata: {
    totalArticles,
    processedArticles,
    skipped404Count
  }
}'
```

### Database Queries

```bash
# Count distinct articles with pageviews
psql $DATABASE_URL -c "SELECT COUNT(DISTINCT article_id) FROM pageviews;"

# Check article coverage before/after
psql $DATABASE_URL -c "
SELECT
  COUNT(DISTINCT a.id) as total_articles,
  COUNT(DISTINCT CASE WHEN a.created_by_editor_id IS NOT NULL THEN a.id END) as created_articles,
  COUNT(DISTINCT CASE WHEN a.created_by_editor_id IS NULL AND EXISTS (
    SELECT 1 FROM contributions c WHERE c.article_id = a.id
  ) THEN a.id END) as edited_only_articles,
  COUNT(DISTINCT p.article_id) as articles_with_pageviews
FROM articles a
LEFT JOIN pageviews p ON a.id = p.article_id;
"
```

## Rollback Plan

If issues arise after expansion:

### Immediate Rollback (Code)

```bash
# Revert the sync.service.ts filter change
# Change OR condition back to created-only filter
# Redeploy
```

### Data Rollback (Not Recommended)

```bash
# If you need to remove pageviews for edited-only articles
# (Only do this if absolutely necessary)

psql $DATABASE_URL -c "
DELETE FROM pageviews
WHERE article_id IN (
  SELECT id FROM articles
  WHERE created_by_editor_id IS NULL
);
"
```

### Partial Rollback (Keep Data, Disable Future Sync)

```bash
# Disable pageviews sync temporarily via scheduler
curl -X PATCH http://localhost:3000/api/scheduler/pageviews \
  -H "Content-Type: application/json" \
  -d '{"enabled": false, "reason": "Temporary disable for investigation"}'
```

## Troubleshooting

### Issue: Sync Taking Too Long

**Symptoms:** Pageviews sync running for hours

**Investigation:**

```bash
# Check if processing many new articles
curl http://localhost:3000/api/sync/jobs/{jobId} | jq '.metadata.totalArticles'

# Check API rate limits in logs
moon run api:logs | grep -i "rate\|429\|throttle"
```

**Resolution:**

- This is expected for first backfill after expansion
- Consider running during off-peak hours
- Future scheduled syncs will be incremental (faster)

### Issue: Dashboard Numbers Don't Match

**Symptoms:** `pageviews != created + edited`

**Explanation:**
This is expected due to:

1. Source-aware calculation (cumulative vs daily)
2. Some articles may have both created and edited contributions
3. Timing differences in snapshot calculation

**Verification:**

```bash
# Check individual article counts
curl http://localhost:3000/api/stats/dashboard | jq '.data | {
  articlesCreated,
  articlesEdited,
  totalArticles: (.articlesCreated + .articlesEdited)
}'
```

### Issue: Missing Edited-Only Articles

**Symptoms:** `pageviewsFromEditedArticles` is 0 or very low

**Investigation:**

```bash
# Check if edited-only articles exist
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM articles a
WHERE a.created_by_editor_id IS NULL
  AND EXISTS (
    SELECT 1 FROM contributions c
    JOIN editors e ON c.editor_id = e.id
    WHERE c.article_id = a.id AND e.is_active = true
  );
"

# Check if pageviews sync ran successfully
curl http://localhost:3000/api/sync/status | jq '.jobs[] | select(.jobType == "pageviews") | {status, completedAt}'
```

## Verification Checklist

After backfill completion:

- [ ] Dashboard shows `pageviewsFromEditedArticles` > 0
- [ ] Total articles with pageviews increased significantly
- [ ] Scheduled sync completes successfully (monitor 2-3 runs)
- [ ] No new errors in application logs
- [ ] API response times remain acceptable

## Support

For issues not covered by this runbook:

1. Check sync job logs: `moon run api:logs | grep -i pageviews`
2. Review detailed job status in admin UI: `/admin/sync-jobs`
3. Query database directly for article/pageview counts
4. Consult plan documentation: `.sisyphus/plans/pageviews-created-edited-impact.md`

## Related Documentation

- Bootstrap runbook: `.sisyphus/notepads/bootstrap-full-sync-gated-scheduler/runbook.md`
- Original plan: `.sisyphus/plans/pageviews-created-edited-impact.md`
- API endpoints: See `apps/api/src/routes/stats.ts` and `sync.ts`
