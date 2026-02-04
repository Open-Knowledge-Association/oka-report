## OutreachArticleSyncService Implementation (2026-02-04)

### TDD Approach
- Followed RED → GREEN → REFACTOR cycle successfully
- Test file written first with 10 comprehensive test cases
- All tests passing with proper mock setup

### Key Patterns Applied

**SyncJob Lifecycle (from outreach-sync.service.ts)**
```typescript
1. Create job (pending)
2. Update to running with startedAt
3. Process data with error handling per item
4. Update to completed with metadata OR failed with error
```

**Article Upsert Pattern**
- Upsert by `outreachId` (unique identifier from Outreach Dashboard)
- Track imported vs updated by comparing `createdAt` timestamps
- Continue processing on individual article errors (error collection)

**Pageview Snapshot Pattern**
- Create daily snapshot with UTC date (time zeroed)
- Upsert by compound key: `outreachArticleId_snapshotDate`
- Store cumulative view count from API

**Editor Linking Logic**
- Lookup editors by `externalId` (matches Outreach Dashboard user_ids)
- Silently skip if editor not found (defensive programming)
- Upsert by compound key: `outreachArticleId_editorId`

### Testing Insights

**Mock Setup Challenges**
- Prisma mocks need proper type structure (createdAt, etc.)
- Individual test mocks override beforeEach mocks
- Use `jobCreatedAt` variable to ensure consistent timestamp comparison

**Mock Pattern for Upsert Tracking**
```typescript
const jobCreatedAt = new Date();
mockPrisma.outreachArticle.upsert = mock(() => 
  Promise.resolve({ 
    id: "article-1", 
    outreachId: 100,
    createdAt: new Date(jobCreatedAt.getTime() + 500) // Slightly after job
  })
);
```

**Error Handling Test**
- Use callCount to fail specific items
- Verify partial success with error collection
- Ensure service doesn't throw on individual item failures

### Code Quality
- Clean separation of concerns
- No redundant comments (removed during review)
- Follows existing service patterns (outreach-sync, sync)
- Type safety with proper interfaces

### Type Issues (Non-blocking)
- Prisma metadata field has strict typing (InputJsonObject)
- Workaround: `metadata: result as any` (matches existing pattern)
- Runtime behavior correct, LSP warning ignorable

### Test Coverage
✅ Sync job creation and lifecycle
✅ Article upsert by outreachId
✅ Pageview snapshot creation
✅ Editor linking (found and not found cases)
✅ Error tracking and continuation
✅ Critical error handling (job failure)
✅ Result metadata completeness

## Integration Test for Outreach Articles Sync

**Date**: 2026-02-04

**Test Added**: `POST /api/outreach/articles/sync should sync articles end-to-end with mocked client`

**Location**: `apps/api/src/__tests__/api.test.ts`

**Pattern Used**:
1. Mock `OutreachDashboardClient.prototype.getArticles` to return test data
2. Trigger sync via POST `/api/outreach/articles/sync`
3. Poll database with exponential backoff to wait for async completion
4. Verify articles are stored in database with correct attributes
5. Restore original method in finally block

**Key Points**:
- Uses prototype method mocking for clean test isolation
- Implements exponential backoff for async job completion (100ms * 2^attempts)
- Tests actual database state, not just HTTP responses
- Properly cleans up mocked methods to avoid test pollution

**Future Enhancements**:
- Add assertions for pageviews once implemented in sync service
- Add assertions for editor links once implemented in sync service
- Consider using test database or transactions for isolation

**Database Schema Fields Verified**:
- `outreachId`: Unique identifier from Outreach Dashboard
- `title`: Article title with underscores
- `language`: Wikipedia language code (e.g., "en")
- `project`: Project name (e.g., "wikipedia")
- `characterSum`: Total character changes
- `referencesCount`: Number of references
- `isNewArticle`: Boolean for newly created articles
- `rating`: Quality rating (e.g., "B-class", "C-class")

