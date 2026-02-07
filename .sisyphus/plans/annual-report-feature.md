# Annual Report Generation Feature

## TL;DR

> **Quick Summary**: Add annual report generation capabilities to the history feature, enabling users to generate PDF/CSV/JSON reports matching the format of existing OKA Annual Reports (2023-2025). This includes yearly aggregation, YoY comparisons, top articles ranking, and export functionality.
>
> **Deliverables**:
>
> - Annual aggregation API endpoints (`/api/stats/annual`)
> - YoY comparison calculation methods
> - Top articles ranking API
> - PDF/CSV/JSON export endpoints
> - Report generation UI in history page
>
> **Estimated Effort**: Large (10-15 tasks)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 6 → Task 8

---

## Context

### Original Request

User requested to study the existing annual report PDFs in `docs/reports/` and adjust the history feature to support generating similar reports. The system should accommodate annual report generation with supporting features as needed.

### Interview Summary

**Key Discussions**:

- PDF reports contain: Key Figures tables (articles/pageviews by wiki/year), Most Viewed Articles (Top 10), YoY growth metrics
- Current history has daily snapshots via DailyStat tables but no annual aggregation
- Reports use "annualized pageviews" based on last month views multiplied by 12
- Financial statements are out of scope (manual input)

**Research Findings**:

- Database has DailyStat, DailyWikiStat, EditorDailyStat, ArticleDailyStat tables
- StatsService has getDailyHistory(), recordDailySnapshot() methods
- No existing export or PDF generation functionality in codebase
- HistoryPage component exists with date/wiki/source filters
- Project uses Bun runtime, Hono for API, React with TanStack for frontend

### Metis Review

**Identified Gaps** (addressed):

- "Annualized pageviews" methodology → Default: `(last_30_days_views * 12)`
- Report year definition → Default: Calendar year (Jan 1 - Dec 31 UTC)
- Wiki grouping → Default: Use explicit wikiProject names, no auto-grouping
- Charts in PDF → Default: Tables only in v1 (charts out of scope)
- PDF library selection → Default: Puppeteer for HTML→PDF (verified works with Bun)
- Report storage → Default: On-demand generation, no persistence

---

## Work Objectives

### Core Objective

Enable history page to generate annual reports matching the format and metrics of existing OKA Annual Reports (PDF examples), with export to PDF, CSV, and JSON formats.

### Concrete Deliverables

- `apps/api/src/services/stats.service.ts` - New methods: `getAnnualStats()`, `getTopArticlesByYear()`, `calculateYoY()`
- `apps/api/src/routes/stats.ts` - New endpoints: `/annual`, `/annual/export`, `/top-articles`
- `apps/api/src/schemas/stats.schema.ts` - New Zod schemas for annual report params
- `apps/api/src/services/report-export.service.ts` - PDF/CSV/JSON generation
- `apps/web/src/components/history/annual-report-section.tsx` - Report generation UI
- `apps/web/src/lib/api.ts` - New API functions for annual stats/export

### Definition of Done

- [x] `curl /api/stats/annual?year=2024` returns aggregated stats by wiki project
- [x] `curl /api/stats/annual?year=2024&includeYoY=true` returns YoY comparison percentages
- [x] `curl /api/stats/top-articles?year=2024&limit=10` returns top 10 articles by pageviews
- [x] `curl /api/stats/annual/export?year=2024&format=pdf` downloads valid PDF file
- [x] History page shows "Generate Report" section with year selection and export buttons
- [x] All tests pass: `bun test`

### Must Have

- Annual aggregation of DailyStat data by year and wiki project
- YoY comparison calculations (current vs previous year)
- Top articles ranking by pageviews
- Export to PDF matching OKA report format (tables-only)
- Export to CSV and JSON
- Year selection UI in history page

### Must NOT Have (Guardrails)

