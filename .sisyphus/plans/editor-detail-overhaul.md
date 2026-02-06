# Editor Detail Page Overhaul

## TL;DR

> **Quick Summary**: Comprehensive redesign and enhancement of the Editor Profile page with interactive charts, new metrics display, achievement badges, and improved article table - transforming it from a basic profile into a full-featured editor analytics dashboard.
>
> **Deliverables**:
>
> - 4 interactive Chart.js visualizations (Timeline, Pageviews, Heatmap, Wiki Distribution)
> - Commons Uploads gallery section
> - 7 achievement badges system
> - Enhanced article table with sorting, filtering, pagination, search
> - Export profile feature (CSV with full data)
> - Share profile functionality
> - Compare editors page
> - Mobile-responsive tabbed chart view
>
> **Estimated Effort**: XL (10-15 tasks, multi-day implementation)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 0 (Test Infra) → Task 1 (API) → Tasks 2-5 (Charts) → Tasks 6-11 (Features)

---

## Context

### Original Request

User requested a comprehensive overhaul of the Editor Detail page to maximize all aspects: visualizations, metrics, UI/UX, new features, and table improvements.

### Interview Summary

**Key Discussions**:

- User wants ALL available features implemented
- Chart.js selected as charting library
- TDD approach with Vitest
- External library for Activity Heatmap (simpler approach)
- Compare Editors as dedicated page (recommended by Prometheus)
- Full data export (summary + articles + daily stats)
- Client-side pagination sufficient (< 50 articles per editor)
- Tabbed chart view for mobile (recommended by Prometheus)

**Research Findings**:

- `EditorDailyStat` table exists with all time-series data needed
- `CommonsUpload` table has `fileUrl` for gallery display
- `GET /api/stats/editors/history` endpoint may exist (needs verification)
- UI Guidelines in `docs/UI_RULES_OF_THUMB.md` must be followed
- Zero component tests exist - must establish pattern first

### Metis Review

**Identified Gaps** (addressed):

- Chart library decision: Chart.js confirmed
- Heatmap implementation: External library (react-activity-calendar)
- Compare Editors UX: New dedicated page
- Export scope: Full data export
- Badge criteria: 7 badges with specific thresholds defined
- Mobile strategy: Tabbed chart view
- Test infrastructure: Must be established as Phase 0

---

## Work Objectives

### Core Objective

Transform the Editor Profile page from a basic stats display into a comprehensive editor analytics dashboard with interactive visualizations, achievements, and enhanced data exploration capabilities.

### Concrete Deliverables

1. `apps/web/src/routes/editors.$editorId.tsx` - Redesigned main component
2. `apps/web/src/components/editor/` - New component folder:
   - `ContributionTimelineChart.tsx`
   - `PageviewsChart.tsx`
   - `ActivityHeatmap.tsx`
   - `WikiDistributionChart.tsx`
   - `CommonsGallery.tsx`
   - `AchievementBadges.tsx`
   - `EditorStatsCards.tsx`
   - `ArticlesTable.tsx` (enhanced)
   - `ExportButton.tsx`
   - `ShareButton.tsx`
3. `apps/web/src/routes/editors.compare.tsx` - Compare editors page
4. `apps/api/src/routes/editors.ts` - New/enhanced endpoints:
   - `GET /api/editors/:id/daily-stats`
   - `GET /api/editors/:id/commons-uploads`
   - `GET /api/editors/:id/achievements`
5. Test files for each component

### Definition of Done

- [ ] `bun --bun run test` passes with all new tests
- [ ] All 4 charts render with sample data
- [ ] All 7 badges calculate correctly
- [ ] Article table supports sort, filter, search, pagination
- [ ] Export generates valid CSV
- [ ] Share button copies URL to clipboard
- [ ] Compare page works with 2 editors
- [ ] Mobile view shows tabbed charts
- [ ] Playwright E2E verification passes

### Must Have

- Chart.js for all chart components
- TDD approach - tests written before implementation
- Responsive design following UI_RULES_OF_THUMB.md
- Loading skeletons for all async data
- Empty states for all visualizations
- Error handling with retry actions

### Must NOT Have (Guardrails)

- ❌ Do NOT use Recharts or D3.js (Chart.js only)
- ❌ Do NOT implement PDF export (CSV only for v1)
- ❌ Do NOT allow more than 2 editors in comparison
- ❌ Do NOT add more than 3 new API endpoints
- ❌ Do NOT modify database schema
- ❌ Do NOT skip establishing test infrastructure
- ❌ Do NOT use heavy animations (per UI guidelines)
- ❌ Do NOT create custom heatmap (use external library)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks are verifiable WITHOUT any human action.
> Agent uses tools (Playwright, Bash, curl) to verify.

