## Implementation: Annual Statistics Aggregation Methods

**Date**: 2026-02-06
**Task**: Add annual aggregation methods to StatsService

### Methods Added

1. **getAnnualStats(year, filters?)**
   - Aggregates DailyStat/DailyWikiStat data for full calendar year (Jan 1 - Dec 31 UTC)
   - Returns: `{ byWikiProject: WikiProjectAnnualStats[], totals: AnnualStats }`
   - Filters: wikiProject, source (optional)
   - Strategy: Queries appropriate table based on filters, sums all metrics

2. **calculateYoY(currentYear, metric = "all")**
   - Compares current year stats with previous year
   - Returns YoYComparison with current/previous/changePercent for each metric
   - Metric parameter: specific metric key or "all" for complete comparison
   - Handles division by zero (returns 0% change)

3. **getTopArticlesByYear(year, limit, wikiProject?)**
   - Queries ArticleDailyStat table for year range
   - Aggregates pageviews per article across entire year
   - Filters out articles with 0 pageviews
   - Returns sorted TopArticle[] with rank, title, wikiProject, totalPageviews

### Type Definitions Added

```typescript
type AnnualStats = {
  edits: number;
  wordsAdded: number;
  pageviews: number;
  articlesCreated: number;
  articlesEdited: number;
  editors: number;
  referencesAdded: number;
  commonsUploads: number;
};

type WikiProjectAnnualStats = AnnualStats & {
  wikiProject: string;
};

type YoYComparison = {
  [key: string]: { current: number; previous: number; changePercent: number };
};

type TopArticle = {
  rank: number;
  title: string;
  wikiProject: string;
  totalPageviews: number;
  articleId: string;
};
```

### Implementation Patterns Followed

- Used `toUtcDate()` helper for date normalization
- Date range: `{ gte: startOfYear, lte: endOfYear }`
- Manual aggregation with Map data structures for efficiency
- Followed existing aggregation patterns from `getDailyHistory` and `getOverallStats`
- Used Prisma query filtering for conditional table selection

### Database Tables Used

- `DailyStat` - Overall daily aggregated stats
- `DailyWikiStat` - Per wiki project daily stats
- `DailySourceStat` - Per source daily stats
- `DailyWikiSourceStat` - Per wiki project + source daily stats
- `ArticleDailyStat` - Per article daily stats (for top articles)

### Verification

- LSP diagnostics: Clean (only pre-existing hints about unused variables)
- Tests: No new test failures (pre-existing failures unrelated to changes)
- Commit: `c12f093` - feat(api): add annual stats aggregation methods to StatsService

### Key Design Decisions

1. **Default metric parameter**: `metric = "all"` for calculateYoY to return all metrics by default
2. **Table selection strategy**: Conditional query based on filters to optimize performance
3. **Zero division handling**: Returns 0% change when previous value is 0
4. **Pageview filtering**: Excludes articles with 0 pageviews from top articles list
5. **Aggregation helper**: Private `aggregateAnnualStats()` method for DRY code