- NO AI/LLM generated narrative summaries
- NO charts/graphs in PDF (tables only for v1)
- NO email scheduling or report caching
- NO new database tables (use computed aggregation from DailyStat)
- NO financial statement automation
- NO custom report templates
- NO pixel-perfect PDF replication (format match is sufficient)
- DO NOT modify existing `getDailyHistory()` behavior
- DO NOT create separate `/api/reports/` namespace (extend existing `/api/stats/`)

---

## Verification Strategy

> **UNIVERSAL RULE: ZERO HUMAN INTERVENTION**
>
> ALL tasks MUST be verifiable WITHOUT any human action.
> Verification is executed by the agent using tools (curl, Playwright, Bash).

### Test Decision

- **Infrastructure exists**: YES (vitest for web, API tests)
- **Automated tests**: YES (Tests-after approach)
- **Framework**: vitest + Playwright for E2E

### Agent-Executed QA Scenarios (MANDATORY — ALL tasks)

Each task will include specific QA scenarios using:

- **API endpoints**: Bash with curl + jq for assertions
- **Frontend/UI**: Playwright for browser interactions
- **File validation**: Bash with `file` command for PDF validation

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add annual aggregation methods to StatsService
├── Task 2: Add Zod schemas for annual report endpoints
└── Task 5: Create report export service skeleton

Wave 2 (After Wave 1):
├── Task 3: Add annual stats API endpoint [depends: 1, 2]
├── Task 4: Add top articles API endpoint [depends: 1, 2]
└── Task 6: Implement PDF export [depends: 5]

Wave 3 (After Wave 2):
├── Task 7: Implement CSV/JSON export [depends: 5]
├── Task 8: Add frontend API functions [depends: 3, 4, 6]
└── Task 9: Add report generation UI [depends: 8]

Wave 4 (Final):
└── Task 10: Integration tests and documentation [depends: 9]

Critical Path: Task 1 → Task 3 → Task 6 → Task 8 → Task 9
Parallel Speedup: ~50% faster than sequential
```

### Dependency Matrix

| Task | Depends On | Blocks  | Can Parallelize With |
| ---- | ---------- | ------- | -------------------- |
| 1    | None       | 3, 4    | 2, 5                 |
| 2    | None       | 3, 4, 6 | 1, 5                 |
| 3    | 1, 2       | 8       | 4, 6                 |
| 4    | 1, 2       | 8       | 3, 6                 |
| 5    | None       | 6, 7    | 1, 2                 |
| 6    | 2, 5       | 8       | 3, 4                 |
| 7    | 5          | 8       | 3, 4, 6              |
| 8    | 3, 4, 6, 7 | 9       | None                 |
| 9    | 8          | 10      | None                 |
| 10   | 9          | None    | None                 |

---

## TODOs

- [x] 1. Add annual aggregation methods to StatsService

  **What to do**:
  - Add `getAnnualStats(year: number, filters?: { wikiProject?: string; source?: ArticleSource })` method
  - Add `calculateYoY(currentYear: number, metric: string)` method
  - Aggregate DailyStat/DailyWikiStat data by summing across date range (Jan 1 - Dec 31 UTC)
  - Return structure: `{ byWikiProject: WikiProjectAnnualStats[], totals: AnnualStats, yoy?: YoYComparison }`

  **Must NOT do**:
  - DO NOT create new database tables
  - DO NOT modify existing methods

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Backend service logic requiring database query optimization
  - **Skills**: [`git-master`]
    - `git-master`: For atomic commits

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 5)
  - **Blocks**: Tasks 3, 4
  - **Blocked By**: None

  **References**:
  - `apps/api/src/services/stats.service.ts:78-152` - Existing getDailyHistory() pattern to follow
  - `apps/api/src/services/stats.service.ts:738-763` - getOverallStats() aggregation pattern
  - `packages/db/prisma/schema.prisma:309-330` - DailyStat model structure
  - `packages/db/prisma/schema.prisma:332-355` - DailyWikiStat model for per-wiki aggregation

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Annual stats aggregation returns correct structure
    Tool: Bash (curl + jq)
    Preconditions: API server running on localhost:3000, daily stats exist for 2024
    Steps:
      1. Start API: cd apps/api && bun run dev &
      2. Wait 3 seconds for server startup
      3. curl -s "http://localhost:3000/api/stats/annual?year=2024" | jq '.success'
      4. Assert: response equals true
      5. curl -s "http://localhost:3000/api/stats/annual?year=2024" | jq '.data.byWikiProject | type'
      6. Assert: response equals "array"
      7. curl -s "http://localhost:3000/api/stats/annual?year=2024" | jq '.data.totals | keys'
      8. Assert: contains "articlesCreated", "pageviews", "wordsAdded", "commonsUploads"
    Expected Result: API returns structured annual stats with byWikiProject array and totals object
    Evidence: Response body captured to .sisyphus/evidence/task-1-annual-stats.json

  Scenario: YoY calculation returns percentage changes
    Tool: Bash (curl + jq)
    Preconditions: API server running, data exists for 2023 and 2024
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual?year=2024&includeYoY=true" | jq '.data.yoy'
      2. Assert: response is not null
      3. curl -s "http://localhost:3000/api/stats/annual?year=2024&includeYoY=true" | jq '.data.yoy.articlesCreated | has("changePercent")'
      4. Assert: response equals true
    Expected Result: YoY comparison includes previous, current, and changePercent
    Evidence: Response captured

  Scenario: No data year returns empty results (not error)
    Tool: Bash (curl + jq)
    Preconditions: API server running, no data for 2020
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual?year=2020" | jq '.success'
      2. Assert: response equals true
      3. curl -s "http://localhost:3000/api/stats/annual?year=2020" | jq '.data.byWikiProject | length'
      4. Assert: response equals 0
    Expected Result: Empty data, not error status
    Evidence: Response captured
  ```

  **Evidence to Capture:**
  - [ ] API response JSON saved to .sisyphus/evidence/task-1-annual-stats.json
  - [ ] YoY response saved to .sisyphus/evidence/task-1-yoy.json

  **Commit**: YES
  - Message: `feat(api): add annual stats aggregation methods to StatsService`
  - Files: `apps/api/src/services/stats.service.ts`
  - Pre-commit: `bun test`