### Test Decision

- **Infrastructure exists**: YES (Vitest configured)
- **Automated tests**: TDD (Test-Driven Development)
- **Framework**: Vitest + @testing-library/react

### If TDD Enabled (YES)

Each TODO follows RED-GREEN-REFACTOR:

**Task Structure:**

1. **RED**: Write failing test first
   - Test file: `apps/web/src/components/editor/__tests__/{Component}.test.tsx`
   - Test command: `bun --bun run test`
   - Expected: FAIL (test exists, implementation doesn't)
2. **GREEN**: Implement minimum code to pass
   - Command: `bun --bun run test`
   - Expected: PASS
3. **REFACTOR**: Clean up while keeping green
   - Command: `bun --bun run test`
   - Expected: PASS (still)

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

**Verification Tool by Deliverable Type:**

| Type           | Tool                          | How Agent Verifies                            |
| -------------- | ----------------------------- | --------------------------------------------- |
| **Charts/UI**  | Playwright (playwright skill) | Navigate, interact, assert DOM, screenshot    |
| **API**        | Bash (curl)                   | Send requests, parse responses, assert fields |
| **Components** | Vitest                        | Unit test with React Testing Library          |

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 0 (BLOCKER - Start First):
└── Task 0: Test Infrastructure Setup

Wave 1 (After Wave 0):
├── Task 1: Daily Stats API Endpoint
├── Task 2: Commons Uploads API Endpoint
└── Task 3: Achievements API Endpoint

Wave 2 (After Wave 1):
├── Task 4: Contribution Timeline Chart
├── Task 5: Pageviews per Article Chart
├── Task 6: Activity Heatmap
└── Task 7: Wiki Distribution Chart

Wave 3 (After Wave 2):
├── Task 8: Commons Gallery Component
├── Task 9: Achievement Badges Component
├── Task 10: Enhanced Article Table
└── Task 11: Stats Cards Redesign

Wave 4 (After Wave 3):
├── Task 12: Export Profile Feature
├── Task 13: Share Profile Feature
├── Task 14: Compare Editors Page
└── Task 15: Mobile Responsive Tabs

Wave 5 (Final):
└── Task 16: Integration & Polish

Critical Path: Task 0 → Task 1 → Task 4 → Task 10 → Task 16
Parallel Speedup: ~60% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 0    | None       | All    | None (must be first) |
| 1    | 0          | 4, 6   | 2, 3                 |
| 2    | 0          | 8      | 1, 3                 |
| 3    | 0          | 9      | 1, 2                 |
| 4    | 1          | 15, 16 | 5, 6, 7              |
| 5    | 1          | 15, 16 | 4, 6, 7              |
| 6    | 1          | 15, 16 | 4, 5, 7              |
| 7    | 1          | 15, 16 | 4, 5, 6              |
| 8    | 2          | 16     | 9, 10, 11            |
| 9    | 3          | 16     | 8, 10, 11            |
| 10   | 0          | 12, 16 | 8, 9, 11             |
| 11   | 0          | 16     | 8, 9, 10             |
| 12   | 10         | 16     | 13, 14               |
| 13   | 0          | 16     | 12, 14               |
| 14   | 4, 9       | 16     | 12, 13               |
| 15   | 4, 5, 6, 7 | 16     | 12, 13, 14           |
| 16   | All        | None   | None (final)         |

### Agent Dispatch Summary

| Wave | Tasks          | Recommended Category          |
| ---- | -------------- | ----------------------------- |
| 0    | 0              | quick                         |
| 1    | 1, 2, 3        | quick (parallel)              |
| 2    | 4, 5, 6, 7     | visual-engineering (parallel) |
| 3    | 8, 9, 10, 11   | visual-engineering (parallel) |
| 4    | 12, 13, 14, 15 | unspecified-low (parallel)    |
| 5    | 16             | quick                         |

---

## TODOs

### Wave 0: Foundation

- [x] 0. **Test Infrastructure Setup**

  **What to do**:
  - Install @testing-library/react and related dependencies if not present
  - Create `apps/web/src/test-utils.tsx` with providers (QueryClient, Router)
  - Create example test to verify setup works
  - Add data-testid conventions to existing components as needed

  **Must NOT do**:
  - Do NOT modify Vitest config unless necessary
  - Do NOT add jest or other test runners

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 0 (solo)
  - **Blocks**: All other tasks
  - **Blocked By**: None

  **References**:
  - `apps/web/package.json` - Check existing test dependencies
  - `apps/web/README.md:17-21` - Vitest already configured
  - `apps/web/src/lib/api.test.ts` - Existing test file pattern (if exists)

  **Acceptance Criteria**:
  - [ ] `test-utils.tsx` created with QueryClientProvider and RouterProvider wrappers
  - [ ] Example test passes: `bun --bun run test`
  - [ ] `data-testid` convention documented in test-utils

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Vitest runs successfully with test utilities
    Tool: Bash
    Steps:
      1. cd apps/web && bun --bun run test
      2. Assert: Exit code 0
      3. Assert: Output contains "PASS" or shows test count
    Expected Result: Tests pass
    Evidence: Terminal output captured
  ```

  **Commit**: YES
  - Message: `feat(web): add test infrastructure with React Testing Library`
  - Files: `apps/web/src/test-utils.tsx`, `apps/web/package.json`

---

### Wave 1: API Endpoints

- [x] 1. **Daily Stats API Endpoint**

  **What to do**:
  - Create `GET /api/editors/:id/daily-stats` endpoint
  - Query `EditorDailyStat` table for the editor
  - Return array of daily stats with date, edits, wordsAdded, articlesCreated, etc.
  - Support optional date range query params (?from=&to=)

  **Must NOT do**:
  - Do NOT create new database tables
  - Do NOT duplicate existing endpoint logic

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 6
  - **Blocked By**: Task 0

  **References**:
  - `apps/api/src/routes/editors.ts:152-281` - Existing profile endpoint pattern
  - `packages/db/prisma/schema.prisma:436-457` - EditorDailyStat model
  - `apps/api/src/schemas/editor.schema.ts` - Zod validation patterns

  **Acceptance Criteria**:
  - [ ] Endpoint returns 200 with array of daily stats
  - [ ] Endpoint returns 404 if editor not found
  - [ ] Date filtering works with from/to params
  - [ ] `bun --bun run test` passes for new endpoint test

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Daily stats endpoint returns data
    Tool: Bash (curl)
    Preconditions: API server running, test editor exists
    Steps:
      1. curl -s http://localhost:3001/api/editors/{test-editor-id}/daily-stats
      2. Assert: HTTP 200
      3. Assert: Response is JSON array
      4. Assert: Each item has date, edits, wordsAdded fields
    Expected Result: Valid daily stats array
    Evidence: Response body captured

  Scenario: Daily stats with date filter
    Tool: Bash (curl)
    Steps:
      1. curl -s "http://localhost:3001/api/editors/{id}/daily-stats?from=2025-01-01&to=2025-01-31"
      2. Assert: All returned dates within range
    Expected Result: Filtered results
    Evidence: Response body captured

  Scenario: Daily stats for non-existent editor
    Tool: Bash (curl)
    Steps:
      1. curl -s http://localhost:3001/api/editors/nonexistent-id/daily-stats
      2. Assert: HTTP 404
    Expected Result: Not found error
    Evidence: Response captured
  ```

  **Commit**: YES
  - Message: `feat(api): add GET /api/editors/:id/daily-stats endpoint`
  - Files: `apps/api/src/routes/editors.ts`

---

- [x] 2. **Commons Uploads API Endpoint**

  **What to do**:
  - Create `GET /api/editors/:id/commons-uploads` endpoint
  - Query `CommonsUpload` table for the editor
  - Return array with fileName, fileUrl, fileSize, mimeType, uploadedAt
  - Include thumbnail URL generation if possible

  **Must NOT do**:
  - Do NOT process or resize images server-side
  - Do NOT create new database tables

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 8
  - **Blocked By**: Task 0

  **References**:
  - `apps/api/src/routes/editors.ts` - Existing endpoint patterns
  - `packages/db/prisma/schema.prisma:229-261` - CommonsUpload model
  - Wikimedia thumbnail URL format: `https://upload.wikimedia.org/wikipedia/commons/thumb/...`

  **Acceptance Criteria**:
  - [ ] Endpoint returns 200 with array of uploads
  - [ ] Each upload has fileUrl, fileName, uploadedAt
  - [ ] Endpoint returns 404 if editor not found
  - [ ] Empty array returned if no uploads (not error)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Commons uploads endpoint returns data
    Tool: Bash (curl)
    Steps:
      1. curl -s http://localhost:3001/api/editors/{id}/commons-uploads
      2. Assert: HTTP 200
      3. Assert: Response is JSON array
    Expected Result: Valid uploads array or empty array
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `feat(api): add GET /api/editors/:id/commons-uploads endpoint`
  - Files: `apps/api/src/routes/editors.ts`

---

- [x] 3. **Achievements API Endpoint**

  **What to do**:
  - Create `GET /api/editors/:id/achievements` endpoint
  - Calculate 7 badges based on editor stats:
    - 🎉 First Article: articlesCreated >= 1
    - 📚 Centurion: articlesCount >= 100
    - ✍️ Wordsmith: charactersAdded >= 1000
    - 👁️ Popular: pageviews >= 10000
    - 📷 Photographer: commonsUploads >= 5
    - 🔥 Consistent: activeDays >= 30
    - 🌍 Polyglot: uniqueWikis >= 3
  - Return array of earned badges with name, emoji, description, earnedAt

  **Must NOT do**:
  - Do NOT create badge table in database (calculate on-the-fly)
  - Do NOT store badge state persistently

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Task 9
  - **Blocked By**: Task 0

  **References**:
  - `apps/api/src/routes/editors.ts:152-281` - Profile endpoint with stats calculation
  - `packages/db/prisma/schema.prisma` - All stat tables

  **Acceptance Criteria**:
  - [ ] Endpoint returns array of Badge objects
  - [ ] Each badge has id, name, emoji, description, isEarned, threshold
  - [ ] Badge calculations are accurate based on stats
  - [ ] Works for editors with no achievements (empty earned array)

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Achievements endpoint returns badge status
    Tool: Bash (curl)
    Steps:
      1. curl -s http://localhost:3001/api/editors/{id}/achievements
      2. Assert: HTTP 200
      3. Assert: Response has "badges" array
      4. Assert: Each badge has isEarned boolean
    Expected Result: Badge status array
    Evidence: Response body captured

  Scenario: First Article badge earned correctly
    Tool: Bash (curl)
    Preconditions: Editor has at least 1 article
    Steps:
      1. Get achievements
      2. Find badge with id "first-article"
      3. Assert: isEarned === true
    Expected Result: Badge correctly marked as earned
    Evidence: Response body captured
  ```

  **Commit**: YES
  - Message: `feat(api): add GET /api/editors/:id/achievements endpoint`
  - Files: `apps/api/src/routes/editors.ts`

---

### Wave 2: Chart Components

- [x] 4. **Contribution Timeline Chart**

  **What to do**:
  - Create `apps/web/src/components/editor/ContributionTimelineChart.tsx`
  - Use Chart.js (react-chartjs-2) for line chart
  - Display edits and wordsAdded over time
  - Support date range filtering via props
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT use Recharts or D3
  - Do NOT implement real-time updates

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Tasks 14, 15, 16
  - **Blocked By**: Task 1

  **References**:
  - `apps/web/src/components/stats/TimeSeriesChart.tsx` - Existing chart pattern (if exists)
  - `docs/UI_RULES_OF_THUMB.md:59-64` - Chart guidelines
  - Chart.js docs: https://www.chartjs.org/docs/latest/

  **Acceptance Criteria**:
  - [ ] TDD: Test written first, fails, then passes after implementation
  - [ ] Line chart renders with dual Y-axes (edits, words)
  - [ ] Tooltips show date and values
  - [ ] Loading skeleton shown while fetching
  - [ ] Empty state if no data
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Timeline chart renders with data
    Tool: Playwright
    Preconditions: Dev server running, editor has daily stats
    Steps:
      1. Navigate to: http://localhost:3000/editors/{id}
      2. Wait for: [data-testid="contribution-timeline-chart"] visible (timeout: 10s)
      3. Assert: Canvas element exists inside chart container
      4. Screenshot: .sisyphus/evidence/task-4-timeline-chart.png
    Expected Result: Chart visible with data points
    Evidence: .sisyphus/evidence/task-4-timeline-chart.png

  Scenario: Timeline chart shows empty state
    Tool: Playwright
    Preconditions: Editor with no daily stats
    Steps:
      1. Navigate to editor profile
      2. Wait for chart area
      3. Assert: Empty state message visible
    Expected Result: "No activity data" message shown
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): add ContributionTimelineChart component with Chart.js`
  - Files: `apps/web/src/components/editor/ContributionTimelineChart.tsx`, `apps/web/src/components/editor/__tests__/ContributionTimelineChart.test.tsx`

---

- [x] 5. **Pageviews per Article Chart**

  **What to do**:
  - Create `apps/web/src/components/editor/PageviewsChart.tsx`
  - Use Chart.js for horizontal bar chart
  - Display top 10 articles by pageviews
  - Sortable (by pageviews, by date)
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT show all articles if > 10 (use top 10)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6, 7)
  - **Blocks**: Tasks 15, 16
  - **Blocked By**: Task 1

  **References**:
  - Chart.js horizontal bar: https://www.chartjs.org/docs/latest/charts/bar.html
  - `docs/UI_RULES_OF_THUMB.md:59-64` - Chart guidelines

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Horizontal bar chart with article titles as labels
  - [ ] Shows top 10 articles by pageviews
  - [ ] Click on bar navigates to article (optional)
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Pageviews chart renders top 10 articles
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Wait for [data-testid="pageviews-chart"]
      3. Assert: Chart has <= 10 bars
      4. Screenshot: .sisyphus/evidence/task-5-pageviews-chart.png
    Expected Result: Bar chart with article pageviews
    Evidence: .sisyphus/evidence/task-5-pageviews-chart.png
  ```

  **Commit**: YES
  - Message: `feat(web): add PageviewsChart component`
  - Files: `apps/web/src/components/editor/PageviewsChart.tsx`, `...test.tsx`

---

- [x] 6. **Activity Heatmap**

  **What to do**:
  - Install `react-activity-calendar` or similar library
  - Create `apps/web/src/components/editor/ActivityHeatmap.tsx`
  - Display GitHub-style contribution heatmap for last 12 months
  - Color intensity based on edits per day
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT build custom heatmap from scratch
  - Do NOT include more than 12 months of data

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 7)
  - **Blocks**: Tasks 15, 16
  - **Blocked By**: Task 1

  **References**:
  - react-activity-calendar: https://www.npmjs.com/package/react-activity-calendar
  - GitHub contribution graph as visual reference

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Heatmap shows 12 months of activity
  - [ ] Color legend visible
  - [ ] Tooltip on hover shows date and count
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Activity heatmap renders
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Wait for [data-testid="activity-heatmap"]
      3. Assert: Grid of squares visible
      4. Hover over a square with activity
      5. Assert: Tooltip appears with date and count
      6. Screenshot: .sisyphus/evidence/task-6-heatmap.png
    Expected Result: GitHub-style heatmap visible
    Evidence: .sisyphus/evidence/task-6-heatmap.png
  ```

  **Commit**: YES
  - Message: `feat(web): add ActivityHeatmap component with react-activity-calendar`
  - Files: `apps/web/src/components/editor/ActivityHeatmap.tsx`, `package.json`

