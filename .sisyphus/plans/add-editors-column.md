# Add Editors Column to Articles Table

## TL;DR

> **Quick Summary**: Add an "Editors" column to the articles table showing which editors worked on each article, with author detection, OKA badges, and a new editor profile page.
>
> **Deliverables**:
>
> - Editors column in articles table (count badge + tooltip with names)
> - "Author" badge for original article creators
> - OKA icon for tracked editors
> - Editor profile page `/editors/:id` with Outreach + MediaWiki data
> - Author detection via MediaWiki API (real-time + backfill job)
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Schema migration → Backend services → Frontend types → UI components

---

## Context

### Original Request

User wants to add an "Editors" column to the articles table that shows:

- Which editors worked on each article
- Whether an editor is the original author or just edited
- OKA icon for tracked editors
- Clickable editors linking to a profile page
- Count badge with tooltip showing 5 names + "+N more"

### Interview Summary

**Key Discussions**:

- Column position: After Wiki column (before Pageviews)
- Display format: Count badge with tooltip showing editor names
- OKA highlight: Small icon next to OKA member names
- Author detection: Kombinasi real-time saat sync + background job untuk backfill
- Profile content: Outreach stats + MediaWiki data (registration date, global edit count)
- Non-OKA editors: Skip - only show tracked editors in database (simplified from original)
- Defaults: Tooltip 5 names + "+N more", empty state "—", Author badge text "Author"

**Research Findings**:

- API already returns editors in `/api/outreach/articles/db` with nested editor data
- Frontend type `OutreachArticle` in `apps/web/src/lib/api.ts` is MISSING `editors` field
- WikimediaClient already exists with `getArticleInfo()` that fetches first revision (creator)
- No existing editor profile page (`/editors/:id`)
- TanStack Router uses `$param` syntax for dynamic routes (e.g., `editors.$editorId.tsx`)

### Metis Review

**Identified Gaps** (addressed):

- Two article systems (Article vs OutreachArticle): Plan focuses on OutreachArticle only
- Tooltip component missing: Will add via shadcn
- Non-OKA editors handling: Skip - only show tracked editors (schema requires editorId)
- Username normalization: Will use existing pattern from outreach-sync.service.ts

---

## Work Objectives

### Core Objective

Add comprehensive editor information to the articles table with author detection and individual editor profile pages.

### Concrete Deliverables

1. `OutreachArticleEditor.isAuthor` field in database schema
2. Author detection service using existing WikimediaClient
3. Updated frontend types for editors
4. Editors column in articles table with tooltip
5. Editor profile page at `/editors/:id`
6. Profile API endpoint with MediaWiki data

### Definition of Done

- [x] Articles table shows editor count with tooltip → `curl /api/outreach/articles/db | jq '.data.articles[0].editors'` returns array
- [x] Clicking editor opens profile page → Navigate to `/editors/{id}` loads data
- [x] Author badge visible for original creators → UI shows "Author" badge
- [x] OKA icon visible for tracked editors → UI shows icon
- [x] Profile shows Outreach + MediaWiki data → Profile page renders both datasets

### Must Have

- Schema migration for `isAuthor` field
- Tooltip component (shadcn)
- Editor profile route with loader
- Author detection during sync
- Backfill job for existing articles

### Must NOT Have (Guardrails)

- Sorting/filtering articles by editor count (not requested)
- Editor search/autocomplete
- Contribution history timeline on profile
- Edit frequency graphs
- Achievement badges
- Comparison between editors
- Export editor data
- Admin editor management from profile page
- Over-componentization (no EditorBadgeList, no EditorProfileCard - inline instead)

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks in this plan MUST be verifiable WITHOUT any human action.
> This is NOT conditional — it applies to EVERY task, regardless of test strategy.

### Test Decision

- **Infrastructure exists**: YES (vitest in apps/web)
- **Automated tests**: Tests-after (not TDD)
- **Framework**: vitest

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

All verification uses:

- **Playwright** (playwright skill) for UI
- **Bash (curl)** for API
- **interactive_bash (tmux)** for migrations

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add Tooltip component via shadcn
├── Task 2: Create Prisma migration for isAuthor field
└── Task 3: Update frontend OutreachArticle type

Wave 2 (After Wave 1):
├── Task 4: Add author detection to sync service
├── Task 5: Create editor profile API endpoint
└── Task 6: Add Editors column to articles table

