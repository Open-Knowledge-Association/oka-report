# Monthly Report Generation Feature

## TL;DR

> **Quick Summary**: Add monthly report generation capabilities to complement the annual report feature, enabling users to generate PDF/CSV/JSON reports for specific months. Follows the same patterns and architecture as the completed annual report feature.
>
> **Deliverables**:
>
> - Monthly aggregation API endpoints (`/api/stats/monthly`)
> - Month-over-month comparison calculations
> - Top articles ranking for specific month
> - PDF/CSV/JSON export endpoints for monthly reports
> - Month selection UI integrated into history page
>
> **Estimated Effort**: Medium (8-10 tasks)
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 7

---

## Context

### Annual Report Feature (Completed)

The annual report feature provides:

- `GET /api/stats/annual` - Annual statistics aggregation
- `GET /api/stats/top-articles` - Top articles by year
- `GET /api/stats/annual/export` - Export reports (PDF/CSV/JSON)
- `AnnualReportSection` UI component with year selection

### Monthly Report Requirements

Users need the ability to generate reports for specific months to:

- Track monthly progress and performance
- Compare month-over-month growth
- Generate reports for specific campaigns or periods
- Analyze seasonal trends

### Technical Foundation

- **Database**: DailyStat, DailyWikiStat, ArticleDailyStat tables with daily granularity
- **Service Layer**: StatsService with aggregation methods
- **Export**: ReportExportService with PDF/CSV/JSON capabilities
- **Frontend**: React with shadcn/ui components

---

## Work Objectives

### Core Objective

Enable users to generate monthly reports matching the format of annual reports, with month-level granularity and month-over-month comparisons.

### Concrete Deliverables

- `apps/api/src/services/stats.service.ts` - New method: `getMonthlyStats()`
- `apps/api/src/routes/stats.ts` - New endpoints: `/monthly`, `/monthly/export`
- `apps/api/src/schemas/stats.schema.ts` - New schemas: `MonthlyStatsQuerySchema`
- `apps/web/src/lib/api.ts` - New functions: `fetchMonthlyStats()`, `downloadMonthlyReport()`
- `apps/web/src/components/history/monthly-report-section.tsx` - Month selection UI
- `apps/api/src/__tests__/monthly-report.test.ts` - Integration tests
- `README.md` - API documentation updates

### Definition of Done

- [x] `curl /api/stats/monthly?year=2024&month=1` returns aggregated stats for January 2024
- [x] `curl /api/stats/monthly?year=2024&month=1&includeMoM=true` returns month-over-month comparison
- [x] `curl /api/stats/monthly/export?year=2024&month=1&format=pdf` downloads valid PDF file
- [x] History page shows month selection alongside year selection
- [x] All tests pass: `bun test`

### Must Have

- Monthly aggregation of DailyStat data by year and month
- Month-over-month (MoM) comparison calculations
- Top articles ranking by pageviews for specific month
- Export to PDF, CSV, and JSON formats
- Month selection UI (1-12 dropdown)

### Must NOT Have (Guardrails)

- NO new database tables (use computed aggregation from DailyStat)
- NO charts/graphs in PDF (tables only for v1)
- NO AI/LLM generated narrative summaries
- DO NOT modify existing annual report functionality
- DO NOT create separate `/api/reports/` namespace (extend existing `/api/stats/`)

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately):
├── Task 1: Add monthly aggregation method to StatsService
├── Task 2: Add Zod schemas for monthly report endpoints
└── Task 3: Create frontend API functions

Wave 2 (After Wave 1):
├── Task 4: Add monthly stats API endpoint [depends: 1, 2]
├── Task 5: Add monthly export endpoint [depends: 1, 2]
└── Task 6: Reuse and extend ReportExportService for monthly data

Wave 3 (After Wave 2):
├── Task 7: Add monthly report UI component [depends: 3, 5]
└── Task 8: Integrate into history page [depends: 7]

Wave 4 (Final):
└── Task 9: Integration tests and documentation [depends: 8]

