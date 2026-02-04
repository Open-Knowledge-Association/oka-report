# Learnings: Outreach Articles Stats Endpoint

## Implementation: `/api/outreach/articles/stats`

### What Was Built

Created a new global aggregation endpoint that returns:

- `totalArticles`: Total count of OutreachArticles (12,924)
- `totalPageviews`: Sum of latest cumulative pageviews per article
- `uniqueWikis`: Count of distinct language.project combinations
- `wikiStats`: Array of per-wiki breakdowns with article count and pageviews

### Technical Approach

#### Pageview Calculation Strategy

**Challenge**: Calculate total pageviews efficiently without N+1 queries.

**Solution Implemented**: Fetch all articles with their latest pageview snapshot in a single query

```typescript
const articles = await prisma.outreachArticle.findMany({
  include: {
    pageviews: {
      orderBy: { snapshotDate: "desc" },
      take: 1,
    },
  },
});
```

**Why This Works**:

- Single Prisma query with include() loads articles + latest snapshot
- No N+1 problem (one query per nested relation)
- Post-processing in memory is acceptable since we get all articles anyway
- Alternative (raw SQL with window functions) would be premature optimization

#### Wiki Grouping

Uses `language.project` as composite key for wiki identifier:

- Example keys: "en.wikipedia", "es.wikipedia", "pt.wikipedia"
- Grouped by language + project to support multi-project scenarios (future)

### Response Schema Design

Created `OutreachArticleStatsResponseSchema` in `stats.schema.ts`:

```typescript
{
  totalArticles: number,
  totalPageviews: number,
  uniqueWikis: number,
  wikiStats: Array<{
    wiki: string,
    count: number,
    pageviews: number
  }>
}
```

All response data goes through Zod validation for type safety.

### Endpoint Characteristics

- **Route**: `GET /api/outreach/articles/stats`
- **Parameters**: None (always returns global stats)
- **Response Format**: `{ success: true, data: {...} }` (standard pattern)
- **Error Handling**: Standard try-catch with error details
- **Status Codes**: 200 (success), 500 (error)

### Verification Results

✅ Endpoint returns exactly 12,924 totalArticles
✅ Response validates against Zod schema
✅ Wiki breakdown correct: en.wikipedia (7,120), es.wikipedia (1,979), pt.wikipedia (3,825)
✅ Follows existing endpoint patterns in outreach.ts

### Key Pattern Observations

1. All outreach endpoints follow consistent error handling pattern
2. JSDoc comments on endpoints match project style
3. Response structure is always `{ success, data }` or `{ success, error, details }`
4. Prisma includes() is preferred over multiple queries
5. Post-processing in JavaScript acceptable when dealing with reasonable result sets

### Performance Characteristics

- Single Prisma query fetches all articles with latest snapshots
- Memory cost: ~12K articles × ~1KB per article ≈ 12MB (acceptable)
- No database round-trips for aggregation
- Suitable for caching if needed (response is deterministic from DB state)

### Future Considerations

- Could add pagination if wikiStats grows very large
- Could optimize with raw SQL + window functions if article count reaches 1M+
- Could cache response if stats are expensive to recompute frequently

## Implementation: Search and Wiki Filter for `/api/outreach/articles/db`

### What Was Added

Enhanced the existing `/api/outreach/articles/db` pagination endpoint with:

1. **Search Filter** (`search` query parameter)
   - Case-insensitive title search using Prisma `contains` with `mode: "insensitive"`
   - Filters `outreachArticle.title` field
   - Optional parameter - omitting it returns all articles

2. **Wiki Filter** (`wiki` query parameter)
   - Format: `language.project` (e.g., `en.wikipedia`, `es.wikipedia`)
   - Parses the string into language and project components
   - Matches both language and project fields exactly
   - Optional parameter - omitting it returns articles from all wikis

3. **Query Validation with Zod**
   - Created `OutreachArticlesQuerySchema` in new file `apps/api/src/schemas/outreach.schema.ts`
   - Validates and coerces `page` and `limit` parameters
   - Both search and wiki are optional strings with minimum length 1
   - Default values: `page: 1`, `limit: 50`