---

- [x] 2. Add Zod schemas for annual report endpoints

  **What to do**:
  - Add `AnnualStatsQuerySchema` with fields: `year` (required), `wikiProject?`, `source?`, `includeYoY?`
  - Add `TopArticlesQuerySchema` with fields: `year`, `wikiProject?`, `limit?` (default 10, max 100)
  - Add `ReportExportQuerySchema` with fields: `year`, `format` (enum: pdf, csv, json), `wikiProject?`
  - Add response type schemas for TypeScript inference

  **Must NOT do**:
  - DO NOT modify existing schemas

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple schema definitions following existing patterns
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 5)
  - **Blocks**: Tasks 3, 4, 6
  - **Blocked By**: None

  **References**:
  - `apps/api/src/schemas/stats.schema.ts:1-50` - Existing schema patterns (HistoryRangeSchema, etc.)
  - `apps/api/src/schemas/index.ts` - Export pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Schema validates year parameter correctly
    Tool: Bash (bun test)
    Preconditions: Schema file created
    Steps:
      1. cd apps/api
      2. Create test file that imports AnnualStatsQuerySchema
      3. Test: schema.parse({ year: 2024 }) should succeed
      4. Test: schema.parse({}) should throw (year required)
      5. Test: schema.parse({ year: "invalid" }) should throw
      6. bun test src/schemas/stats.schema.test.ts
    Expected Result: All validation tests pass
    Evidence: Test output captured

  Scenario: TopArticlesQuerySchema has correct defaults
    Tool: Bash (bun repl)
    Preconditions: Schema file exists
    Steps:
      1. bun --eval "import { TopArticlesQuerySchema } from './apps/api/src/schemas/stats.schema'; console.log(TopArticlesQuerySchema.parse({ year: 2024 }))"
      2. Assert: output includes limit: 10
    Expected Result: Default limit is 10
    Evidence: Console output captured
  ```

  **Evidence to Capture:**
  - [ ] Schema test output saved

  **Commit**: YES
  - Message: `feat(api): add Zod schemas for annual report endpoints`
  - Files: `apps/api/src/schemas/stats.schema.ts`, `apps/api/src/schemas/index.ts`
  - Pre-commit: `bun test`

---

- [x] 3. Add annual stats API endpoint

  **What to do**:
  - Add `GET /api/stats/annual` endpoint to stats routes
  - Parse query params with `AnnualStatsQuerySchema`
  - Call `statsService.getAnnualStats()` method
  - Return structured response with `byWikiProject`, `totals`, optional `yoy`

  **Must NOT do**:
  - DO NOT create separate route file
  - DO NOT add authentication (reports are public read)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Following existing route patterns exactly
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `apps/api/src/routes/stats.ts:121-144` - GET /history endpoint pattern to follow
  - `apps/api/src/routes/stats.ts:58-77` - GET /overall endpoint pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Annual endpoint returns valid response
    Tool: Bash (curl + jq)
    Preconditions: API server running on localhost:3000
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual?year=2024" -w "\n%{http_code}"
      2. Assert: HTTP status is 200
      3. curl -s "http://localhost:3000/api/stats/annual?year=2024" | jq '.success'
      4. Assert: equals true
    Expected Result: 200 OK with success: true
    Evidence: Response saved to .sisyphus/evidence/task-3-annual-endpoint.json

  Scenario: Invalid year returns 400
    Tool: Bash (curl)
    Preconditions: API server running
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual?year=invalid" -w "\n%{http_code}" | tail -1
      2. Assert: HTTP status is 400
    Expected Result: 400 Bad Request for invalid year
    Evidence: Error response captured

  Scenario: Future year returns 400
    Tool: Bash (curl)
    Preconditions: API server running
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual?year=2099" -w "\n%{http_code}" | tail -1
      2. Assert: HTTP status is 400
    Expected Result: Reject unreasonable future years
    Evidence: Response captured
  ```

  **Commit**: YES
  - Message: `feat(api): add GET /api/stats/annual endpoint`
  - Files: `apps/api/src/routes/stats.ts`
  - Pre-commit: `bun test`

