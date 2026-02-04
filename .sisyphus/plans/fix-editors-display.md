# Fix Editors Column Display

## TL;DR

> **Quick Summary**: Improve the Editors column in articles table to show editor names directly (not just count), add "Created by OKA" indicator on titles, fix profile links for SPA navigation.
>
> **Deliverables**:
>
> - Editors column shows max 3 editor names inline (with "+N more" for overflow)
> - "Author" badge for editors who created the article
> - "Created by OKA" badge on article titles for `isNewArticle: true`
> - SPA navigation using TanStack `<Link>` for editor profile links
>
> **Estimated Effort**: Quick (2-3 hours)
> **Parallel Execution**: NO - sequential (single file changes)
> **Critical Path**: Task 1 → Task 2 → Task 3

---

## Context

### Original Request

User is NOT satisfied with the current Editors column implementation:

- Shows count badge "3" instead of actual editor names
- Links use `<a href>` causing full page reload instead of SPA navigation
- No indication of whether article was originally created by OKA editor vs just edited

### Interview Summary

**Key Discussions**:

- User wants to see editor NAMES, not just a count
- "Author" badge for editors who CREATED the article (`isAuthor: true`)
- Article-level indicator for "originally created by OKA" (`isNewArticle: true`) - placed on Title column
- Max 3 editors shown inline, overflow shows "+N more"
- Keep tooltip for additional editor details (optional, for overflow)

**Research Findings**:

- Current implementation at `apps/web/src/routes/articles.tsx:330-368`
- Uses `<a href>` instead of TanStack `<Link>` (line 344-348)
- `isNewArticle` already in API response but NOT displayed
- `isAuthor` already rendered in tooltip but not prominently

### Metis Review

**Identified Gaps** (addressed):

- Max editors to show inline: **3 editors max**
- Placement of "New Article" indicator: **Title column as badge**
- Keep tooltip: **Yes, for hover details on all editors**
- SPA navigation: **Use `<Link>` from `@tanstack/react-router`**

---

## Work Objectives

### Core Objective

Improve the articles table Editors column UX by showing editor names directly, adding visual indicators for article origin, and fixing navigation.

### Concrete Deliverables

1. Editors column shows editor usernames inline (max 3, then "+N more")
2. "Author" badge for `isAuthor: true` editors
3. "Created by OKA" badge in Title column for `isNewArticle: true` articles
4. Editor profile links use `<Link>` for SPA navigation

### Definition of Done

- [x] Editor names visible in column (not just count)
- [x] Author badge visible on article creators
- [x] "Created by OKA" indicator on new articles
- [x] Click editor → navigates to profile WITHOUT page reload
- [x] TypeScript compiles without errors

### Must Have

- Editor names displayed inline in Editors column
- Author badge for `isAuthor: true`
- "Created by OKA" badge on Title for `isNewArticle: true`
- `<Link>` component for SPA navigation

### Must NOT Have (Guardrails)

- **No API changes** - data already exists
- **No new columns** - use existing Title and Editors columns
- **No filtering by editor** - not in scope
- **No sorting by editor count** - not in scope
- **No mobile responsiveness changes** - unless broken
- **No other column modifications** (Wiki, Pageviews, Characters, References)
- **No editor avatars** - not requested
- **No removal of existing tooltip** - keep for hover details

---

## Verification Strategy (MANDATORY)

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks MUST be verifiable WITHOUT any human action.

### Test Decision

- **Infrastructure exists**: YES (vitest in apps/web)
- **Automated tests**: No new tests needed (UI changes only)
- **Framework**: Playwright for E2E verification

### Agent-Executed QA Scenarios (MANDATORY)

All verification uses:

- **Playwright** (playwright skill) for UI verification
- **Bash** for TypeScript compilation checks

---

## Execution Strategy

### Sequential Execution (Single File)

```
Task 1: Add "Created by OKA" badge to Title column
    ↓
Task 2: Refactor Editors column to show names inline
    ↓
Task 3: Fix editor profile links to use <Link>
    ↓
Task 4: Final verification
```