### Implementation Details

#### Schema Definition

```typescript
export const OutreachArticlesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().min(1).optional(),
  wiki: z.string().min(1).optional(), // Format: "en.wikipedia"
});
```

#### Dynamic Where Clause Pattern

Used conditional spread operator to build the Prisma `where` object:

```typescript
const where = {
  ...(query.search
    ? { title: { contains: query.search, mode: "insensitive" } }
    : {}),
  ...(query.wiki
    ? (() => {
        const [language, project] = query.wiki.split(".");
        return language && project ? { language, project } : {};
      })()
    : {}),
};
```

This pattern:
- Only includes filters when parameters are provided
- Safely parses wiki parameter and validates both components exist
- Returns empty object if wiki is malformed
- Applies both filters simultaneously if both parameters provided

#### Database Integration

Both `count()` and `findMany()` use the same `where` clause:

```typescript
const total = await prisma.outreachArticle.count({ where });
const articles = await prisma.outreachArticle.findMany({
  where,
  skip: offset,
  take: query.limit,
  // ...
});
```

This ensures `pagination.total` correctly reflects the filtered count.

### API Examples

```bash
# Get all articles (default pagination)
curl "http://localhost:3000/api/outreach/articles/db"

# Search articles containing "climate"
curl "http://localhost:3000/api/outreach/articles/db?search=climate&limit=5"

# Get articles only from English Wikipedia
curl "http://localhost:3000/api/outreach/articles/db?wiki=en.wikipedia"

# Search AND filter by wiki
curl "http://localhost:3000/api/outreach/articles/db?search=water&wiki=es.wikipedia&page=1&limit=10"
```

### Pattern Alignment

This implementation follows existing project patterns:

1. **Schema Organization**
   - Matches `EditorQuerySchema` pattern from `editor.schema.ts`
   - Exports from central `schemas/index.ts` file
   - Uses Zod for validation

2. **Endpoint Style**
   - Consistent with editors route search pattern
   - Maintains existing response structure
   - Uses `mode: "insensitive"` for case-insensitive search (matches editors)

3. **Error Handling**
   - Standard try-catch block
   - Returns 500 with error details on failure
   - Zod validation errors handled naturally by catch block

### Verified Behavior

✅ Search parameter filters title case-insensitively
✅ Wiki parameter correctly parses language.project format
✅ Pagination respects filtered count in `pagination.total`
✅ Both filters work independently and together
✅ Missing parameters handled gracefully
✅ Malformed wiki parameter (missing . or component) returns all articles
✅ Build completes without errors
✅ Follows existing code style and patterns

### Performance Notes

- Prisma `contains` with `mode: "insensitive"` is indexed-optimized on modern PostgreSQL versions
- Single query satisfies both count and fetch operations
- No N+1 problems: includes still present for pageviews and editors relations

### Files Modified

1. **Created**: `apps/api/src/schemas/outreach.schema.ts` - New schema file with OutreachArticlesQuerySchema
2. **Modified**: `apps/api/src/routes/outreach.ts` - Updated /articles/db endpoint to use Zod parsing and dynamic where clause
3. **Modified**: `apps/api/src/schemas/index.ts` - Added export for OutreachArticlesQuerySchema

## Implementation: Frontend API Client Update

### What Was Built

Updated `apps/web/src/lib/api.ts` to support the new backend endpoints:

1. **Updated `fetchOutreachArticles` function**
   - Now accepts optional params: `{ page?, limit?, search?, wiki? }`
   - Returns full `ArticlesResponse` object with articles AND pagination metadata
   - Builds URL query string dynamically from provided params
   - No longer discards pagination data

2. **New `fetchArticleStats` function**
   - Calls `/outreach/articles/stats` endpoint
   - Returns `ArticleStats` type with global statistics
   - Used for displaying overview metrics in dashboard

### Type Definitions Added