---

- [x] 4. Add top articles API endpoint

  **What to do**:
  - Add `GET /api/stats/top-articles` endpoint
  - Query ArticleDailyStat or Pageview tables, aggregate by year, order by pageviews DESC
  - Support filtering by wikiProject
  - Limit results (default 10, max 100)
  - Return: `{ articles: [{ rank, title, wikiProject, totalPageviews, articleId }] }`

  **Must NOT do**:
  - DO NOT include articles with 0 pageviews

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: Standard database query with ordering
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 1, 2

  **References**:
  - `packages/db/prisma/schema.prisma:459-478` - ArticleDailyStat model
  - `packages/db/prisma/schema.prisma:174-204` - Pageview model
  - `apps/api/src/services/stats.service.ts:833-924` - getStatsByEditor() aggregation pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Top articles returns ranked list
    Tool: Bash (curl + jq)
    Preconditions: API server running, pageview data exists
    Steps:
      1. curl -s "http://localhost:3000/api/stats/top-articles?year=2024" | jq '.data.articles | length'
      2. Assert: length > 0 and <= 10
      3. curl -s "http://localhost:3000/api/stats/top-articles?year=2024" | jq '.data.articles[0] | has("rank", "title", "totalPageviews")'
      4. Assert: equals true
      5. curl -s "http://localhost:3000/api/stats/top-articles?year=2024" | jq '.data.articles | sort_by(.totalPageviews) | reverse | .[0].rank'
      6. Assert: equals 1 (highest views = rank 1)
    Expected Result: Articles sorted by pageviews descending with correct ranking
    Evidence: Response saved to .sisyphus/evidence/task-4-top-articles.json

  Scenario: Limit parameter works
    Tool: Bash (curl + jq)
    Preconditions: API server running
    Steps:
      1. curl -s "http://localhost:3000/api/stats/top-articles?year=2024&limit=5" | jq '.data.articles | length'
      2. Assert: length <= 5
    Expected Result: Respects limit parameter
    Evidence: Response captured
  ```

  **Commit**: YES
  - Message: `feat(api): add GET /api/stats/top-articles endpoint`
  - Files: `apps/api/src/routes/stats.ts`, `apps/api/src/services/stats.service.ts`
  - Pre-commit: `bun test`

---

- [x] 5. Create report export service skeleton

  **What to do**:
  - Create `apps/api/src/services/report-export.service.ts`
  - Define interface: `ReportExportService.exportPDF()`, `exportCSV()`, `exportJSON()`
  - Add type definitions for report data structure
  - Install Puppeteer: `bun add puppeteer`
  - Create HTML template file for PDF: `apps/api/src/templates/annual-report.html`

  **Must NOT do**:
  - DO NOT implement full PDF generation yet (just skeleton)
  - DO NOT add to service index exports until implementation complete

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Skeleton/interface definitions only
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 6, 7
  - **Blocked By**: None

  **References**:
  - `apps/api/src/services/stats.service.ts:1-20` - Service class pattern
  - `apps/api/src/services/index.ts` - Service exports

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Service file created with correct exports
    Tool: Bash (bun)
    Preconditions: None
    Steps:
      1. test -f apps/api/src/services/report-export.service.ts
      2. Assert: file exists
      3. grep -q "exportPDF" apps/api/src/services/report-export.service.ts
      4. Assert: exit code 0
      5. grep -q "exportCSV" apps/api/src/services/report-export.service.ts
      6. Assert: exit code 0
    Expected Result: Service file exists with method signatures
    Evidence: File content captured

  Scenario: Puppeteer installed
    Tool: Bash
    Preconditions: None
    Steps:
      1. grep -q "puppeteer" apps/api/package.json
      2. Assert: exit code 0
    Expected Result: Puppeteer in dependencies
    Evidence: package.json snippet captured
  ```

  **Commit**: YES
  - Message: `feat(api): add report export service skeleton and puppeteer dependency`
  - Files: `apps/api/src/services/report-export.service.ts`, `apps/api/package.json`, `apps/api/src/templates/annual-report.html`
  - Pre-commit: `bun install`