Critical Path: Task 1 → Task 4 → Task 5 → Task 7 → Task 8
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
| ---- | ---------- | ------ | -------------------- |
| 1    | None       | 4, 5   | 2, 3                 |
| 2    | None       | 4, 5   | 1, 3                 |
| 3    | None       | 7      | 1, 2                 |
| 4    | 1, 2       | 5      | None                 |
| 5    | 1, 2       | 7      | 4                    |
| 6    | None       | 5      | 4                    |
| 7    | 3, 5       | 8      | None                 |
| 8    | 7          | 9      | None                 |
| 9    | 8          | None   | None                 |

---

## TODOs

- [x] 1. Add monthly aggregation method to StatsService

  **What to do**:
  - Add `getMonthlyStats(year: number, month: number, filters?: { wikiProject?: string; source?: ArticleSource })` method
  - Calculate date range: first day of month to last day of month (e.g., Jan 2024 = Jan 1-31, 2024)
  - Aggregate DailyStat/DailyWikiStat data by summing across the date range
  - Return structure: `{ byWikiProject: WikiProjectMonthlyStats[], totals: MonthlyStats }`
  - Follow the exact same pattern as `getAnnualStats()` but for a single month

  **Must NOT do**:
  - DO NOT create new database tables
  - DO NOT modify existing getAnnualStats method

  **References**:
  - `apps/api/src/services/stats.service.ts:1314-1417` - getAnnualStats() pattern to follow
  - `apps/api/src/services/stats.service.ts:1419-1467` - calculateYoY() pattern for MoM

  **Acceptance Criteria**:
  - Method accepts year (number) and month (1-12) parameters
  - Returns aggregated stats for the specified month
  - Supports optional wikiProject and source filters
  - Uses existing DailyStat/DailyWikiStat tables

  **Commit**: `feat(api): add monthly stats aggregation method to StatsService` ✅

---

- [x] 2. Add Zod schemas for monthly report endpoints

  **What to do**:
  - Add `MonthlyStatsQuerySchema` with fields: `year` (required), `month` (required, 1-12), `wikiProject?`, `source?`, `includeMoM?`
  - Add `MonthlyExportQuerySchema` with fields: `year`, `month`, `format` (enum: pdf, csv, json), `wikiProject?`
  - Use `z.preprocess()` pattern for year/month validation (handles empty strings)

  **Must NOT do**:
  - DO NOT modify existing annual report schemas

  **References**:
  - `apps/api/src/schemas/stats.schema.ts:49-78` - AnnualStatsQuerySchema pattern

  **Schema Structure**:

  ```typescript
  export const MonthlyStatsQuerySchema = z.object({
    year: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z
        .number()
        .int()
        .min(2000)
        .max(new Date().getFullYear() + 1),
    ),
    month: z.preprocess(
      (val) => (val === "" || val === undefined ? undefined : Number(val)),
      z.number().int().min(1).max(12),
    ),
    wikiProject: z.string().min(1).optional(),
    source: z.enum(["MEDIAWIKI", "OUTREACH_DASHBOARD"]).optional(),
    includeMoM: z.coerce.boolean().optional(),
  });
  ```

  **Commit**: `feat(api): add Zod schemas for monthly report endpoints`

---

- [x] 3. Add frontend API functions for monthly reports

  **What to do**:
  - Add `fetchMonthlyStats(params: { year: number; month: number; wikiProject?: string; includeMoM?: boolean })` to api.ts
  - Add `downloadMonthlyReport(params: { year: number; month: number; format: 'pdf' | 'csv' | 'json'; wikiProject?: string })` to api.ts
  - Add TypeScript types for monthly stats response

  **References**:
  - `apps/web/src/lib/api.ts` - fetchAnnualStats pattern

  **Commit**: `feat(web): add frontend API functions for monthly reports` ✅

---

