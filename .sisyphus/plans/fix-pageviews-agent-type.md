# Fix Pageviews 404 Errors with Bot/Human View Distinction

## TL;DR

> **Quick Summary**: Fix the many 404 errors in pageview sync by changing from `user` agent to `all-agents`, while also storing both human-only and total views for distinction.
>
> **Deliverables**:
>
> - Modified Pageviews API call to use `all-agents` (fixes 404s)
> - New `agentType` field to distinguish `user` vs `all-agents` views
> - Sync fetches BOTH types and stores separately
> - 404 errors logged to sync job metadata instead of console spam
>
> **Estimated Effort**: Medium (4-6 hours)
> **Parallel Execution**: NO - sequential (schema → API → sync → logging)
> **Critical Path**: Task 1 → Task 2 → Task 3 → Task 4

---

## Context

### Original Request

Running pageview sync shows many 404 errors for articles that actually exist on Wikipedia:

```
Pageviews unavailable for article "Cuterebra fontinella" on pt.wikipedia.org: 404 Not Found
```

But the article exists: https://pt.wikipedia.org/wiki/Cuterebra_fontinella

### Root Cause Analysis

**CONFIRMED**: The Pageviews API endpoint uses `user` agent type, which only counts human views. For low-traffic articles, there may be NO human views in the date range, causing 404.

**Evidence**:

- ❌ `https://wikimedia.org/api/rest_v1/.../all-access/user/...` → 404
- ✅ `https://wikimedia.org/api/rest_v1/.../all-access/all-agents/...` → Returns data

**Location**: `packages/utils/src/wikimedia/pageviews.ts` line 34

### User Decisions

| Decision                 | Choice                                         |
| ------------------------ | ---------------------------------------------- |
| Bot vs Human distinction | **Store both** - fetch twice, store separately |
| Historical re-sync       | **No** - start fresh from now                  |
| 404 logging              | **Database metadata** - store in sync_jobs     |

---

## Work Objectives

### Core Objective

Fix pageview 404 errors by using `all-agents` AND maintain distinction between human (`user`) and total (`all-agents`) views.

### Concrete Deliverables

1. `packages/db/prisma/schema.prisma` - Add `agentType` enum and field to Pageview model
2. `packages/utils/src/wikimedia/pageviews.ts` - Accept agent type parameter
3. `apps/api/src/services/sync.service.ts` - Fetch both agent types, store 404s in metadata
4. Reduced console noise with aggregated logging

### Definition of Done

- [ ] Pageview sync runs with significantly fewer 404 errors
- [ ] Database stores both `user` and `all-agents` pageviews
- [ ] 404 articles logged to sync job metadata (not console spam)
- [ ] All tests pass

### Must Have

- `agentType` field on Pageview model (`USER` | `ALL_AGENTS`)
- Pageviews API calls with configurable agent type
- Sync fetches `all-agents` first (for data), then `user` (for human-only)
- 404 count stored in sync job metadata

### Must NOT Have (Guardrails)