All tasks modify `apps/web/src/routes/articles.tsx` - must be sequential.

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 4      | None                 |
| 2    | None       | 4      | None                 |
| 3    | None       | 4      | None                 |
| 4    | 1, 2, 3    | None   | None (final)         |

### Agent Dispatch Summary

| Task | Recommended Agents               |
| ---- | -------------------------------- |
| 1    | quick - simple badge addition    |
| 2    | quick - refactor existing code   |
| 3    | quick - import + replace pattern |
| 4    | quick - verification only        |

---

## TODOs

- [x] 1. Add "Created by OKA" Badge to Title Column

  **What to do**:
  - In `apps/web/src/routes/articles.tsx`, modify the Title cell (around line 319-327)
  - Check `article.isNewArticle === true`
  - If true, add a Badge component with text "Created" or icon (✨/📝)
  - Place badge AFTER the article title link, inside the same TableCell
  - Use existing Badge component with variant="secondary" or a distinct color

  **Must NOT do**:
  - Add new columns
  - Modify other cells
  - Fetch additional data

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple conditional badge addition
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `apps/web/src/routes/articles.tsx:317-328` - Title cell to modify
  - `apps/web/src/components/ui/badge.tsx` - Badge component
  - `apps/web/src/lib/api.ts:103-117` - OutreachArticle type has `isNewArticle`

  **Acceptance Criteria**:
  - [ ] Articles with `isNewArticle: true` show "Created" badge
  - [ ] Articles with `isNewArticle: false` show no badge
  - [ ] Badge is visually distinct (different from Author badge)
  - [ ] TypeScript compiles: `cd apps/web && bun tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: "Created by OKA" badge visible on new articles
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, articles with isNewArticle=true exist
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible (timeout: 10s)
      3. Find article row where title cell contains "Created" badge
      4. Assert: Badge element exists with text "Created" or similar
      5. Screenshot: .sisyphus/evidence/task-1-created-badge.png
    Expected Result: "Created" badge visible on appropriate articles
    Evidence: .sisyphus/evidence/task-1-created-badge.png

  Scenario: No badge on edited-only articles
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, articles with isNewArticle=false exist
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Find article row where isNewArticle is false (no Created badge)
      3. Assert: Title cell does NOT contain "Created" badge
    Expected Result: Edited articles don't have "Created" badge
    Evidence: Visual inspection via screenshot
  ```

  **Commit**: YES
  - Message: `feat(web): add "Created by OKA" badge to article titles`
  - Files: `apps/web/src/routes/articles.tsx`
  - Pre-commit: `cd apps/web && bun tsc --noEmit`

---

