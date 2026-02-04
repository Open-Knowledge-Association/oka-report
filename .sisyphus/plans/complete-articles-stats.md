# Complete Articles Page Statistics

## TL;DR

> **Quick Summary**: Add all missing statistics from Outreach Dashboard to the Articles page, matching the stats shown at https://outreachdashboard.wmflabs.org/courses/OKA/OKA/
>
> **Deliverables**:
>
> - Updated Articles page with 8 stat cards (Articles Created, Articles Edited, Total Edits, Editors, Words Added, References Added, Article Views, Commons Uploads)
> - Responsive grid layout matching Outreach Dashboard style
>
> **Estimated Effort**: Quick
> **Parallel Execution**: NO - sequential (API changes first, then frontend)
> **Critical Path**: Task 1 → Task 2

---

## Context

### Original Request

User wants the Articles page (`/articles`) to display all statistics from Outreach Dashboard:

- Articles Created
- Articles Edited
- Total Edits
- Editors
- Words Added
- References Added
- Article Views
- Commons Uploads

### Current State

**Articles page currently shows (from local DB):**

- Total Articles (46,860)
- Total Pageviews (2.36B)
- Wiki Projects (3)

**Missing stats** - these are available from Outreach Dashboard API (`/courses/OKA/OKA.json`):

- `created_count`: "13.3K" - Articles Created
- `edited_count`: "46.9K" - Articles Edited
- `edit_count`: "123K" - Total Edits
- `student_count`: 53 - Editors
- `word_count`: "74M" - Words Added
- `references_count`: "731K" - References Added
- `view_count`: "2.31B" - Article Views (same as our totalPageviews)
- `upload_count`: 2,713 - Commons Uploads

### Data Source Decision

The Outreach Dashboard API already provides human-readable formatted stats (`"13.3K"`, `"74M"`, etc.). We should use these directly from the existing `/api/outreach/course` endpoint rather than calculating from local DB.

**Why**:

1. Stats like `word_count`, `edit_count`, `upload_count` are NOT stored in our local DB
2. Outreach Dashboard is the source of truth
3. Already have API endpoint that fetches this data

---

## Work Objectives

### Core Objective

Display all 8 key statistics from Outreach Dashboard on the Articles page in a responsive card grid.

### Concrete Deliverables

- `apps/web/src/routes/articles.tsx`: Updated with 8 stat cards using Outreach course data
- `apps/web/src/lib/api.ts`: Add type for course stats (if needed)

### Definition of Done

- [x] Articles page shows 8 stat cards: Articles Created, Articles Edited, Total Edits, Editors, Words Added, References Added, Article Views, Commons Uploads
- [x] Stats match values shown at https://outreachdashboard.wmflabs.org/courses/OKA/OKA/
- [x] Responsive grid (2 cols mobile, 4 cols desktop)
- [x] Loading state while fetching

### Must Have

- All 8 statistics displayed
- Use existing `/api/outreach/course` endpoint
- Human-readable format (K, M, B suffixes as provided by API)

### Must NOT Have (Guardrails)

- DO NOT calculate stats from local DB (use Outreach API directly)
- DO NOT create new API endpoints (existing `/api/outreach/course` has all data)
- DO NOT change the Articles table or pagination (keep existing functionality)

---

## Verification Strategy

### Test Decision

- **Infrastructure exists**: YES (vitest)
- **Automated tests**: NO - visual verification
- **Agent-Executed QA**: YES - Playwright

### Agent-Executed QA Scenarios

