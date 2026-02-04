## 2026-02-04 - Decisions Made

### Decision: Fix Only outreach-sync.service.ts

**Rationale**: Routes import `OutreachSyncService`, not `OutreachArticleSyncService`. The latter is unused but has correct implementation pattern.

### Decision: Do Not Consolidate Duplicate Services

**Rationale**: Out of scope for this bug fix. Created follow-up note to consolidate later.

### Decision: Keep API Types Unchanged

**Rationale**: The Outreach Dashboard API types correctly use snake_case since that's what the external API returns. Only the Prisma mapping needs to change.