---

- [x] 7. **Wiki Distribution Chart**

  **What to do**:
  - Create `apps/web/src/components/editor/WikiDistributionChart.tsx`
  - Use Chart.js for doughnut/pie chart
  - Show distribution of articles by wiki project (en, id, jv, etc.)
  - Legend with percentage breakdown
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT show more than 6 wikis (group others as "Other")

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 5, 6)
  - **Blocks**: Tasks 15, 16
  - **Blocked By**: Task 0 (uses existing profile data)

  **References**:
  - Chart.js doughnut: https://www.chartjs.org/docs/latest/charts/doughnut.html
  - `docs/UI_RULES_OF_THUMB.md:59-64`

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Doughnut chart with wiki breakdown
  - [ ] Legend shows wiki names and percentages
  - [ ] "Other" category for < 5% contributions
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Wiki distribution chart renders
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Wait for [data-testid="wiki-distribution-chart"]
      3. Assert: Doughnut chart visible
      4. Assert: Legend items present
      5. Screenshot: .sisyphus/evidence/task-7-wiki-distribution.png
    Expected Result: Pie/doughnut chart with wiki breakdown
    Evidence: .sisyphus/evidence/task-7-wiki-distribution.png
  ```

  **Commit**: YES
  - Message: `feat(web): add WikiDistributionChart component`
  - Files: `apps/web/src/components/editor/WikiDistributionChart.tsx`, `...test.tsx`

---

### Wave 3: Feature Components

- [x] 8. **Commons Gallery Component**

  **What to do**:
  - Create `apps/web/src/components/editor/CommonsGallery.tsx`
  - Display grid of uploaded images from Commons
  - Thumbnail view with lightbox on click
  - Show file name and upload date
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT load full-resolution images initially
  - Do NOT implement infinite scroll (simple pagination OK)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 9, 10, 11)
  - **Blocks**: Task 16
  - **Blocked By**: Task 2

  **References**:
  - Wikimedia thumbnail format
  - shadcn Dialog for lightbox

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Grid of thumbnail images
  - [ ] Click opens lightbox with full image
  - [ ] Shows "No uploads" if empty
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Commons gallery shows uploads
    Tool: Playwright
    Preconditions: Editor has Commons uploads
    Steps:
      1. Navigate to editor profile
      2. Scroll to Commons section
      3. Wait for [data-testid="commons-gallery"]
      4. Assert: Image thumbnails visible
      5. Click first image
      6. Assert: Lightbox dialog opens
      7. Screenshot: .sisyphus/evidence/task-8-gallery.png
    Expected Result: Gallery with clickable images
    Evidence: .sisyphus/evidence/task-8-gallery.png
  ```

  **Commit**: YES
  - Message: `feat(web): add CommonsGallery component`
  - Files: `apps/web/src/components/editor/CommonsGallery.tsx`

