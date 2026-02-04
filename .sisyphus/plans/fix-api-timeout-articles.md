# Fix API Timeout for Articles Endpoint

## TL;DR

> **Quick Summary**: Fix the Bun server 10-second default timeout that causes `/api/outreach/articles` to fail when fetching ~47K articles (5MB+ payload) from Outreach Dashboard.
>
> **Deliverables**:
>
> - Updated `apps/api/src/index.ts` with explicit `idleTimeout: 60` configuration
> - Working Articles page with statistics
>
> **Estimated Effort**: Quick (single file, ~5 lines change)
> **Parallel Execution**: NO - single task
> **Critical Path**: Fix timeout → Verify → Commit → Push

---

## Context

### Original Problem

The Articles page (`/articles`) shows **zero statistics** because the API request times out:

```
api:dev | [Bun.serve]: request timed out after 10 seconds. Pass `idleTimeout` to configure.
web:dev | Error: socket hang up
```

### Root Cause

1. Outreach Dashboard `/articles.json` returns **~47,000 articles** (~5MB payload)
2. Bun's default `idleTimeout` is **10 seconds**
3. The upstream API request + JSON parsing + response takes **>10 seconds**
4. Current `apps/api/src/index.ts` uses `export default app` which doesn't allow timeout configuration

### Solution

Export a Bun server configuration object instead of just the Hono app:

```typescript
export default {
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 60, // 60 seconds instead of default 10
};
```

### Research Findings

- Bun allows `idleTimeout` configuration via server config object
- Hono apps work with `{ port, fetch: app.fetch, idleTimeout }` pattern
- 60 seconds is reasonable for large external API payloads

---

## Work Objectives

### Core Objective

Increase Bun server timeout to 60 seconds so the large articles payload can be fetched successfully.

### Concrete Deliverables

- `apps/api/src/index.ts` modified to export Bun server config with `idleTimeout: 60`

### Definition of Done

- [x] `/articles` page displays article statistics (not zero)
- [x] No timeout errors in console when loading articles
- [x] API endpoint `curl localhost:3000/api/outreach/articles?school=OKA&slug=OKA` returns data

### Must Have

- `idleTimeout: 60` configuration
- Maintain existing port 3000
- Preserve all existing functionality

### Must NOT Have (Guardrails)

- **NO response streaming** - Keep simple, defer optimization
- **NO pagination changes** - Already implemented at API level, just need timeout fix
- **NO frontend changes** - Problem is purely backend timeout
- **NO Vite proxy timeout changes** - Vite follows upstream, fixing Bun is sufficient

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
> ALL verification by agent via curl and Playwright.

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: NO (simple config change)
- **Framework**: N/A

### Agent-Executed QA Scenarios (MANDATORY)

All scenarios executed by agent using Bash/curl and Playwright.

---

## TODOs