---

- [x] 6. Implement PDF export

  **What to do**:
  - Implement `ReportExportService.exportPDF(data: AnnualReportData): Promise<Buffer>`
  - Create HTML template matching OKA report format (tables for Key Figures, Top Articles)
  - Use Puppeteer to render HTML to PDF
  - Add `GET /api/stats/annual/export?format=pdf&year=2024` endpoint
  - Set correct Content-Type and Content-Disposition headers for download

  **Must NOT do**:
  - NO charts/graphs (tables only)
  - NO external font loading (use system fonts)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex integration with Puppeteer, HTML templating
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 3, 4)
  - **Blocks**: Task 8
  - **Blocked By**: Tasks 2, 5

  **References**:
  - `apps/api/src/services/report-export.service.ts` - Skeleton from Task 5
  - `apps/api/src/templates/annual-report.html` - Template from Task 5
  - Context7/Librarian: Puppeteer PDF generation API

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: PDF export returns valid PDF file
    Tool: Bash (curl + file command)
    Preconditions: API server running, data exists for 2024
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual/export?year=2024&format=pdf" -o /tmp/test-report.pdf
      2. file /tmp/test-report.pdf
      3. Assert: output contains "PDF document"
      4. ls -la /tmp/test-report.pdf
      5. Assert: file size > 1000 bytes
    Expected Result: Valid PDF file downloaded
    Evidence: File saved to .sisyphus/evidence/task-6-report.pdf

  Scenario: PDF contains expected content
    Tool: Bash (pdftotext)
    Preconditions: PDF generated
    Steps:
      1. pdftotext /tmp/test-report.pdf - | head -20
      2. Assert: contains "Annual Report" or "OKA"
      3. pdftotext /tmp/test-report.pdf - | grep -i "articles"
      4. Assert: exit code 0
    Expected Result: PDF contains report content
    Evidence: Text extraction captured

  Scenario: PDF endpoint sets correct headers
    Tool: Bash (curl -I)
    Preconditions: API server running
    Steps:
      1. curl -sI "http://localhost:3000/api/stats/annual/export?year=2024&format=pdf"
      2. Assert: Content-Type contains "application/pdf"
      3. Assert: Content-Disposition contains "attachment"
    Expected Result: Correct download headers
    Evidence: Headers captured
  ```

  **Commit**: YES
  - Message: `feat(api): implement PDF export for annual reports`
  - Files: `apps/api/src/services/report-export.service.ts`, `apps/api/src/routes/stats.ts`, `apps/api/src/templates/annual-report.html`
  - Pre-commit: `bun test`

---

- [x] 7. Implement CSV/JSON export

  **What to do**:
  - Implement `ReportExportService.exportCSV(data): Promise<string>` - flatten data to CSV rows
  - Implement `ReportExportService.exportJSON(data): Promise<string>` - structured JSON with metadata
  - Handle special characters in CSV (quotes, commas in article titles)
  - Add format routing in export endpoint (switch on format param)

  **Must NOT do**:
  - NO Excel (.xlsx) format

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard data transformation
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (can run with 3, 4, 6)
  - **Blocks**: Task 8
  - **Blocked By**: Task 5

  **References**:
  - `apps/api/src/services/report-export.service.ts` - Add to existing service

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: CSV export returns valid CSV
    Tool: Bash (curl)
    Preconditions: API server running
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual/export?year=2024&format=csv" | head -1
      2. Assert: first line is header row with commas
      3. curl -s "http://localhost:3000/api/stats/annual/export?year=2024&format=csv" | wc -l
      4. Assert: more than 1 line (header + data)
    Expected Result: Valid CSV with headers
    Evidence: CSV content saved

  Scenario: JSON export returns structured data
    Tool: Bash (curl + jq)
    Preconditions: API server running
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual/export?year=2024&format=json" | jq '.metadata.year'
      2. Assert: equals 2024
      3. curl -s "http://localhost:3000/api/stats/annual/export?year=2024&format=json" | jq '.metadata.generatedAt'
      4. Assert: is valid ISO date string
    Expected Result: JSON with metadata
    Evidence: JSON saved

  Scenario: CSV handles special characters
    Tool: Bash
    Preconditions: Article with comma or quote in title exists
    Steps:
      1. curl -s "http://localhost:3000/api/stats/annual/export?year=2024&format=csv" > /tmp/test.csv
      2. python3 -c "import csv; list(csv.reader(open('/tmp/test.csv')))"
      3. Assert: no parse errors
    Expected Result: Valid CSV escaping
    Evidence: Parse result captured
  ```

  **Commit**: YES
  - Message: `feat(api): implement CSV and JSON export for annual reports`
  - Files: `apps/api/src/services/report-export.service.ts`, `apps/api/src/routes/stats.ts`
  - Pre-commit: `bun test`

