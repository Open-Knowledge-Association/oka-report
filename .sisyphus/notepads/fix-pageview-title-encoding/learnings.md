# Fix Pageview Title Encoding - Learnings

## Implementation Summary

**Date**: 2026-02-07
**Task**: Normalize article titles by converting spaces to underscores for Wikimedia Pageviews API

## Problem

Articles stored in database use spaces (e.g., `"Colli di Sant'Erasmo"`) but Wikimedia Pageviews API expects underscores (e.g., `"Colli_di_Sant'Erasmo"`). This caused many 404 errors during sync.

## Solution

Added one line in `packages/utils/src/wikimedia/pageviews.ts`:

```typescript
// Normalize title: Wikimedia Pageviews API expects underscores instead of spaces
const normalizedTitle = article.replace(/ /g, "_");
const encodedArticle = encodeURIComponent(normalizedTitle);
```

## Key Learning

Wikimedia APIs have different title format requirements:

- **MediaWiki API**: Accepts titles with spaces
- **Pageviews API**: Requires underscores

Always normalize titles to match the specific API being called.

## Verification

- Code applied to line 31-33 of pageviews.ts
- TypeScript compiles without errors (pre-existing errors in other files unrelated)
- Function signature unchanged (no breaking changes)
- Committed: `4ccf7e8 fix(utils): normalize article titles for Pageviews API (spaces to underscores)`

## Result

404 errors for articles with spaces in titles should now be resolved.