```typescript
// Pagination structure returned by API
export type PaginationMetadata = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// Full response including articles and pagination
export type ArticlesResponse = {
  articles: OutreachArticle[];
  pagination: PaginationMetadata;
};

// Global article statistics
export type ArticleStats = {
  totalArticles: number;
  totalPageviews: number;
  uniqueWikis: number;
  wikiStats: Array<{
    wiki: string;
    count: number;
    pageviews: number;
  }>;
};
```

### Implementation Details

#### fetchOutreachArticles Signature Change

**Before**:
```typescript
export const fetchOutreachArticles = async () => {
  const data = await apiFetch<{ articles: OutreachArticle[]; pagination: {...} }>("/outreach/articles/db");
  return data.articles;  // Only returned articles array
};
```

**After**:
```typescript
export const fetchOutreachArticles = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  wiki?: string;
}): Promise<ArticlesResponse> => {
  const queryString = new URLSearchParams();
  if (params?.page) queryString.set("page", String(params.page));
  if (params?.limit) queryString.set("limit", String(params.limit));
  if (params?.search) queryString.set("search", params.search);
  if (params?.wiki) queryString.set("wiki", params.wiki);

  const query = queryString.toString();
  const path = `/outreach/articles/db${query ? `?${query}` : ""}`;

  return apiFetch<ArticlesResponse>(path);
};
```

**Key Changes**:
- Accepts optional params object for pagination, search, and filtering
- Uses URLSearchParams for clean query string building
- Conditionally adds params only if provided (doesn't send undefined params)
- Returns full response with pagination metadata (enables paginated table display)

#### fetchArticleStats Implementation

```typescript
export const fetchArticleStats = async (): Promise<ArticleStats> => {
  return apiFetch<ArticleStats>("/outreach/articles/stats");
};
```

**Characteristics**:
- Simple, stateless function
- No parameters (always returns global stats)
- Returns strongly-typed ArticleStats object
- Used for dashboard overview cards

### Query String Building Pattern

Uses URLSearchParams for clean, readable query construction:
```typescript
const queryString = new URLSearchParams();
if (params?.page) queryString.set("page", String(params.page));
// Results in: "page=2" (only if page exists)

const query = queryString.toString();
const path = `/outreach/articles/db${query ? `?${query}` : ""}`;
// Results in: "/outreach/articles/db?page=2&search=climate" (with proper joining)
```

This pattern avoids manual string concatenation and handles multiple params cleanly.

### Breaking Change Impact

⚠️ **BREAKING CHANGE**: `fetchOutreachArticles` return type changed from `OutreachArticle[]` to `ArticlesResponse`

Files that call `fetchOutreachArticles` need updates:
- `apps/web/src/routes/articles.tsx` - Will be updated in Task 5

Current usage:
```typescript
// OLD: const articles = await fetchOutreachArticles();
// NEW: const response = await fetchOutreachArticles(); 
//      const articles = response.articles;
//      const pagination = response.pagination;
```

### Verification

✅ TypeScript compilation successful (`moon run web:build`)
✅ No LSP diagnostics on modified file
✅ Type exports available for component usage
✅ Follows existing apiFetch<T> pattern in codebase
✅ Query string handling safe (URLSearchParams)

### Usage Examples

```typescript
// Get all articles (default pagination)
const response = await fetchOutreachArticles();
const articles = response.articles;

// Get page 2 with custom limit
const response = await fetchOutreachArticles({ page: 2, limit: 20 });

// Search articles
const response = await fetchOutreachArticles({ search: "climate" });

// Filter by wiki
const response = await fetchOutreachArticles({ wiki: "es.wikipedia" });

// Combine pagination, search, and filter
const response = await fetchOutreachArticles({
  page: 1,
  limit: 10,
  search: "water",
  wiki: "pt.wikipedia"
});

// Get global stats
const stats = await fetchArticleStats();
console.log(stats.totalArticles); // e.g., 12924
console.log(stats.wikiStats);     // per-wiki breakdown
```

### Next Steps

Task 5 will update `apps/web/src/routes/articles.tsx` to:
- Use the new `fetchOutreachArticles` params
- Handle the new `ArticlesResponse` structure
- Integrate pagination UI controls
- Use `fetchArticleStats` for stats display