- [x] 4. Add monthly stats API endpoint

  **What to do**:
  - Add `GET /api/stats/monthly` endpoint to stats routes
  - Parse query params with `MonthlyStatsQuerySchema`
  - Call `statsService.getMonthlyStats()` method
  - Return JSON response with structure: `{ success: true, data: { year, month, byWikiProject, totals, mom? } }`

  **References**:
  - `apps/api/src/routes/stats.ts:220-242` - GET /annual endpoint pattern

  **Commit**: `feat(api): add GET /api/stats/monthly endpoint`

---

- [x] 5. Add monthly export API endpoint

  **What to do**:
  - Add `GET /api/stats/monthly/export` endpoint to stats routes
  - Accept year, month, format, and optional wikiProject
  - Fetch monthly stats and top articles for the month
  - Call `reportExportService.exportPDF/CSV/JSON()` with monthly data
  - Set correct Content-Type and Content-Disposition headers

  **References**:
  - `apps/api/src/routes/stats.ts:280-340` - GET /annual/export endpoint pattern

  **Commit**: `feat(api): add GET /api/stats/monthly/export endpoint` ✅

---

- [x] 6. Extend ReportExportService for monthly data (if needed)

  **What to do**:
  - Check if existing `exportPDF/CSV/JSON` methods can handle monthly data structure
  - If needed, add `MonthlyReportData` type and update methods
  - Most likely: reuse existing methods with monthly data passed in

  **References**:
  - `apps/api/src/services/report-export.service.ts` - existing export methods

  **Commit**: `feat(api): extend ReportExportService for monthly report data`

---

- [x] 7. Add monthly report UI component

  **What to do**:
  - Create `apps/web/src/components/history/monthly-report-section.tsx`
  - Add year selection dropdown (current year and 3 previous)
  - Add month selection dropdown (1-12 with month names)
  - Add wiki project filter input (optional)
  - Add format selection dropdown (PDF, CSV, JSON)
  - Add "Generate Report" button with loading state
  - Handle download using `downloadMonthlyReport` API function

  **References**:
  - `apps/web/src/components/history/annual-report-section.tsx` - UI pattern to follow

  **UI Structure**:

  ```tsx
  const months = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    // ... etc
  ];
  ```

  **Commit**: `feat(web): add monthly report generation UI component`

---

- [x] 8. Integrate monthly report into history page

  **What to do**:
  - Import `MonthlyReportSection` in `history-page.tsx`
  - Add `<MonthlyReportSection />` component to the page
  - Position it appropriately (after Annual Report section or in tabs)

  **References**:
  - `apps/web/src/components/history/history-page.tsx` - integration point

  **Commit**: `feat(web): integrate monthly report UI into history page` ✅

---

- [x] 9. Add integration tests and documentation

  **What to do**:
  - Create `apps/api/src/__tests__/monthly-report.test.ts`
  - Test GET /api/stats/monthly endpoint
  - Test GET /api/stats/monthly/export endpoint (all formats)
  - Test error cases (invalid month, invalid year)
  - Update README.md with monthly report API documentation

  **References**:
  - `apps/api/src/__tests__/annual-report.test.ts` - test pattern to follow

  **Commit**: `test(api): add integration tests for monthly report feature` ✅

---

## Success Criteria

### Verification Commands

```bash
# Test monthly stats endpoint
curl -s "http://localhost:3000/api/stats/monthly?year=2024&month=1" | jq '.success'
# Expected: true

# Test month-over-month comparison
curl -s "http://localhost:3000/api/stats/monthly?year=2024&month=1&includeMoM=true" | jq '.data.mom'
# Expected: { articlesCreated: { current, previous, changePercent }, ... }

# Test PDF export
curl -s "http://localhost:3000/api/stats/monthly/export?year=2024&month=1&format=pdf" -o /tmp/monthly-report.pdf && file /tmp/monthly-report.pdf
# Expected: PDF document

# All tests pass
bun test
# Expected: All tests pass
```

### Final Checklist

- [x] All monthly aggregation methods working
- [x] All API endpoints return valid responses
- [x] PDF/CSV/JSON exports working for monthly data
- [x] UI integrated into history page with month selection
- [x] Tests pass for both apps/api and apps/web
- [x] README updated with monthly report documentation
