# Draft: Annual Report Generation Feature

## Requirements (confirmed from PDF analysis)

### Report Structure (from OKA Annual Reports 2023-2025)

1. **Cover/Title Page** - Organization name, report year
2. **Executive Summary** - Key highlights, impact narrative
3. **Key Figures Section** - Core metrics tables
4. **Translation Output Table** - Articles created by wiki, by year
5. **Annualized Pageviews Table** - Views by wiki, by year
6. **Expands/Improvements Table** - Articles edited/improved (2025+)
7. **Most Viewed Articles** - Top 10 lists per wiki group
8. **Financial Statement** - Balance sheet, P&L (donations, stipends, reserves)
9. **Operational Highlights** - Year-specific achievements
10. **Growth Metrics** - YoY comparisons and percentages

### Core Metrics to Include

| Metric                   | Per Wiki | Per Year | Cumulative | YoY % |
| ------------------------ | -------- | -------- | ---------- | ----- |
| Articles Created         | ✓        | ✓        | ✓          | ✓     |
| Annualized Pageviews     | ✓        | ✓        | ✓          | ✓     |
| Words Added              | ✓        | ✓        | ✓          | ✓     |
| References Added         | ✓        | ✓        | ✓          | ✓     |
| Commons Uploads          | ✓        | ✓        | ✓          | ✓     |
| Active Editors           | ✓        | ✓        | ✓          | ✓     |
| Articles Edited/Improved | ✓        | ✓        | ✓          | ✓     |

### Grouping Dimensions

- **By Wiki Project**: en.wikipedia.org, id.wikipedia.org, es.wikipedia.org, etc.
- **By Year**: 2023, 2024, 2025, etc.
- **Cumulative**: "Since OKA creation"
- **By Source**: MEDIAWIKI, OUTREACH_DASHBOARD

## Technical Decisions

### Data Source

- Primary: DailyStat tables (already aggregate daily metrics)
- For annual aggregation: SUM across date ranges per year
- Need: YearlyStat aggregation tables for performance

### Pageview Snapshot Date

- Reports use "annualized based on last month views"
- Must store snapshot date for reproducibility
- Current system has daily pageviews - can calculate annualized

### Export Formats

- PDF (primary - matches existing reports)
- JSON (for programmatic access)
- CSV (for spreadsheet analysis)

## Research Findings

### Current History Feature Capabilities

- ✓ Global daily history (DailyStat)
- ✓ Editor daily history (EditorDailyStat)
- ✓ Article daily history (ArticleDailyStat)
- ✓ Filtering by date range, wiki, source
- ✓ Delta calculations between periods
- ✗ Annual aggregation
- ✗ YoY comparison calculations
- ✗ Top articles ranking
- ✗ Export to PDF/CSV
- ✗ Report template generation

### Database Tables Available

- DailyStat - global daily aggregates
- DailyWikiStat - per wiki project daily
- DailySourceStat - per source daily
- DailyWikiSourceStat - wiki + source combination
- EditorDailyStat - per editor daily
- ArticleDailyStat - per article daily

## Open Questions

### Answered

- Report structure: Follows existing PDF format
- Metrics to track: All current metrics + top articles
- Grouping: By wiki, by year, cumulative

### Still Open

- [ ] Should we add YearlyStat tables for performance?
- [ ] PDF generation library: puppeteer/playwright PDF vs jsPDF?
- [ ] Should reports be generated on-demand or pre-cached?
- [ ] Store generated reports in filesystem or S3?

## Scope Boundaries

### INCLUDE (IN SCOPE)

1. Annual report data aggregation API
2. YoY comparison calculations
3. Top articles ranking API
4. Export to PDF, JSON, CSV
5. Report preview UI in history page
6. Date range selection for custom reports

### EXCLUDE (OUT OF SCOPE)

- Financial statement automation (manual input for now)
- AI-generated narrative summaries
- Multi-language PDF generation
- Email scheduling for reports
- Historical PDF import/parsing

## Feature Dependencies

### Required Additions

1. **YearlyStat aggregation** - New tables or computed views
2. **Top Articles API** - Ranking by pageviews for period
3. **Report Generation Service** - Aggregate + format + export
4. **PDF Generation** - Server-side PDF rendering
5. **Report Templates** - Reusable report structure

### UI Enhancements to History Page

1. "Generate Report" button
2. Year selection dropdown
3. Wiki project multi-select
4. Export format selection
5. Report preview before download

## Test Strategy Decision

- **Infrastructure exists**: YES (vitest for web, tests for API)
- **Automated tests**: YES (Tests-after approach)
- **Agent-Executed QA**: Playwright for UI, curl for API

---

_Last updated: Plan session in progress_