---

- [x] 9. **Achievement Badges Component**

  **What to do**:
  - Create `apps/web/src/components/editor/AchievementBadges.tsx`
  - Display all 7 badges (earned = colored, not earned = greyed out)
  - Tooltip on hover shows badge criteria
  - Animated reveal for earned badges (subtle)
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT add heavy animations
  - Do NOT allow clicking badges (display only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 10, 11)
  - **Blocks**: Tasks 14, 16
  - **Blocked By**: Task 3

  **References**:
  - Badge definitions from interview:
    - 🎉 First Article, 📚 Centurion, ✍️ Wordsmith, 👁️ Popular, 📷 Photographer, 🔥 Consistent, 🌍 Polyglot
  - shadcn Tooltip component

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] All 7 badges displayed
  - [ ] Earned badges are colorful, unearned are grey
  - [ ] Tooltip shows criteria and threshold
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Achievement badges display correctly
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Wait for [data-testid="achievement-badges"]
      3. Assert: 7 badge elements visible
      4. Assert: Some badges have "earned" styling
      5. Hover over a badge
      6. Assert: Tooltip with criteria appears
      7. Screenshot: .sisyphus/evidence/task-9-badges.png
    Expected Result: Badge grid with earned/unearned states
    Evidence: .sisyphus/evidence/task-9-badges.png
  ```

  **Commit**: YES
  - Message: `feat(web): add AchievementBadges component`
  - Files: `apps/web/src/components/editor/AchievementBadges.tsx`

---

- [ ] 10. **Enhanced Article Table**

  **What to do**:
  - Refactor articles section in editor profile
  - Add sorting (by title, characters, references, pageviews)
  - Add filtering (by wiki, by isNewArticle)
  - Add search box for title
  - Add client-side pagination (10 per page)
  - Add columns: pageviews, rating, isNewArticle
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT implement server-side pagination (client-side sufficient)
  - Do NOT add infinite scroll

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 11)
  - **Blocks**: Tasks 12, 16
  - **Blocked By**: Task 0

  **References**:
  - `apps/web/src/routes/editors.$editorId.tsx:220-269` - Current table implementation
  - TanStack Table docs for sorting/filtering
  - `docs/UI_RULES_OF_THUMB.md:52-58` - Table guidelines

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Column headers clickable for sorting
  - [ ] Wiki filter dropdown works
  - [ ] Search box filters by title
  - [ ] Pagination shows 10 items per page
  - [ ] New columns visible (pageviews, rating, isNew badge)
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Article table sorting works
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Wait for articles table
      3. Click "Characters" column header
      4. Assert: Rows reorder (descending)
      5. Click again
      6. Assert: Rows reorder (ascending)
    Expected Result: Sorting toggles correctly
    Evidence: Screenshot captured

  Scenario: Article table search works
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Find search input [data-testid="article-search"]
      3. Type "Indonesia"
      4. Assert: Only articles with "Indonesia" in title shown
    Expected Result: Filtered table
    Evidence: Screenshot captured

  Scenario: Article table pagination works
    Tool: Playwright
    Preconditions: Editor has > 10 articles
    Steps:
      1. Navigate to editor profile
      2. Assert: 10 rows visible
      3. Click "Next" pagination button
      4. Assert: Different 10 rows visible
    Expected Result: Pagination navigates
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): enhance articles table with sort, filter, search, pagination`
  - Files: `apps/web/src/components/editor/ArticlesTable.tsx`

