# Article Sync Optimization - Learnings

## Completed: 2026-02-04

### Performance Results

- Sync duration: ~16 minutes (target was < 30 minutes)
- Total articles synced: 46,862
- New articles imported: 33,936
- Existing articles updated: 12,924
- Errors: 0

### Technical Implementation

#### Batch Processing Strategy

- Batch size: 100 articles per batch
- Concurrency: 5 parallel batches using p-limit
- Checkpoint interval: Every 1,000 articles for progress tracking
- This balances memory usage vs. transaction overhead

#### N+1 Query Elimination

- Pre-fetched all editors into Map<externalId, Editor> before processing
- Eliminated individual database lookups per article
- Significant performance improvement for 46K articles

#### Error Handling

- Used Promise.allSettled to handle individual article failures gracefully
- Errors collected in errorDetails array without stopping the sync
- Zero errors in production sync

#### Progress Tracking

- Updated sync_jobs.metadata every CHECKPOINT_INTERVAL (1,000) articles
- Metadata includes: totalExpected, processed, lastProcessedIndex, errors
- Allows monitoring and resumability

#### Duplicate Prevention

- Check for existing "running" job before starting new sync
- Return 409 Conflict if sync already in progress
- Prevents resource contention and duplicate work

### Environment Variables

```
OUTREACH_SCHOOL=OKA (default)
OUTREACH_SLUG=OKA (default)
OUTREACH_ARTICLE_SYNC_SCHEDULE=0 3 * * * (daily 03:00 UTC)
```

### Wiki Distribution

- en.wikipedia: 16,734 articles
- es.wikipedia: 7,071 articles
- pt.wikipedia: 23,057 articles

### Lessons Learned

1. p-limit is already in the lockfile - no new dependencies needed
2. Pre-fetching editors into Map is crucial for performance at scale
3. Promise.allSettled provides better error resilience than Promise.all
4. Progress tracking via metadata JSON field works well without schema changes
5. Scheduled cron at 03:00 UTC (1 hour after full sync) prevents conflicts