- [x] 2. Refactor Editors Column to Show Names Inline

  **What to do**:
  - In `apps/web/src/routes/articles.tsx`, modify the Editors cell (around line 330-368)
  - Replace the count badge approach with inline editor names
  - Show max 3 editor usernames, separated by comma
  - For editors with `isAuthor: true`, add "Author" badge after their name
  - If >3 editors, show "+N more" at the end
  - Keep the existing Tooltip wrapper for hover details (shows all editors)
  - Sort editors so authors appear first

  **Display Pattern**:

  ```
  // 1 editor (author)
  Rio Author

  // 2 editors (one author)
  Rio Author, Budi

  // 3 editors (one author)
  Rio Author, Budi, Dewi

  // 5 editors (one author)
  Rio Author, Budi, Dewi +2 more
  ```

  **Must NOT do**:
  - Remove tooltip functionality
  - Fetch additional data
  - Change column width explicitly
  - Add filtering or sorting UI

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Refactoring existing render logic
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `apps/web/src/routes/articles.tsx:330-368` - Current Editors cell implementation
  - `apps/web/src/components/ui/badge.tsx` - Badge for "Author"
  - `apps/web/src/lib/api.ts:21-26` - OutreachArticleEditor type with isAuthor

  **Acceptance Criteria**:
  - [ ] Editor names visible inline (not count badge)
  - [ ] Max 3 names shown, then "+N more"
  - [ ] "Author" badge visible on creators
  - [ ] Authors appear first in the list
  - [ ] Tooltip still works on hover (shows all editors)
  - [ ] Empty state (0 editors) shows "—"
  - [ ] TypeScript compiles: `cd apps/web && bun tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Editor names shown inline
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, articles with editors exist
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible (timeout: 10s)
      3. Find first article row with editors
      4. Assert: Editors cell contains username text (not just number)
      5. Screenshot: .sisyphus/evidence/task-2-editor-names.png
    Expected Result: Editor usernames visible in column
    Evidence: .sisyphus/evidence/task-2-editor-names.png

  Scenario: Author badge visible
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, article with isAuthor=true editor
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Find editors cell with "Author" text/badge
      3. Assert: "Author" badge present
      4. Screenshot: .sisyphus/evidence/task-2-author-badge.png
    Expected Result: Author indicator visible
    Evidence: .sisyphus/evidence/task-2-author-badge.png

  Scenario: Overflow shows "+N more"
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, article with >3 editors
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Find article with 4+ editors
      3. Assert: Cell contains "+X more" text
    Expected Result: Overflow indicator present
    Evidence: Visual confirmation

  Scenario: Empty state shows dash
    Tool: Playwright (playwright skill)
    Preconditions: Article with 0 editors exists
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Find article with no editors
      3. Assert: Cell shows "—"
    Expected Result: Empty state handled
    Evidence: Visual confirmation
  ```

  **Commit**: YES
  - Message: `feat(web): show editor names inline in articles table`
  - Files: `apps/web/src/routes/articles.tsx`
  - Pre-commit: `cd apps/web && bun tsc --noEmit`

---