---

- [ ] 11. **Stats Cards Redesign**

  **What to do**:
  - Create `apps/web/src/components/editor/EditorStatsCards.tsx`
  - Redesign 4 existing cards with trend indicators
  - Add new metrics: Words Added, Commons Uploads
  - Follow UI_RULES_OF_THUMB for card design
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT exceed 6 cards in a row

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 8, 9, 10)
  - **Blocks**: Task 16
  - **Blocked By**: Task 0

  **References**:
  - `apps/web/src/routes/editors.$editorId.tsx:132-173` - Current cards
  - `docs/UI_RULES_OF_THUMB.md:46-51` - Card guidelines

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] 6 stat cards displayed in grid
  - [ ] Each card has value, label, icon
  - [ ] Responsive: 2 cols mobile, 3 cols tablet, 6 cols desktop
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Stats cards render with all metrics
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Wait for [data-testid="editor-stats-cards"]
      3. Assert: 6 card elements visible
      4. Assert: Cards contain Articles, Characters, References, Pageviews, Words, Uploads
    Expected Result: All 6 cards visible
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): redesign EditorStatsCards with new metrics`
  - Files: `apps/web/src/components/editor/EditorStatsCards.tsx`

---

### Wave 4: Additional Features

- [ ] 12. **Export Profile Feature**

  **What to do**:
  - Create `apps/web/src/components/editor/ExportButton.tsx`
  - Export as CSV with full data (summary + articles + daily stats)
  - Client-side CSV generation (no backend needed)
  - Show loading state during generation
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT implement PDF export (CSV only for v1)
  - Do NOT create server-side export endpoint

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 13, 14, 15)
  - **Blocks**: Task 16
  - **Blocked By**: Task 10

  **References**:
  - `apps/web/src/routes/admin/editors/index.tsx:29-49` - Existing CSV export pattern

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Button visible in profile header
  - [ ] Click triggers CSV download
  - [ ] CSV contains summary, articles list, daily stats
  - [ ] File named `editor-{username}-{date}.csv`
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Export button downloads CSV
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Find [data-testid="export-button"]
      3. Click export button
      4. Assert: Download triggered (file in downloads folder)
      5. Verify CSV content has expected columns
    Expected Result: Valid CSV file downloaded
    Evidence: Downloaded file path
  ```

  **Commit**: YES
  - Message: `feat(web): add ExportButton for CSV profile export`
  - Files: `apps/web/src/components/editor/ExportButton.tsx`