- **NO retry logic** for 404s (they're expected for zero-view periods)
- **NO re-sync of historical data** (start fresh)
- **NO changes to frontend** (backend only)
- **NO new dependencies** for logging
- **NO changes to other sync types** (contributions, commons, editors)

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (bun test)
- **Automated tests**: YES - update existing tests
- **Framework**: bun test

### Agent-Executed QA Scenarios

| Type                  | Tool           |
| --------------------- | -------------- |
| API verification      | curl commands  |
| Database verification | Prisma queries |
| Test execution        | bun test       |

---

## Execution Strategy

### Sequential Execution

```
Task 1: Add agentType field to Pageview schema
    ↓
Task 2: Modify getPageviews to accept agent type parameter
    ↓
Task 3: Update sync service to fetch both types + metadata logging
    ↓
Task 4: Update tests and verify
```

### Dependency Matrix

| Task | Depends On | Blocks |
| ---- | ---------- | ------ |
| 1    | None       | 2, 3   |
| 2    | 1          | 3      |
| 3    | 2          | 4      |
| 4    | 3          | None   |

---

## TODOs

- [ ] 1. Add agentType field to Pageview model

  **What to do**:
  - Add `PageviewAgentType` enum with values `USER`, `ALL_AGENTS`
  - Add `agentType` field to Pageview model with default `ALL_AGENTS`
  - Update unique constraint to include `agentType`
  - Run migration

  **Must NOT do**:
  - Change existing Pageview data
  - Modify other models

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:
  - `packages/db/prisma/schema.prisma:150-165` - Current Pageview model
  - `packages/db/prisma/schema.prisma:140-145` - PageviewType enum pattern

  **Code Changes**:

  ```prisma
  enum PageviewAgentType {
    USER        // Human views only
    ALL_AGENTS  // All views (human + bot)
  }

  model Pageview {
    id              String            @id @default(cuid())
    articleId       String
    article         Article           @relation(fields: [articleId], references: [id], onDelete: Cascade)
    date            DateTime
    type            PageviewType      @default(DAILY)
    agentType       PageviewAgentType @default(ALL_AGENTS)
    views           Int
    cumulativeViews Int?

    @@unique([articleId, date, type, agentType])
    @@index([articleId])
    @@index([date])
  }
  ```

  **Acceptance Criteria**:
  - [ ] `PageviewAgentType` enum exists with `USER`, `ALL_AGENTS`
  - [ ] `Pageview.agentType` field exists with default `ALL_AGENTS`
  - [ ] Unique constraint updated to include `agentType`
  - [ ] Migration created and applied: `bunx prisma migrate dev --name add-pageview-agent-type`
  - [ ] `bunx prisma generate` succeeds

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Schema has agentType field
    Tool: Bash (grep)
    Steps:
      1. grep -n "agentType" packages/db/prisma/schema.prisma
    Expected Result: Shows agentType field in Pageview model
    Evidence: Command output

  Scenario: Migration applied
    Tool: Bash
    Steps:
      1. cd packages/db && bunx prisma migrate status
    Expected Result: No pending migrations
    Evidence: "Database schema is up to date"
  ```

  **Commit**: YES
  - Message: `feat(db): add agentType field to Pageview for bot/human distinction`
  - Files: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*`

---

- [ ] 2. Modify getPageviews to accept agent type parameter

  **What to do**:
  - Add optional `agentType` parameter to `getPageviews()` function
  - Default to `all-agents` for backward compatibility
  - Update endpoint URL construction to use the parameter
  - Export agent type constants

  **Must NOT do**:
  - Add retry logic
  - Add caching
  - Change error handling (already handled upstream)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `packages/utils/src/wikimedia/pageviews.ts` - Current implementation
  - `packages/utils/src/wikimedia/client.ts:131-137` - Client wrapper method

  **Code Changes**:

  ```typescript
  // packages/utils/src/wikimedia/pageviews.ts

  export type PageviewAgentType = "user" | "all-agents";

  export const getPageviews = async (
    client: WikimediaClient,
    article: string,
    project: string,
    startDate: string,
    endDate: string,
    agentType: PageviewAgentType = "all-agents", // NEW: default to all-agents
  ): Promise<PageviewData[]> => {
    const normalizedTitle = article.replace(/ /g, "_");
    const encodedArticle = encodeURIComponent(normalizedTitle);
    const endpoint = `${PAGEVIEWS_BASE_URL}/metrics/pageviews/per-article/${project}/all-access/${agentType}/${encodedArticle}/daily/${startDate}/${endDate}`;
    // ...rest unchanged
  };
  ```

  Also update `WikimediaClient.getPageviews()` in `client.ts` to pass through the parameter.

  **Acceptance Criteria**:
  - [ ] `getPageviews()` accepts optional `agentType` parameter
  - [ ] Default is `"all-agents"` (fixes 404 issue)
  - [ ] `PageviewAgentType` type exported from module
  - [ ] `WikimediaClient.getPageviews()` updated to accept and pass `agentType`
  - [ ] TypeScript compiles: `cd packages/utils && bun run tsc --noEmit`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: API call with all-agents works
    Tool: Bash (curl)
    Steps:
      1. curl -s "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/all-agents/Cuterebra_fontinella/daily/20250101/20250201" | jq '.items | length'
    Expected Result: Number > 0
    Evidence: Response shows items

  Scenario: TypeScript compiles
    Tool: Bash
    Steps:
      1. cd packages/utils && bun run tsc --noEmit
    Expected Result: Exit code 0
    Evidence: No errors
  ```

  **Commit**: YES
  - Message: `feat(utils): add agentType parameter to getPageviews (default all-agents)`
  - Files: `packages/utils/src/wikimedia/pageviews.ts`, `packages/utils/src/wikimedia/client.ts`

---

- [ ] 3. Update sync service to fetch both agent types and log 404s to metadata

  **What to do**:
  - Modify `syncArticlePageviews()` to fetch BOTH `all-agents` and `user` views
  - Store each with appropriate `agentType` in database
  - Track 404 errors in an array during sync
  - At end of sync, update job metadata with 404 summary
  - Remove per-article console.warn, replace with summary log

  **Must NOT do**:
  - Retry 404 errors
  - Delete existing pageview data
  - Change other sync methods

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 4
  - **Blocked By**: Task 2

  **References**:
  - `apps/api/src/services/sync.service.ts:197-257` - Current syncArticlePageviews
  - `apps/api/src/services/sync.service.ts:82-92` - Metadata update pattern

  **Code Changes** (conceptual):

  ```typescript
  async syncArticlePageviews(articleId?: string, since?: Date, jobId?: string) {
    const articles = await this.prisma.article.findMany({...});

    let syncedCount = 0;
    const skipped404: { title: string; wikiProject: string; agentType: string }[] = [];

    for (const article of articles) {
      // Fetch ALL_AGENTS first (less likely to 404)
      for (const agentType of ["all-agents", "user"] as const) {
        try {
          const pageviews = await this.wikimediaClient.getPageviews(
            article.title,
            toPageviewsProject(article.wikiProject),
            formatDateForPageviews(startDate),
            formatDateForPageviews(endDate),
            agentType, // NEW parameter
          );

          for (const item of pageviews) {
            await this.prisma.pageview.upsert({
              where: {
                articleId_date_type_agentType: {
                  articleId: article.id,
                  date: parsePageviewDate(item.date),
                  type: "DAILY",
                  agentType: agentType === "user" ? "USER" : "ALL_AGENTS",
                },
              },
              create: {
                articleId: article.id,
                date: parsePageviewDate(item.date),
                type: "DAILY",
                agentType: agentType === "user" ? "USER" : "ALL_AGENTS",
                views: item.views,
              },
              update: { views: item.views },
            });
            syncedCount += 1;
          }
        } catch (error) {
          if (error instanceof WikimediaClientError && error.status === 404) {
            skipped404.push({
              title: article.title,
              wikiProject: article.wikiProject,
              agentType
            });
            continue;
          }
          throw error;
        }
      }
    }

    // Update job metadata with 404 summary
    if (jobId && skipped404.length > 0) {
      await this.prisma.syncJob.update({
        where: { id: jobId },
        data: {
          metadata: {
            skipped404Count: skipped404.length,
            skipped404Sample: skipped404.slice(0, 10), // First 10 as sample
          },
        },
      });
      console.log(`Pageview sync: ${skipped404.length} article/agent combinations returned 404`);
    }

    return syncedCount;
  }
  ```

  **Acceptance Criteria**:
  - [ ] Sync fetches both `all-agents` and `user` pageviews
  - [ ] Pageviews stored with correct `agentType` in database
  - [ ] 404 errors aggregated and stored in job metadata
  - [ ] Console log shows summary count, not per-article spam
  - [ ] TypeScript compiles: `cd apps/api && bun run tsc --noEmit`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Sync stores both agent types
    Tool: Bash
    Preconditions: Database has articles, API server running
    Steps:
      1. Trigger pageview sync via API
      2. Wait for completion
      3. Query database: SELECT DISTINCT "agentType" FROM "Pageview"
    Expected Result: Both USER and ALL_AGENTS present
    Evidence: Query output

  Scenario: 404 count in job metadata
    Tool: Bash (curl)
    Steps:
      1. After sync completes, GET /api/sync/history?limit=1
      2. Check metadata.skipped404Count field
    Expected Result: Number exists (may be 0 or more)
    Evidence: Response JSON
  ```

  **Commit**: YES
  - Message: `feat(api): sync both user and all-agents pageviews, log 404s to metadata`
  - Files: `apps/api/src/services/sync.service.ts`

---

- [ ] 4. Update tests and final verification

  **What to do**:
  - Update `packages/utils/src/wikimedia/__tests__/client.test.ts` for new parameter
  - Update `apps/api/src/services/__tests__/sync.service.test.ts` for new behavior
  - Run all tests and verify passing
  - Manual verification of reduced 404s

  **Must NOT do**:
  - Add new test files
  - Test edge cases not in scope

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: None
  - **Blocked By**: Task 3

  **References**:
  - `packages/utils/src/wikimedia/__tests__/client.test.ts`
  - `apps/api/src/services/__tests__/sync.service.test.ts`

  **Acceptance Criteria**:
  - [ ] `bun test` passes in `packages/utils`
  - [ ] `bun test` passes in `apps/api`
  - [ ] No TypeScript errors in either project

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Utils tests pass
    Tool: Bash
    Steps:
      1. cd packages/utils && bun test
    Expected Result: All tests pass
    Evidence: Test output

  Scenario: API tests pass
    Tool: Bash
    Steps:
      1. cd apps/api && bun test
    Expected Result: All tests pass
    Evidence: Test output

  Scenario: Reduced 404s in real sync
    Tool: Bash
    Preconditions: Dev server running
    Steps:
      1. Trigger pageview sync
      2. Watch logs for 404 summary
      3. Compare count to previous run (should be lower for all-agents)
    Expected Result: Summary log instead of per-article spam
    Evidence: Console output
  ```

  **Commit**: YES
  - Message: `test(api,utils): update tests for pageview agent type changes`
  - Files: Test files

---

## Commit Strategy

| After Task | Message                                                                     | Files                     | Verification          |
| ---------- | --------------------------------------------------------------------------- | ------------------------- | --------------------- |
| 1          | `feat(db): add agentType field to Pageview for bot/human distinction`       | schema.prisma, migrations | prisma migrate status |
| 2          | `feat(utils): add agentType parameter to getPageviews (default all-agents)` | pageviews.ts, client.ts   | bun test              |
| 3          | `feat(api): sync both user and all-agents pageviews, log 404s to metadata`  | sync.service.ts           | bun test              |
| 4          | `test(api,utils): update tests for pageview agent type changes`             | test files                | bun test              |

---

## Success Criteria

### Verification Commands

```bash
# 1. Schema check
grep -n "agentType" packages/db/prisma/schema.prisma

# 2. Utils tests
cd packages/utils && bun test

# 3. API tests
cd apps/api && bun test

# 4. TypeScript compilation
cd packages/utils && bun run tsc --noEmit
cd apps/api && bun run tsc --noEmit

# 5. Manual API test (should return data now)
curl -s "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/pt.wikipedia/all-access/all-agents/Cuterebra_fontinella/daily/20250101/20250201" | jq '.items | length'
```

### Final Checklist

- [ ] Pageview model has `agentType` field with `USER` and `ALL_AGENTS` values
- [ ] `getPageviews()` accepts `agentType` parameter, defaults to `all-agents`
- [ ] Sync fetches both agent types for each article
- [ ] 404 errors logged to job metadata, not console spam
- [ ] All tests pass
- [ ] TypeScript compiles without errors