- [x] 3. Fix Editor Profile Links to Use TanStack Link

  **What to do**:
  - In `apps/web/src/routes/articles.tsx`, add import for Link component
  - Add: `import { Link } from "@tanstack/react-router";` at top of file
  - Replace `<a href={/editors/${editor.editor.id}}>` with `<Link to={/editors/${editor.editor.id}}>`
  - Apply to both inline editor names AND tooltip editor names
  - Ensure proper params typing for the route

  **Must NOT do**:
  - Change external links (article URLs should remain `<a>` for Wikipedia)
  - Modify Link styling significantly
  - Add preloading or other Link features

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Import + find/replace pattern
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Task 3)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `apps/web/src/routes/articles.tsx:1` - Current imports (add Link here)
  - `apps/web/src/routes/articles.tsx:344-348` - Current `<a href>` usage (change to Link)
  - `apps/web/README.md:30-40` - TanStack Router Link documentation
  - `apps/web/src/routeTree.gen.ts:67` - `/editors/$editorId` route exists

  **Acceptance Criteria**:
  - [ ] Link component imported from @tanstack/react-router
  - [ ] Editor name links use `<Link to={...}>` not `<a href={...}>`
  - [ ] Clicking editor navigates WITHOUT page reload (SPA navigation)
  - [ ] Profile page loads with editor data
  - [ ] TypeScript compiles: `cd apps/web && bun tsc --noEmit` → exit 0

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: SPA navigation to editor profile
    Tool: Playwright (playwright skill)
    Preconditions: Dev server running, editor with profile exists
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible
      3. Note: current document load count or use performance marker
      4. Click: First editor name link in Editors column
      5. Wait for: URL contains /editors/
      6. Assert: URL matches /editors/{id} pattern
      7. Assert: No full page navigation occurred (check document doesn't reload)
      8. Assert: Editor profile content visible (username heading)
      9. Screenshot: .sisyphus/evidence/task-3-spa-navigation.png
    Expected Result: Smooth SPA transition to profile page
    Evidence: .sisyphus/evidence/task-3-spa-navigation.png

  Scenario: Profile page displays editor data
    Tool: Playwright (playwright skill)
    Preconditions: Navigated to editor profile via Link
    Steps:
      1. After SPA navigation from articles page
      2. Assert: h1 contains editor username
      3. Assert: Stats cards visible (Articles, Characters Added, etc.)
      4. Screenshot: .sisyphus/evidence/task-3-profile-content.png
    Expected Result: Profile page renders correctly
    Evidence: .sisyphus/evidence/task-3-profile-content.png
  ```

  **Commit**: YES
  - Message: `fix(web): use TanStack Link for editor profile navigation`
  - Files: `apps/web/src/routes/articles.tsx`
  - Pre-commit: `cd apps/web && bun tsc --noEmit`

---

- [x] 4. Final Verification and Integration Test

  **What to do**:
  - Run full TypeScript compilation check
  - Run Playwright integration test through the complete flow:
    1. Navigate to /articles
    2. Verify "Created" badge on title
    3. Verify editor names inline
    4. Verify "Author" badge
    5. Click editor → verify SPA navigation to profile
    6. Verify profile loads correctly
  - Fix any remaining issues

  **Must NOT do**:
  - Add new features
  - Major refactoring

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Verification and minor fixes only
  - **Skills**: [`playwright`]
    - playwright: End-to-end testing

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final)
  - **Blocks**: None
  - **Blocked By**: Tasks 1, 2, 3

  **References**:
  - All previous task files
  - `apps/web/src/routes/articles.tsx` - Main file modified

  **Acceptance Criteria**:
  - [ ] TypeScript compiles: `cd apps/web && bun tsc --noEmit` → exit 0
  - [ ] All UI elements work as specified
  - [ ] SPA navigation functions correctly
  - [ ] No console errors

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full integration test
    Tool: Playwright (playwright skill)
    Preconditions: All previous tasks completed, dev server running
    Steps:
      1. Navigate to: http://localhost:3000/articles
      2. Wait for: table visible
      3. Assert: "Created" badge on some article titles
      4. Assert: Editor names visible in Editors column
      5. Assert: "Author" badge visible on some editors
      6. Click: First editor name
      7. Wait for: /editors/ URL
      8. Assert: Profile page content visible
      9. Screenshot: .sisyphus/evidence/task-4-integration.png
    Expected Result: Complete flow works end-to-end
    Evidence: .sisyphus/evidence/task-4-integration.png

  Scenario: TypeScript compilation passes
    Tool: Bash
    Preconditions: All code changes complete
    Steps:
      1. cd apps/web && bun tsc --noEmit
      2. Assert: exit code 0
    Expected Result: No TypeScript errors
    Evidence: Command output captured
  ```

  **Commit**: YES (if any fixes needed)
  - Message: `fix(web): polish editors display integration`
  - Files: Any files with fixes
  - Pre-commit: `cd apps/web && bun tsc --noEmit`

---

## Commit Strategy

| After Task | Message                                                     | Files        | Verification         |
| ---------- | ----------------------------------------------------------- | ------------ | -------------------- |
| 1          | `feat(web): add "Created by OKA" badge to article titles`   | articles.tsx | bun tsc              |
| 2          | `feat(web): show editor names inline in articles table`     | articles.tsx | bun tsc              |
| 3          | `fix(web): use TanStack Link for editor profile navigation` | articles.tsx | bun tsc + playwright |
| 4          | `fix(web): polish editors display integration` (if needed)  | articles.tsx | full test            |

---

## Success Criteria

### Verification Commands

```bash
# TypeScript compilation
cd apps/web && bun tsc --noEmit  # Expected: exit 0

# Visual verification via Playwright
# See QA scenarios for each task
```

### Final Checklist

- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] TypeScript compiles without errors
- [x] "Created by OKA" badge on article titles
- [x] Editor names shown inline (max 3)
- [x] "Author" badge on creators
- [x] SPA navigation to editor profiles
- [x] No full page reloads when clicking editor links