---

- [ ] 13. **Share Profile Feature**

  **What to do**:
  - Create `apps/web/src/components/editor/ShareButton.tsx`
  - Copy profile URL to clipboard on click
  - Show toast notification on success
  - Optional: Social share buttons (Twitter, LinkedIn)
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT implement server-side short URLs
  - Do NOT add more than 3 social platforms

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 12, 14, 15)
  - **Blocks**: Task 16
  - **Blocked By**: Task 0

  **References**:
  - shadcn Toast component
  - Navigator clipboard API

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Share button visible in header
  - [ ] Click copies URL to clipboard
  - [ ] Toast shows "Link copied!"
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Share button copies URL
    Tool: Playwright
    Steps:
      1. Navigate to editor profile
      2. Click [data-testid="share-button"]
      3. Assert: Toast notification appears
      4. Assert: Toast text contains "copied"
    Expected Result: URL copied, toast shown
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): add ShareButton component`
  - Files: `apps/web/src/components/editor/ShareButton.tsx`

---

- [ ] 14. **Compare Editors Page**

  **What to do**:
  - Create `apps/web/src/routes/editors.compare.tsx`
  - Accept query params ?ids=id1,id2
  - Side-by-side comparison of 2 editors
  - Show stats comparison, charts comparison
  - Link from editor profile "Compare with..."
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT allow more than 2 editors
  - Do NOT implement drag-and-drop editor selection

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 12, 13, 15)
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 4, 9

  **References**:
  - `apps/web/src/routes/editors.$editorId.tsx` - Profile page pattern
  - TanStack Router search params

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Page at /editors/compare loads
  - [ ] Shows "Select 2 editors" if no ids
  - [ ] Side-by-side stats comparison
  - [ ] Bar chart comparing key metrics
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Compare page renders with 2 editors
    Tool: Playwright
    Preconditions: Two editor IDs known
    Steps:
      1. Navigate to: /editors/compare?ids={id1},{id2}
      2. Wait for page load
      3. Assert: Two editor names visible
      4. Assert: Comparison chart rendered
      5. Screenshot: .sisyphus/evidence/task-14-compare.png
    Expected Result: Side-by-side comparison
    Evidence: .sisyphus/evidence/task-14-compare.png

  Scenario: Compare page shows empty state
    Tool: Playwright
    Steps:
      1. Navigate to: /editors/compare
      2. Assert: "Select 2 editors" message visible
    Expected Result: Empty state guidance
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): add editors comparison page`
  - Files: `apps/web/src/routes/editors.compare.tsx`