- [x] 1. Fix Bun Server Timeout Configuration

  **What to do**:
  - Open `apps/api/src/index.ts`
  - Change from `export default app` to export a Bun server config object
  - Add `idleTimeout: 60` (60 seconds)
  - Preserve port 3000

  **Current code**:

  ```typescript
  export default app;
  ```

  **New code**:

  ```typescript
  export default {
    port: 3000,
    fetch: app.fetch,
    idleTimeout: 60,
  };
  ```

  **Must NOT do**:
  - Do NOT change any routes or middleware
  - Do NOT change the scheduler
  - Do NOT add explicit `Bun.serve()` call (export pattern is cleaner)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - **Reason**: Simple 4-line change, follows documented pattern

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (only task)
  - **Blocks**: None
  - **Blocked By**: None

  **References**:

  **Pattern References** (existing code to follow):
  - `apps/api/src/index.ts:18` - Current `export default app` to replace
  - Bun docs: `idleTimeout` option sets max connection idle time in seconds

  **API/Type References**:
  - Bun.serve config: `{ port: number, fetch: Function, idleTimeout?: number }`

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: API server starts with increased timeout
    Tool: Bash
    Preconditions: No API server running
    Steps:
      1. cd apps/api && timeout 5 bun run src/index.ts &
      2. Wait 2 seconds for startup
      3. curl -s http://localhost:3000/ | jq '.message'
      4. Assert: Returns "OKA Stats API"
      5. Kill background process
    Expected Result: Server starts successfully
    Evidence: curl output captured

  Scenario: Articles endpoint returns data without timeout
    Tool: Bash (curl)
    Preconditions: Both dev servers running via `moon run :dev`
    Steps:
      1. curl -s --max-time 90 "http://localhost:3000/api/outreach/articles?school=OKA&slug=OKA" | head -c 1000
      2. Assert: Response contains "success":true
      3. Assert: Response contains "articles"
      4. Assert: No timeout error
    Expected Result: Large JSON response with articles data
    Evidence: First 1000 chars of response captured

  Scenario: Articles page displays statistics
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running (API on 3000, Web on 3001)
    Steps:
      1. Navigate to: http://localhost:3001/articles
      2. Wait for: table visible (timeout: 90s) - large dataset
      3. Assert: Page contains numeric statistics (not all zeros)
      4. Assert: At least one Card component shows a number > 0
      5. Screenshot: .sisyphus/evidence/task-1-articles-page-loaded.png
    Expected Result: Articles page shows real statistics
    Evidence: .sisyphus/evidence/task-1-articles-page-loaded.png

  Scenario: No timeout errors in server logs
    Tool: Bash
    Preconditions: Dev servers running
    Steps:
      1. Trigger articles fetch via curl
      2. Check server logs for "timed out" message
      3. Assert: No timeout errors
    Expected Result: Clean server logs
    Evidence: Log output captured
  ```

  **Commit**: YES
  - Message: `fix(api): increase Bun server idleTimeout to 60s for large payloads`
  - Files: `apps/api/src/index.ts`
  - Pre-commit: Server starts successfully

---

- [x] 2. Push All Commits to Remote

  **What to do**:
  - Git pull --rebase to sync with remote
  - Push all local commits (8 existing + 1 fix)
  - Verify push succeeds

  **Must NOT do**:
  - Do NOT force push
  - Do NOT amend existing commits

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[git-master]`
  - **Reason**: Standard git operations

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 1)
  - **Blocks**: None
  - **Blocked By**: Task 1

  **References**:
  - Current status: 8 commits ahead of `origin/dev`

  **Acceptance Criteria**:
  - [ ] `git push` succeeds
  - [ ] `git status` shows "up to date with origin"

  **Commit**: NO (push existing commits)

---

## Commit Strategy

| After Task | Message                                                               | Files                   |
| ---------- | --------------------------------------------------------------------- | ----------------------- |
| 1          | `fix(api): increase Bun server idleTimeout to 60s for large payloads` | `apps/api/src/index.ts` |

---

## Success Criteria

### Verification Commands

```bash
# 1. Server config applied
grep -q "idleTimeout" apps/api/src/index.ts && echo "PASS" || echo "FAIL"

# 2. Articles endpoint works (run with servers up)
curl -s --max-time 90 "http://localhost:3000/api/outreach/articles?school=OKA&slug=OKA" | jq '.success'
# Expected: true

# 3. TypeScript compiles
cd apps/api && bun run tsc --noEmit
# Expected: exit 0

# 4. All commits pushed
git status
# Expected: "up to date with origin"
```

### Final Checklist

- [x] `idleTimeout: 60` added to Bun server config
- [x] API server starts without errors
- [x] `/articles` page shows real statistics (not zero)
- [x] No timeout errors in console
- [x] All 10 commits pushed to remote

---

## Technical Details

### Before (Current Code)

```typescript
// apps/api/src/index.ts
import { Hono } from "hono";
// ... imports and setup ...

const app = new Hono();
// ... routes ...

export default app; // <-- Uses Bun defaults (10s timeout)
```

### After (Fixed Code)

```typescript
// apps/api/src/index.ts
import { Hono } from "hono";
// ... imports and setup ...

const app = new Hono();
// ... routes ...

export default {
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 60, // <-- 60 seconds for large payloads
};
```

### Why 60 Seconds?

- Outreach Dashboard articles endpoint returns ~47K articles
- Payload size is ~5MB
- External API call + JSON parsing + response serialization takes ~15-30s
- 60 seconds provides comfortable buffer for network variability
- Can be reduced later after optimization (pagination, streaming)

---

_Plan generated by Prometheus. Execute with `/start-work`_