---

- [x] 8. Add frontend API functions

  **What to do**:
  - Add `fetchAnnualStats(params: { year: number; wikiProject?: string; includeYoY?: boolean })` to api.ts
  - Add `fetchTopArticles(params: { year: number; wikiProject?: string; limit?: number })` to api.ts
  - Add `downloadAnnualReport(params: { year: number; format: 'pdf' | 'csv' | 'json' })` function
  - Add TypeScript types for annual stats response

  **Must NOT do**:
  - DO NOT modify existing API functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Following existing apiFetch patterns
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Wave 2)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 3, 4, 6, 7

  **References**:
  - `apps/web/src/lib/api.ts:291-340` - fetchStatsHistory, fetchEditorHistory patterns

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: API types compile without errors
    Tool: Bash (tsc)
    Preconditions: Types added
    Steps:
      1. cd apps/web && bunx tsc --noEmit
      2. Assert: exit code 0
    Expected Result: No TypeScript errors
    Evidence: tsc output captured

  Scenario: Functions exported correctly
    Tool: Bash (grep)
    Preconditions: Functions added
    Steps:
      1. grep -q "fetchAnnualStats" apps/web/src/lib/api.ts
      2. Assert: exit code 0
      3. grep -q "fetchTopArticles" apps/web/src/lib/api.ts
      4. Assert: exit code 0
      5. grep -q "downloadAnnualReport" apps/web/src/lib/api.ts
      6. Assert: exit code 0
    Expected Result: All functions exist
    Evidence: Grep results
  ```

  **Commit**: YES
  - Message: `feat(web): add frontend API functions for annual reports`
  - Files: `apps/web/src/lib/api.ts`
  - Pre-commit: `bun test`

---

- [x] 9. Add report generation UI

  **What to do**:
  - Create `apps/web/src/components/history/annual-report-section.tsx`
  - Add year selection dropdown (current year and 3 previous)
  - Add wiki project multi-select (optional filter)
  - Add "Generate Report" button with format dropdown (PDF, CSV, JSON)
  - Show loading state during generation
  - Handle download trigger for PDF/CSV
  - Display JSON inline in expandable section
  - Import and render in `apps/web/src/components/history/history-page.tsx`

  **Must NOT do**:
  - NO new route page (extend existing history page)
  - NO report preview before download (direct download)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component with interactions
  - **Skills**: [`frontend-ui-ux`, `git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 10
  - **Blocked By**: Task 8

  **References**:
  - `apps/web/src/components/history/history-page.tsx:130-166` - Filter UI patterns
  - `apps/web/src/components/ui/select.tsx` - Select component
  - `apps/web/src/components/ui/button.tsx` - Button component
  - `apps/web/src/components/ui/dropdown-menu.tsx` - Dropdown pattern

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Report section visible on history page
    Tool: Playwright
    Preconditions: Dev server running on localhost:3000
    Steps:
      1. Navigate to: http://localhost:3000/admin/history
      2. Wait for: page load complete (timeout: 10s)
      3. Assert: element with text "Annual Report" or "Generate Report" visible
      4. Screenshot: .sisyphus/evidence/task-9-report-section.png
    Expected Result: Report section renders on page
    Evidence: .sisyphus/evidence/task-9-report-section.png

  Scenario: Year selector works
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:3000/admin/history
      2. Click: year selector dropdown
      3. Assert: dropdown shows current year and previous years
      4. Select: previous year
      5. Assert: selection updates
      6. Screenshot: .sisyphus/evidence/task-9-year-selector.png
    Expected Result: Year selection functional
    Evidence: Screenshot saved

  Scenario: PDF download triggers
    Tool: Playwright
    Preconditions: Dev server running, API functional
    Steps:
      1. Navigate to: http://localhost:3000/admin/history
      2. Select year: 2024
      3. Click: Generate Report button
      4. Select: PDF format
      5. Wait for: download to start (timeout: 30s)
      6. Assert: downloaded file is PDF
    Expected Result: PDF downloads successfully
    Evidence: Download event captured

  Scenario: Loading state shown during generation
    Tool: Playwright
    Preconditions: Dev server running
    Steps:
      1. Navigate to: http://localhost:3000/admin/history
      2. Click: Generate Report
      3. Assert: loading spinner or "Generating..." text visible
      4. Screenshot: .sisyphus/evidence/task-9-loading-state.png
    Expected Result: Loading feedback shown
    Evidence: Screenshot saved
  ```

  **Commit**: YES
  - Message: `feat(web): add annual report generation UI to history page`
  - Files: `apps/web/src/components/history/annual-report-section.tsx`, `apps/web/src/components/history/history-page.tsx`
  - Pre-commit: `bun test`

---

- [x] 10. Integration tests and documentation

  **What to do**:
  - Add integration test file: `apps/api/src/__tests__/annual-report.test.ts`
  - Test: annual stats endpoint with various years
  - Test: top articles endpoint with filters
  - Test: export endpoints produce valid files
  - Update README with report generation feature documentation
  - Add JSDoc comments to new service methods

  **Must NOT do**:
  - NO Playwright E2E tests (already covered in Task 9)

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation and test writing
  - **Skills**: [`git-master`]

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final (after Task 9)
  - **Blocks**: None
  - **Blocked By**: Task 9

  **References**:
  - `apps/api/src/__tests__/api.test.ts` - Existing test patterns

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: All tests pass
    Tool: Bash
    Preconditions: All code complete
    Steps:
      1. cd apps/api && bun test
      2. Assert: exit code 0
      3. cd apps/web && bun test
      4. Assert: exit code 0
    Expected Result: All tests pass
    Evidence: Test output captured

  Scenario: Documentation updated
    Tool: Bash (grep)
    Preconditions: README updated
    Steps:
      1. grep -i "annual report" README.md
      2. Assert: exit code 0
      3. grep -i "export" README.md
      4. Assert: mentions PDF/CSV export
    Expected Result: README documents new feature
    Evidence: README section captured
  ```

  **Commit**: YES
  - Message: `test(api): add integration tests for annual report feature`
  - Files: `apps/api/src/__tests__/annual-report.test.ts`, `README.md`
  - Pre-commit: `bun test`