---

- [ ] 15. **Mobile Responsive Tabs**

  **What to do**:
  - Create responsive layout for charts on mobile
  - Use shadcn Tabs component
  - On mobile: show tab switcher for charts
  - On desktop: show all charts in grid
  - Write test first (TDD)

  **Must NOT do**:
  - Do NOT hide charts completely on mobile
  - Do NOT use accordion (tabs preferred)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Tasks 12, 13, 14)
  - **Blocks**: Task 16
  - **Blocked By**: Tasks 4, 5, 6, 7

  **References**:
  - shadcn Tabs: https://ui.shadcn.com/docs/components/tabs
  - `docs/UI_RULES_OF_THUMB.md:83-88` - Responsive rules

  **Acceptance Criteria**:
  - [ ] TDD: Test written first
  - [ ] Mobile (< 768px): Tabbed chart view
  - [ ] Desktop (>= 768px): Grid layout
  - [ ] Tab labels: Timeline, Pageviews, Activity, Distribution
  - [ ] Active tab persists on navigation (optional)
  - [ ] `bun --bun run test` passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Mobile view shows tabbed charts
    Tool: Playwright
    Steps:
      1. Set viewport to mobile (375x667)
      2. Navigate to editor profile
      3. Assert: Tab bar visible with 4 tabs
      4. Click "Activity" tab
      5. Assert: Heatmap chart visible
      6. Screenshot: .sisyphus/evidence/task-15-mobile-tabs.png
    Expected Result: Tabbed interface on mobile
    Evidence: .sisyphus/evidence/task-15-mobile-tabs.png

  Scenario: Desktop view shows grid layout
    Tool: Playwright
    Steps:
      1. Set viewport to desktop (1280x800)
      2. Navigate to editor profile
      3. Assert: All 4 charts visible simultaneously
      4. Assert: No tab bar visible
    Expected Result: Grid layout on desktop
    Evidence: Screenshot captured
  ```

  **Commit**: YES
  - Message: `feat(web): add responsive tabbed chart layout for mobile`
  - Files: `apps/web/src/components/editor/ChartsSection.tsx`

---

### Wave 5: Integration

- [ ] 16. **Integration & Polish**

  **What to do**:
  - Integrate all components into main editor profile page
  - Update `apps/web/src/routes/editors.$editorId.tsx`
  - Ensure all sections flow properly
  - Add loading skeletons for each section
  - Final responsive testing
  - Performance check (bundle size, load time)

  **Must NOT do**:
  - Do NOT add new features at this stage
  - Do NOT refactor working components

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 5 (final)
  - **Blocks**: None (end)
  - **Blocked By**: All previous tasks

  **References**:
  - All components created in previous tasks
  - `docs/UI_RULES_OF_THUMB.md` - Final validation

  **Acceptance Criteria**:
  - [ ] All sections render on editor profile page
  - [ ] Loading skeletons for each section
  - [ ] No console errors
  - [ ] Lighthouse performance score > 80
  - [ ] All tests pass: `bun --bun run test`
  - [ ] E2E Playwright verification passes

  **Agent-Executed QA Scenarios**:

  ```
  Scenario: Full editor profile loads correctly
    Tool: Playwright
    Steps:
      1. Navigate to: http://localhost:3000/editors/{test-id}
      2. Wait for page fully loaded (no loading indicators)
      3. Assert: Stats cards section visible
      4. Assert: Charts section visible
      5. Assert: Achievement badges visible
      6. Assert: Commons gallery visible
      7. Assert: Articles table visible
      8. Assert: No console errors
      9. Screenshot: .sisyphus/evidence/task-16-full-page.png
    Expected Result: Complete page with all sections
    Evidence: .sisyphus/evidence/task-16-full-page.png

  Scenario: Editor profile on mobile
    Tool: Playwright
    Steps:
      1. Set viewport to iPhone 12 (390x844)
      2. Navigate to editor profile
      3. Assert: All sections visible (may need scroll)
      4. Assert: Tabbed charts work
      5. Assert: Table is horizontally scrollable
      6. Screenshot: .sisyphus/evidence/task-16-mobile.png
    Expected Result: Mobile-friendly layout
    Evidence: .sisyphus/evidence/task-16-mobile.png
  ```

  **Commit**: YES
  - Message: `feat(web): integrate all editor profile components`
  - Files: `apps/web/src/routes/editors.$editorId.tsx`

---

## Commit Strategy

| After Task | Message                                             | Files                    | Verification |
| ---------- | --------------------------------------------------- | ------------------------ | ------------ |
| 0          | `feat(web): add test infrastructure`                | test-utils.tsx           | bun run test |
| 1-3        | `feat(api): add editor stats endpoints`             | editors.ts               | curl tests   |
| 4-7        | `feat(web): add chart components`                   | components/editor/\*.tsx | bun run test |
| 8-11       | `feat(web): add feature components`                 | components/editor/\*.tsx | bun run test |
| 12-15      | `feat(web): add export, share, compare, responsive` | various                  | bun run test |
| 16         | `feat(web): integrate editor profile overhaul`      | editors.$editorId.tsx    | E2E test     |

---

## Success Criteria

### Verification Commands

```bash
# Run all tests
cd apps/web && bun --bun run test

# Start dev servers
moon run :dev

# Playwright E2E (if configured)
cd apps/web && bun run test:e2e
```

### Final Checklist

- [ ] All "Must Have" features present
- [ ] All "Must NOT Have" constraints respected
- [ ] All 17 tasks completed
- [ ] All tests pass
- [ ] Mobile responsive works
- [ ] No console errors in browser
- [ ] All charts render with data
- [ ] Export generates valid CSV
- [ ] Compare page works with 2 editors