Wave 3 (After Wave 2):
├── Task 7: Create editor profile page
└── Task 8: Create author backfill job endpoint

Wave 4 (After Wave 3):
└── Task 9: Integration testing and polish

Critical Path: Task 2 → Task 4 → Task 8
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 6      | 2, 3                 |
| 2    | None       | 4, 8   | 1, 3                 |
| 3    | None       | 6, 7   | 1, 2                 |
| 4    | 2          | 8      | 5, 6                 |
| 5    | None       | 7      | 4, 6                 |
| 6    | 1, 3       | 9      | 4, 5                 |
| 7    | 3, 5       | 9      | 8                    |
| 8    | 2, 4       | 9      | 7                    |
| 9    | 6, 7, 8    | None   | None (final)         |

### Agent Dispatch Summary

| Wave | Tasks   | Recommended Agents                          |
| ---- | ------- | ------------------------------------------- |
| 1    | 1, 2, 3 | quick (each independent, simple)            |
| 2    | 4, 5, 6 | unspecified-high (involves API + UI)        |
| 3    | 7, 8    | visual-engineering (7), unspecified-low (8) |
| 4    | 9       | quick (verification only)                   |

---

## TODOs

### Wave 1: Foundation

- [x] 1. Add Tooltip Component via shadcn

  **What to do**:
  - Run `pnpm dlx shadcn@latest add tooltip` in `apps/web` directory
  - Verify component is added to `apps/web/src/components/ui/tooltip.tsx`
  - Check it exports `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider`

  **Must NOT do**:
  - Custom tooltip implementation
  - Custom animations or delays

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single command execution with verification
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None

  **References**:
  - `apps/web/README.md:60-64` - shadcn add command pattern
  - `apps/web/src/components/ui/badge.tsx` - Existing shadcn component for reference

  **Acceptance Criteria**:
  - [ ] File exists: `apps/web/src/components/ui/tooltip.tsx`
  - [ ] TypeScript compiles: `cd apps/web && bun tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Tooltip component installed successfully
    Tool: Bash
    Preconditions: apps/web directory exists
    Steps:
      1. cd apps/web && ls src/components/ui/tooltip.tsx
      2. Assert: file exists (exit code 0)
      3. grep -q "TooltipProvider" src/components/ui/tooltip.tsx
      4. Assert: export found (exit code 0)
    Expected Result: Tooltip component file exists with expected exports
    Evidence: Command output captured
  ```

  **Commit**: YES
  - Message: `feat(web): add tooltip component via shadcn`
  - Files: `apps/web/src/components/ui/tooltip.tsx`
  - Pre-commit: `cd apps/web && bun tsc --noEmit`

---

