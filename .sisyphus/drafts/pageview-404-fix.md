# Draft: Pageview 404 Error Investigation & Fix

## Problem Statement

Saat menjalankan sync pageviews, banyak artikel return 404 error. Contoh:

- "Cuterebra fontinella" di pt.wikipedia.org → 404 (padahal artikel ADA!)
- "Kawasaki Ki-45" di pt.wikipedia.org → 404

## Root Cause Analysis

### ✅ CONFIRMED: Wrong Agent Type in Pageviews API

**Source**: `packages/utils/src/wikimedia/pageviews.ts` (line 34)

```typescript
// CURRENT (WRONG):
const endpoint = `${PAGEVIEWS_BASE_URL}/metrics/pageviews/per-article/${project}/all-access/user/${encodedArticle}/daily/...`;

// SHOULD BE:
const endpoint = `${PAGEVIEWS_BASE_URL}/metrics/pageviews/per-article/${project}/all-access/all-agents/${encodedArticle}/daily/...`;
```

**Proof**:

- ❌ `user` agent → 404 Not Found
- ✅ `all-agents` → Returns data with views

**Explanation**:

- `user` = hanya views dari manusia (excludes bots/spiders)
- `all-agents` = semua views (manusia + bots)
- Untuk artikel dengan low traffic, mungkin TIDAK ADA data `user` views, sehingga return 404

### Secondary Finding: 404 for Zero Views is Expected

Pageviews API return 404 (bukan empty array) jika tidak ada views sama sekali dalam date range. Ini adalah expected behavior dari Wikimedia API.

## User Decision

User memilih: **Validate Article First + Fix Data Source**

## Proposed Solution

### Approach 1: Validate Before Pageview Fetch (Quick Fix)

Sebelum fetch pageviews, cek dulu apakah artikel ada di Wikipedia target:

```typescript
// In sync.service.ts syncArticlePageviews()
const articleExists = await this.wikimediaClient.checkArticleExists(
  article.title,
  article.wikiProject,
);
if (!articleExists) {
  // Mark article as invalid or log and skip
  continue;
}
```

### Approach 2: Fix Data at Source (Long-term Fix)

Saat sync dari Outreach Dashboard, validate artikel sebelum simpan:

```typescript
// In outreach-article-sync.service.ts
const articleInfo = await wikimediaClient.getArticleInfo(dashboardArticle.title);
if (!articleInfo) {
  // Article doesn't exist on target wiki - skip or flag
  continue;
}
// Also set pageId from articleInfo
article.pageId = articleInfo.pageId;
```

### Approach 3: Reduce Logging Noise (Optional Enhancement)

Aggregate 404 errors dan log summary di akhir:

```typescript
const skipped404Articles: string[] = [];
// ... in loop ...
if (error.status === 404) {
  skipped404Articles.push(article.title);
  continue;
}
// ... after loop ...
console.log(`Pageviews sync: ${skipped404Articles.length} articles skipped (404 not found)`);
```

## Research Findings

### Wikimedia Pageviews API 404 Causes

1. **Article doesn't exist** on target wiki
2. **Redirect pages** - pageviews counted on target page
3. **Template pages** - transcluded, not directly viewed
4. **Special namespace** - not content articles
5. **Date range before article creation**
6. **Zero views** - API returns 404, not empty

### How to Validate Article Exists

```typescript
// MediaWiki REST API
GET https://{lang}.wikipedia.org/api/rest_v1/page/summary/{title}
// Returns 200 if exists, 404 if not

// Or Action API
GET https://{lang}.wikipedia.org/w/api.php?action=query&titles={title}&format=json
// Check if pageId is -1 (missing) or valid number
```

## Key Files to Modify

1. `apps/api/src/services/outreach-article-sync.service.ts` - Add validation during import
2. `apps/api/src/services/sync.service.ts` - Add validation before pageview fetch
3. `packages/utils/src/wikimedia/client.ts` - Add checkArticleExists method

## Open Questions

- [ ] Should we validate ALL articles or only during pageview sync?
- [ ] What to do with articles that don't exist? Delete? Flag? Skip silently?
- [ ] Should we add a `validatedAt` timestamp to track last validation?
- [ ] Performance impact of validating each article (rate limiting)?