---

## Commit Strategy

| After Task | Message                                                           | Files                                        | Verification |
| ---------- | ----------------------------------------------------------------- | -------------------------------------------- | ------------ |
| 1          | `feat(api): add annual stats aggregation methods to StatsService` | stats.service.ts                             | bun test     |
| 2          | `feat(api): add Zod schemas for annual report endpoints`          | stats.schema.ts                              | bun test     |
| 3          | `feat(api): add GET /api/stats/annual endpoint`                   | stats.ts                                     | bun test     |
| 4          | `feat(api): add GET /api/stats/top-articles endpoint`             | stats.ts, stats.service.ts                   | bun test     |
| 5          | `feat(api): add report export service skeleton`                   | report-export.service.ts                     | bun install  |
| 6          | `feat(api): implement PDF export for annual reports`              | report-export.service.ts, stats.ts, template | bun test     |
| 7          | `feat(api): implement CSV and JSON export`                        | report-export.service.ts, stats.ts           | bun test     |
| 8          | `feat(web): add frontend API functions for annual reports`        | api.ts                                       | bun test     |
| 9          | `feat(web): add annual report generation UI`                      | annual-report-section.tsx, history-page.tsx  | bun test     |
| 10         | `test(api): add integration tests for annual report feature`      | annual-report.test.ts, README.md             | bun test     |