- [x] 2. Create Prisma Migration for isAuthor Field

  **What to do**:
  - Add `isAuthor Boolean @default(false)` to `OutreachArticleEditor` model in schema.prisma
  - Run `bunx prisma migrate dev --name add_is_author_to_outreach_article_editor`
  - Run `bunx prisma generate`

  **Must NOT do**:
  - Add confidence score or other fields
  - Add outreachUserId (not needed - we only track editors in database)
  - Modify other models

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Schema change + migration is straightforward
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 8
  - **Blocked By**: None

  **References**:
  - `packages/db/prisma/schema.prisma:317-332` - OutreachArticleEditor model (add fields here)
  - `packages/db/prisma/schema.prisma:95-138` - Contribution model has isCreation pattern to follow

  **Acceptance Criteria**:
  - [ ] Schema updated: `grep -q "isAuthor" packages/db/prisma/schema.prisma` → found
  - [ ] Migration created: `ls packages/db/prisma/migrations/ | grep add_is_author` → found
  - [ ] Prisma client generated: `cd packages/db && bunx prisma generate` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Migration applies successfully
    Tool: Bash
    Preconditions: DATABASE_URL set, database accessible
    Steps:
      1. cd packages/db && bunx prisma migrate status
      2. Assert: "Database schema is up to date" or shows new migration applied
    Expected Result: Migration applied without errors
    Evidence: Command output captured

  Scenario: New fields exist in Prisma client
    Tool: Bash
    Preconditions: Prisma client generated
    Steps:
      1. grep -r "isAuthor" packages/db/generated/prisma/
      2. Assert: field found in generated client (exit code 0)
    Expected Result: isAuthor field present in generated types
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `feat(db): add isAuthor to OutreachArticleEditor`
  - Files: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/*`
  - Pre-commit: `cd packages/db && bunx prisma generate`

---

- [x] 3. Update Frontend OutreachArticle Type

  **What to do**:
  - Add `OutreachArticleEditor` type to `apps/web/src/lib/api.ts`
  - Add `editors?: OutreachArticleEditor[]` to `OutreachArticle` type
  - Include `isAuthor` and nested `editor` object

  **Must NOT do**:
  - Create separate types file
  - Add types for features not being built

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Type definition update is straightforward
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 6, 7
  - **Blocked By**: None

  **References**:
  - `apps/web/src/lib/api.ts:103-117` - Current OutreachArticle type (add editors field here)
  - `apps/web/src/lib/api.ts:12-19` - Editor type (reuse for nested editor)
  - `packages/db/prisma/schema.prisma:317-332` - OutreachArticleEditor model (match field names)

  **Acceptance Criteria**:
  - [ ] Type added: `grep -q "OutreachArticleEditor" apps/web/src/lib/api.ts` → found
  - [ ] TypeScript compiles: `cd apps/web && bun tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Types compile without errors
    Tool: Bash
    Preconditions: apps/web dependencies installed
    Steps:
      1. cd apps/web && bun tsc --noEmit
      2. Assert: exit code 0
    Expected Result: No TypeScript errors
    Evidence: Command output captured

  Scenario: OutreachArticle includes editors field
    Tool: Bash
    Preconditions: Type file updated
    Steps:
      1. grep -A5 "OutreachArticle = {" apps/web/src/lib/api.ts | grep editors
      2. Assert: editors field found
    Expected Result: editors field present in type
    Evidence: grep output captured
  ```

  **Commit**: YES
  - Message: `feat(web): add OutreachArticleEditor type with isAuthor field`
  - Files: `apps/web/src/lib/api.ts`
  - Pre-commit: `cd apps/web && bun tsc --noEmit`

---

### Wave 2: Backend Services + Initial UI

- [x] 4. Add Author Detection to Sync Service

  **What to do**:
  - Modify `apps/api/src/services/outreach-article-sync.service.ts`
  - After creating OutreachArticleEditor, call `WikimediaClient.getArticleInfo(title)` to get creator
  - Compare creator username with editor.username (normalize with underscores)
  - Set `isAuthor: true` if they match
  - Use rate limiter from existing WikimediaClient

  **Must NOT do**:
  - Create separate AuthorDetectionService class (inline in sync)
  - Add confidence score
  - Block sync on API failures (make author detection optional/graceful)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Involves API integration and careful error handling
  - **Skills**: []
    - No special skills needed, uses existing WikimediaClient

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 2

  **References**:
  - `apps/api/src/services/outreach-article-sync.service.ts` - Sync service to modify
  - `packages/utils/src/wikimedia/client.ts` - WikimediaClient to use
  - `packages/utils/src/wikimedia/articles.ts:1-50` - getArticleInfo implementation pattern
  - `apps/api/src/services/sync.service.ts:213-229` - Existing author detection pattern in Article sync
  - `apps/api/src/services/outreach-sync.service.ts` - Username normalization pattern (replace spaces with underscores)

  **Acceptance Criteria**:
  - [ ] Sync sets isAuthor: After sync, some OutreachArticleEditor rows have `isAuthor: true`
  - [ ] Graceful failure: Sync completes even if MediaWiki API is unreachable

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Author detection integrated in sync
    Tool: Bash
    Preconditions: API server running, database accessible
    Steps:
      1. grep -q "getArticleInfo" apps/api/src/services/outreach-article-sync.service.ts
      2. Assert: function call found (exit code 0)
      3. grep -q "isAuthor" apps/api/src/services/outreach-article-sync.service.ts
      4. Assert: isAuthor field usage found
    Expected Result: Author detection code present in sync service
    Evidence: grep output captured

  Scenario: Sync handles API failure gracefully
    Tool: Bash
    Preconditions: Code review
    Steps:
      1. grep -A10 "getArticleInfo" apps/api/src/services/outreach-article-sync.service.ts
      2. Assert: try/catch or optional chaining present
    Expected Result: Error handling for MediaWiki API calls
    Evidence: Code snippet captured
  ```

  **Commit**: YES
  - Message: `feat(api): add author detection to outreach article sync`
  - Files: `apps/api/src/services/outreach-article-sync.service.ts`
  - Pre-commit: `cd apps/api && bun tsc --noEmit`

---

- [x] 5. Create Editor Profile API Endpoint

  **What to do**:
  - Add `GET /api/editors/:id/profile` endpoint to `apps/api/src/routes/editors.ts`
  - Return: editor info, Outreach stats (articles, edits, characters), MediaWiki data
  - For MediaWiki data: Use `action=query&list=users&ususers={username}&usprop=registration|editcount|gender`
  - Add method to WikimediaClient if needed, or use existing request method

  **Must NOT do**:
  - Create separate route file
  - Add caching layer
  - Fetch recent contributions (not requested)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Involves new API endpoint with external API integration
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 7
  - **Blocked By**: None

  **References**:
  - `apps/api/src/routes/editors.ts` - Add endpoint here
  - `apps/api/src/routes/outreach.ts:280-350` - Endpoint pattern with Prisma queries
  - `packages/utils/src/wikimedia/client.ts` - WikimediaClient for MediaWiki API calls
  - `packages/utils/src/wikimedia/types.ts` - Type definitions for API responses

  **Acceptance Criteria**:
  - [ ] Endpoint returns data: `curl http://localhost:3001/api/editors/{id}/profile` → 200 with JSON
  - [ ] Includes Outreach stats: Response has `outreachStats` object
  - [ ] Includes MediaWiki data: Response has `wikimediaProfile` object (or null if API fails)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Profile endpoint returns editor data
    Tool: Bash
    Preconditions: API server running on localhost:3001, at least one editor exists
    Steps:
      1. EDITOR_ID=$(curl -s http://localhost:3001/api/editors | jq -r '.data[0].id')
      2. curl -s "http://localhost:3001/api/editors/${EDITOR_ID}/profile" | jq -e '.success'
      3. Assert: success is true (exit code 0)
    Expected Result: Profile endpoint responds successfully
    Evidence: Response body captured

  Scenario: Profile includes outreach stats
    Tool: Bash
    Preconditions: API server running, editor with outreach articles exists
    Steps:
      1. EDITOR_ID=$(curl -s http://localhost:3001/api/editors | jq -r '.data[0].id')
      2. curl -s "http://localhost:3001/api/editors/${EDITOR_ID}/profile" | jq -e '.data.outreachStats'
      3. Assert: outreachStats field exists
    Expected Result: Outreach stats included in response
    Evidence: Response body captured

  Scenario: Profile handles missing MediaWiki data gracefully
    Tool: Bash
    Preconditions: API server running
    Steps:
      1. EDITOR_ID=$(curl -s http://localhost:3001/api/editors | jq -r '.data[0].id')
      2. curl -s "http://localhost:3001/api/editors/${EDITOR_ID}/profile" | jq '.data | has("wikimediaProfile")'
      3. Assert: field present (may be null)
    Expected Result: wikimediaProfile field exists (can be null)
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `feat(api): add editor profile endpoint with outreach and mediawiki data`
  - Files: `apps/api/src/routes/editors.ts`
  - Pre-commit: `cd apps/api && bun tsc --noEmit`

---

- [x] 6. Add Editors Column to Articles Table

  **What to do**:
  - Modify `apps/web/src/routes/articles.tsx`
  - Add `<TableHead>Editors</TableHead>` after Wiki column
  - Add `<TableCell>` with editor count badge (using Badge component)
  - Wrap badge in Tooltip showing editor names (max 5, then "+N more")
  - Show OKA icon (use Users icon from lucide-react) for tracked editors
  - Show "Author" badge (small, different color) for isAuthor=true editors
  - Make editor names clickable → Link to `/editors/{id}`
  - Empty state: Show "—" for articles with 0 editors

  **Must NOT do**:
  - Create separate EditorBadgeList component
  - Add sorting by editor count
  - Add filtering by editor
  - Show external editors (not in database)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with tooltip, badges, and links
  - **Skills**: [`frontend-ui-ux`]
    - frontend-ui-ux: Complex UI with multiple interactive elements

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 3

  **References**:
  - `apps/web/src/routes/articles.tsx:288-340` - Current table structure (add column here)
  - `apps/web/src/routes/articles.tsx:314-336` - TableRow rendering pattern
  - `apps/web/src/components/ui/badge.tsx` - Badge component for count
  - `apps/web/src/components/ui/tooltip.tsx` - Tooltip for editor names (after Task 1)
  - `apps/web/src/routes/admin/editors/index.tsx` - Badge usage pattern

  **Acceptance Criteria**:
  - [ ] Column visible: Articles table shows "Editors" column
  - [ ] Count badge: Cell shows number (e.g., "3")
  - [ ] Tooltip works: Hovering shows editor names
  - [ ] Author badge: "Author" text visible for creators
  - [ ] OKA icon: Icon visible for tracked editors
  - [ ] Links work: Clicking editor name navigates to /editors/{id}
  - [ ] Empty state: Articles with 0 editors show "—"

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Editors column displays count badge
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running on localhost:3000, articles with editors exist
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible (timeout: 10s)
      3. Assert: th contains text "Editors"
      4. Assert: First data row has cell with badge (number)
      5. Screenshot: .sisyphus/evidence/task-6-editors-column.png
    Expected Result: Editors column visible with count badges
    Evidence: .sisyphus/evidence/task-6-editors-column.png

  Scenario: Tooltip shows editor names on hover
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, articles with multiple editors
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible
      3. Hover: First editors badge
      4. Wait for: tooltip visible (timeout: 2s)
      5. Assert: tooltip contains username text
      6. Screenshot: .sisyphus/evidence/task-6-tooltip.png
    Expected Result: Tooltip appears with editor names
    Evidence: .sisyphus/evidence/task-6-tooltip.png

  Scenario: Author badge visible for article creators
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, article with isAuthor=true editor exists
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible
      3. Hover: Editors badge (find one with Author)
      4. Assert: tooltip contains "Author" text or badge
      5. Screenshot: .sisyphus/evidence/task-6-author-badge.png
    Expected Result: Author indicator visible
    Evidence: .sisyphus/evidence/task-6-author-badge.png

  Scenario: Editor name links to profile page
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, editors with profile pages
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Hover: First editors badge
      3. Wait for: tooltip visible
      4. Click: First editor name link in tooltip
      5. Wait for: URL contains /editors/
      6. Assert: URL matches /editors/{id} pattern
    Expected Result: Clicking editor navigates to profile
    Evidence: URL captured
  ```

  **Commit**: YES
  - Message: `feat(web): add editors column to articles table with tooltip and badges`
  - Files: `apps/web/src/routes/articles.tsx`
  - Pre-commit: `cd apps/web && bun tsc --noEmit`

---

### Wave 3: Profile Page + Backfill

- [x] 7. Create Editor Profile Page

  **What to do**:
  - Create `apps/web/src/routes/editors.$editorId.tsx` (TanStack Router dynamic route)
  - Add route loader that fetches `/api/editors/:id/profile`
  - Display: Editor name, Outreach stats (articles, characters, references, pageviews)
  - Display: MediaWiki data (registration date, global edit count)
  - Display: Link to Wikipedia user page
  - Display: List of articles they worked on (from profile API)
  - Show loading skeleton while fetching
  - Show error page if editor not found (404)

  **Must NOT do**:
  - Create EditorProfileCard component (inline)
  - Add contribution timeline
  - Add edit frequency graphs
  - Add pagination for articles list

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: New page with data display and loading states
  - **Skills**: [`frontend-ui-ux`]
    - frontend-ui-ux: Page layout and data presentation

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 8)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 3, 5

  **References**:
  - `apps/web/src/routes/articles.tsx` - Page structure pattern
  - `apps/web/src/routes/editors.tsx` - Existing editors list (similar data display)
  - `apps/web/README.md:20-50` - TanStack Router dynamic route syntax
  - `apps/web/src/routeTree.gen.ts` - Route registration (auto-generated)

  **Acceptance Criteria**:
  - [ ] Route exists: Navigate to `/editors/{id}` loads page
  - [ ] Shows editor info: Username, stats visible
  - [ ] Shows MediaWiki data: Registration date, edit count (or "N/A")
  - [ ] Shows articles list: Articles this editor worked on
  - [ ] 404 handling: Invalid ID shows error page

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Profile page loads editor data
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, editor exists in database
    Steps:
      1. Get editor ID from /editors page
      2. Navigate to: http://localhost:3000/editors/{id}
      3. Wait for: h1 or heading with editor username
      4. Assert: page contains username
      5. Assert: page contains stats cards
      6. Screenshot: .sisyphus/evidence/task-7-profile.png
    Expected Result: Profile page displays editor information
    Evidence: .sisyphus/evidence/task-7-profile.png

  Scenario: Profile shows MediaWiki data
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, editor with Wikipedia account
    Steps:
      1. Navigate to: editor profile page
      2. Assert: Page contains "Registration" or "Registered"
      3. Assert: Page contains "Edit count" or total edits
      4. Screenshot: .sisyphus/evidence/task-7-mediawiki.png
    Expected Result: MediaWiki profile data visible
    Evidence: .sisyphus/evidence/task-7-mediawiki.png

  Scenario: Profile handles invalid editor ID
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:3000/editors/invalid-id-12345
      2. Wait for: page content
      3. Assert: Error message or "not found" text visible
      4. Screenshot: .sisyphus/evidence/task-7-404.png
    Expected Result: Error state handled gracefully
    Evidence: .sisyphus/evidence/task-7-404.png
  ```

  **Commit**: YES
  - Message: `feat(web): add editor profile page with outreach and mediawiki data`
  - Files: `apps/web/src/routes/editors.$editorId.tsx`
  - Pre-commit: `cd apps/web && bun tsc --noEmit`

---

- [x] 8. Create Author Backfill Job Endpoint

  **What to do**:
  - Add `POST /api/outreach/backfill-authors` endpoint to `apps/api/src/routes/outreach.ts`
  - Query all OutreachArticleEditor where isAuthor is null/false
  - For each, call WikimediaClient.getArticleInfo to detect author
  - Update isAuthor field
  - Use rate limiter (200ms delay between calls recommended)
  - Return progress/stats: total, processed, authors_found

  **Must NOT do**:
  - Run automatically on startup
  - Process all 46,000 articles at once (implement batch limit)
  - Create separate service class

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Batch processing endpoint, similar to existing sync patterns
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 2, 4

  **References**:
  - `apps/api/src/routes/outreach.ts` - Add endpoint here
  - `apps/api/src/services/outreach-article-sync.service.ts` - Author detection pattern (from Task 4)
  - `packages/utils/src/wikimedia/rate-limiter.ts` - Rate limiter for API calls

  **Acceptance Criteria**:
  - [ ] Endpoint exists: `curl -X POST http://localhost:3001/api/outreach/backfill-authors` → 200
  - [ ] Returns stats: Response includes processed count
  - [ ] Rate limited: Does not exceed 200 req/s

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Backfill endpoint processes articles
    Tool: Bash
    Preconditions: API server running, OutreachArticleEditor rows exist with isAuthor=false
    Steps:
      1. curl -s -X POST "http://localhost:3001/api/outreach/backfill-authors?limit=5" | jq '.success'
      2. Assert: success is true
      3. curl -s -X POST "http://localhost:3001/api/outreach/backfill-authors?limit=5" | jq '.data.processed'
      4. Assert: processed count is number
    Expected Result: Backfill processes articles and returns stats
    Evidence: Response body captured

  Scenario: Backfill respects rate limit
    Tool: Bash
    Preconditions: API server running
    Steps:
      1. time curl -s -X POST "http://localhost:3001/api/outreach/backfill-authors?limit=5"
      2. Assert: Request takes at least 1 second (5 articles × 200ms)
    Expected Result: Rate limiting applied
    Evidence: Time output captured
  ```

  **Commit**: YES
  - Message: `feat(api): add author backfill endpoint for existing outreach articles`
  - Files: `apps/api/src/routes/outreach.ts`
  - Pre-commit: `cd apps/api && bun tsc --noEmit`

---

### Wave 4: Integration

- [x] 9. Integration Testing and Polish

  **What to do**:
  - Run full integration test: Sync article → verify isAuthor → verify UI display
  - Verify all components work together
  - Fix any TypeScript errors
  - Run `bun tsc --noEmit` in both apps
  - Test edge cases: 0 editors, 10+ editors, external editors

  **Must NOT do**:
  - Add new features
  - Refactor existing code

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and minor fixes only
  - **Skills**: [`playwright`]
    - playwright: End-to-end testing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None (final)
  - **Blocked By**: Tasks 6, 7, 8

  **References**:
  - All previous tasks' files
  - `apps/api/src/__tests__/api.test.ts` - Existing API tests

  **Acceptance Criteria**:
  - [ ] TypeScript: Both apps compile without errors
  - [ ] API: All new endpoints return expected data
  - [ ] UI: Editors column, tooltip, badges all work
  - [ ] Profile: Page loads and displays data
  - [ ] Edge cases: 0 editors shows "—", many editors shows "+N more"

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full integration - articles page with editors
    Tool: Playwright (playwright skill)
    Preconditions: All previous tasks completed, dev server running
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible
      3. Assert: Editors column exists
      4. Hover: First editors badge
      5. Assert: Tooltip appears
      6. Click: First editor link
      7. Wait for: Profile page loads
      8. Assert: Profile shows editor data
      9. Screenshot: .sisyphus/evidence/task-9-integration.png
    Expected Result: Complete flow works end-to-end
    Evidence: .sisyphus/evidence/task-9-integration.png

  Scenario: Edge case - article with no editors
    Tool: Playwright (playwright skill)
    Preconditions: Article with 0 editors exists
    Steps:
      1. Navigate to: /articles and find article with no editors
      2. Assert: Editors cell shows "—" or empty state
    Expected Result: Empty state handled
    Evidence: Screenshot captured

  Scenario: TypeScript compilation passes
    Tool: Bash
    Preconditions: All code changes complete
    Steps:
      1. cd apps/api && bun tsc --noEmit
      2. Assert: exit code 0
      3. cd apps/web && bun tsc --noEmit
      4. Assert: exit code 0
    Expected Result: No TypeScript errors
    Evidence: Command outputs captured
  ```

  **Commit**: YES (if any fixes needed)
  - Message: `fix(web): polish editors column integration`
  - Files: Any files with fixes
  - Pre-commit: `bun tsc --noEmit` in both apps

---

## Commit Strategy

| After Task | Message                                                                   | Files                                  | Verification    |
| ---------- | ------------------------------------------------------------------------- | -------------------------------------- | --------------- |
| 1          | `feat(web): add tooltip component via shadcn`                             | apps/web/src/components/ui/tooltip.tsx | bun tsc         |
| 2          | `feat(db): add isAuthor to OutreachArticleEditor`                         | schema.prisma, migrations/\*           | prisma generate |
| 3          | `feat(web): add OutreachArticleEditor type with isAuthor field`           | apps/web/src/lib/api.ts                | bun tsc         |
| 4          | `feat(api): add author detection to outreach article sync`                | outreach-article-sync.service.ts       | bun tsc         |
| 5          | `feat(api): add editor profile endpoint with outreach and mediawiki data` | apps/api/src/routes/editors.ts         | curl test       |
| 6          | `feat(web): add editors column to articles table with tooltip and badges` | articles.tsx                           | playwright      |
| 7          | `feat(web): add editor profile page with outreach and mediawiki data`     | editors.$editorId.tsx                  | playwright      |
| 8          | `feat(api): add author backfill endpoint for existing outreach articles`  | outreach.ts                            | curl test       |
| 9          | `fix(web): polish editors column integration` (if needed)                 | various                                | full test       |

---

## Success Criteria

### Verification Commands

```bash
# TypeScript compilation
cd apps/api && bun tsc --noEmit  # Expected: exit 0
cd apps/web && bun tsc --noEmit  # Expected: exit 0

# API endpoints
curl -s http://localhost:3001/api/outreach/articles/db?limit=1 | jq '.data.articles[0].editors'
# Expected: Array of editor objects with isAuthor field

curl -s http://localhost:3001/api/editors/{id}/profile | jq '.data'
# Expected: Object with editor, outreachStats, wikimediaProfile

curl -s -X POST http://localhost:3001/api/outreach/backfill-authors?limit=5 | jq '.data'
# Expected: Object with processed count
```

### Final Checklist

- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] TypeScript compiles in both apps
- [x] Editors column visible with count badge
- [x] Tooltip shows editor names (max 5 + "+N more")
- [x] Author badge visible for creators
- [x] OKA icon visible for tracked editors
- [x] Profile page loads with Outreach + MediaWiki data
- [x] Backfill endpoint processes existing articles
