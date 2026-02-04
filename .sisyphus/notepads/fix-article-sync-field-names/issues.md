## 2026-02-04 - Follow-up Issues

### Issue 1: Consolidate Duplicate OutreachSync Services

**Description**: `OutreachSyncService` and `OutreachArticleSyncService` have overlapping functionality. The latter has correct implementation but is unused.

**Action**: Consider removing `OutreachArticleSyncService` and ensuring `OutreachSyncService` has all needed functionality.

### Issue 2: Add Unit Tests for OutreachSyncService.syncArticlesFromDashboard

**Description**: Currently only `OutreachArticleSyncService` has unit tests. The fixed service needs test coverage.

**Action**: Add tests to `apps/api/src/services/__tests__/outreach-sync.service.test.ts`