```
Scenario: Articles page shows all 8 statistics
  Tool: Playwright (playwright skill)
  Preconditions: API running on localhost:3000, Web running on localhost:3001
  Steps:
    1. Navigate to: http://localhost:3001/articles
    2. Wait for: Stats cards to load (timeout: 10s)
    3. Assert: Card with text "Articles Created" exists
    4. Assert: Card with text "Articles Edited" exists
    5. Assert: Card with text "Total Edits" exists
    6. Assert: Card with text "Editors" exists
    7. Assert: Card with text "Words Added" exists
    8. Assert: Card with text "References Added" exists
    9. Assert: Card with text "Article Views" exists
    10. Assert: Card with text "Commons Uploads" exists
    11. Screenshot: .sisyphus/evidence/articles-stats-complete.png
  Expected Result: All 8 stat cards visible with values
  Evidence: .sisyphus/evidence/articles-stats-complete.png

Scenario: Stats values match Outreach Dashboard
  Tool: Playwright (playwright skill)
  Steps:
    1. Navigate to: http://localhost:3001/articles
    2. Wait for: page load
    3. Assert: "Editors" card shows "53"
    4. Assert: "Commons Uploads" card shows value > 2000
  Expected Result: Values match Outreach Dashboard
  Evidence: Screenshot captured
```

---

## Execution Strategy

### Sequential Execution

Task 1 must complete before Task 2 (frontend needs to know the data structure).

### Dependency Matrix

| Task | Depends On | Blocks |
| ---- | ---------- | ------ |
| 1    | None       | 2      |
| 2    | 1          | None   |

---

## TODOs