---

## Success Criteria

### Verification Commands

```bash
# Test annual stats endpoint
curl -s "http://localhost:3000/api/stats/annual?year=2024" | jq '.success'
# Expected: true

# Test YoY comparison
curl -s "http://localhost:3000/api/stats/annual?year=2024&includeYoY=true" | jq '.data.yoy'
# Expected: { articlesCreated: { current, previous, changePercent }, ... }

# Test top articles
curl -s "http://localhost:3000/api/stats/top-articles?year=2024&limit=10" | jq '.data.articles | length'
# Expected: 10 or less

# Test PDF export
curl -s "http://localhost:3000/api/stats/annual/export?year=2024&format=pdf" -o /tmp/report.pdf && file /tmp/report.pdf
# Expected: PDF document

# Test CSV export
curl -s "http://localhost:3000/api/stats/annual/export?year=2024&format=csv" | head -1
# Expected: CSV header row

# All tests pass
bun test
# Expected: All tests pass
```

### Final Checklist

- [x] All "Must Have" features present and working
- [x] All "Must NOT Have" guardrails respected
- [x] All 10 tasks completed with commits
- [x] All API endpoints return valid responses
- [x] PDF export produces valid PDF files
- [x] UI integrated into history page
- [x] Tests pass for both apps/api and apps/web