- [x] 1. Update Articles page to fetch and display Outreach course stats

  **What to do**:
  1. Import `fetchOutreachCourse` in `articles.tsx` (already exists in api.ts)
  2. Add `useQuery` to fetch course data alongside existing stats
  3. Replace current 3-card grid with 8-card grid showing all Outreach stats
  4. Use responsive grid: `grid-cols-2 md:grid-cols-4`
  5. Add appropriate icons for each stat card

  **Card Layout**:

  ```
  Row 1: Articles Created | Articles Edited | Total Edits | Editors
  Row 2: Words Added | References Added | Article Views | Commons Uploads
  ```

  **Must NOT do**:
  - Do not remove the existing Wiki Breakdown table
  - Do not remove the Articles table with pagination
  - Do not remove search/filter functionality

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: UI component layout and responsive design

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: None (final task)

  **References**:

  **Pattern References**:
  - `apps/web/src/routes/index.tsx:13-21` - Example of fetching outreach course data with useQuery
  - `apps/web/src/components/outreach/OutreachStats.tsx:57-74` - Example card layout for course stats
  - `apps/web/src/routes/articles.tsx:122-154` - Current 3-card stats grid to replace

  **API References**:
  - `apps/web/src/lib/api.ts:80-81` - `fetchOutreachCourse` function (already exists)
  - Outreach API response fields: `created_count`, `edited_count`, `edit_count`, `student_count`, `word_count`, `references_count`, `view_count`, `upload_count`

  **Icon Suggestions** (from lucide-react):
  - Articles Created: `FilePlus`
  - Articles Edited: `FileEdit`
  - Total Edits: `Edit`
  - Editors: `Users`
  - Words Added: `Type`
  - References Added: `BookOpen`
  - Article Views: `Eye`
  - Commons Uploads: `Upload`

  **Code Changes**:
  1. Add import for `fetchOutreachCourse` and new icons:

  ```tsx
  import { fetchOutreachArticles, fetchArticleStats, fetchOutreachCourse } from "@/lib/api";
  import {
    FilePlus,
    FileEdit,
    Edit,
    Users,
    Type,
    BookOpen,
    Eye,
    Upload,
    Globe,
    Search,
  } from "lucide-react";
  ```

  2. Add useQuery for course data (after existing queries around line 67-82):

  ```tsx
  // Course stats query (from Outreach Dashboard)
  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ["outreach", "course"],
    queryFn: fetchOutreachCourse,
  });

  const course = courseData?.course;
  ```

  3. Replace current 3-card grid (lines 122-154) with 8-card grid:

  ```tsx
  {
    /* Summary Cards - 8 stats from Outreach Dashboard */
  }
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Articles Created</CardTitle>
        <FilePlus className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {courseLoading ? "..." : (course?.created_count ?? "-")}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Articles Edited</CardTitle>
        <FileEdit className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {courseLoading ? "..." : (course?.edited_count ?? "-")}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Edits</CardTitle>
        <Edit className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {courseLoading ? "..." : (course?.edit_count ?? "-")}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Editors</CardTitle>
        <Users className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {courseLoading ? "..." : (course?.student_count ?? "-")}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Words Added</CardTitle>
        <Type className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {courseLoading ? "..." : (course?.word_count ?? "-")}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">References Added</CardTitle>
        <BookOpen className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {courseLoading ? "..." : (course?.references_count ?? "-")}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Article Views</CardTitle>
        <Eye className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {courseLoading ? "..." : (course?.view_count ?? "-")}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Commons Uploads</CardTitle>
        <Upload className="h-4 w-4 text-slate-500" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {courseLoading ? "..." : (course?.upload_count?.toLocaleString() ?? "-")}
        </div>
      </CardContent>
    </Card>
  </div>;
  ```

  4. Update loading state check (around line 112):

  ```tsx
  const isLoading = statsLoading || articlesLoading || courseLoading;
  ```

  **Acceptance Criteria**:
  - [ ] `fetchOutreachCourse` imported and used with useQuery
  - [ ] 8 stat cards displayed in 2x4 grid
  - [ ] Cards show: Articles Created, Articles Edited, Total Edits, Editors, Words Added, References Added, Article Views, Commons Uploads
  - [ ] Each card has appropriate icon
  - [ ] Loading state shows "..." while fetching
  - [ ] TypeScript compiles without errors: `cd apps/web && bun tsc --noEmit`

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: TypeScript compiles successfully
    Tool: Bash
    Steps:
      1. cd /home/rio/Works/oka/report/apps/web && bun tsc --noEmit
    Expected Result: No TypeScript errors
    Evidence: Exit code 0

  Scenario: All 8 stat cards render
    Tool: Playwright (playwright skill)
    Preconditions: Dev servers running
    Steps:
      1. Navigate to: http://localhost:3001/articles
      2. Wait for: text "Articles Created" visible (timeout: 10s)
      3. Assert: text "Articles Edited" visible
      4. Assert: text "Total Edits" visible
      5. Assert: text "Editors" visible
      6. Assert: text "Words Added" visible
      7. Assert: text "References Added" visible
      8. Assert: text "Article Views" visible
      9. Assert: text "Commons Uploads" visible
      10. Screenshot: .sisyphus/evidence/task-1-all-stats.png
    Expected Result: All 8 stat cards visible
    Evidence: .sisyphus/evidence/task-1-all-stats.png
  ```

  **Commit**: YES
  - Message: `feat(web): add complete statistics from Outreach Dashboard to articles page`
  - Files: `apps/web/src/routes/articles.tsx`

---

## Commit Strategy

| After Task | Message                                                                       | Files                              | Verification               |
| ---------- | ----------------------------------------------------------------------------- | ---------------------------------- | -------------------------- |
| 1          | `feat(web): add complete statistics from Outreach Dashboard to articles page` | `apps/web/src/routes/articles.tsx` | tsc --noEmit, visual check |

---

## Success Criteria

### Verification Commands

```bash
# TypeScript compiles
cd /home/rio/Works/oka/report/apps/web && bun tsc --noEmit

# Dev server runs
moon run web:dev
# Then open http://localhost:3001/articles
```

### Final Checklist

- [x] Articles Created card shows value (e.g., "13.3K")
- [x] Articles Edited card shows value (e.g., "46.9K")
- [x] Total Edits card shows value (e.g., "123K")
- [x] Editors card shows value (e.g., "53")
- [x] Words Added card shows value (e.g., "74M")
- [x] References Added card shows value (e.g., "731K")
- [x] Article Views card shows value (e.g., "2.31B")
- [x] Commons Uploads card shows value (e.g., "2,713")
- [x] Grid is responsive (2 cols mobile, 4 cols desktop)
- [x] Wiki Breakdown table still works
- [x] Articles table with pagination still works
- [x] Search and filter still work
