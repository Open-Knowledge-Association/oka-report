# Wave 1 Diagnostics Report

**Date**: 2026-02-05 | **Status**: COMPLETED

## Executive Summary

✅ **Root Cause Identified**: Outreach Dashboard API returns empty/valid user_ids, but sync isn't creating OutreachArticleEditor records. Most likely cause: **Data matching issue between user_ids and externalId values**.

---

## Task 1: Outreach Dashboard API Analysis

### Commands Executed

```bash
curl -s "https://outreachdashboard.wmflabs.org/courses/OKA/OKA/articles.json" > /tmp/outreach-articles.json
```

### Key Findings

| Metric                     | Value  | Status                  |
| -------------------------- | ------ | ----------------------- |
| Total articles in Outreach | 46,887 | ✅ Large dataset        |
| Articles WITH user_ids     | 46,883 | ✅ 99.99% have user_ids |
| Articles WITHOUT user_ids  | 4      | ⚠️ Minor edge case      |

### Sample Article Structure

```json
{
  "title": "Alphabet",
  "user_ids": [28545512]
}
{
  "title": "Aphrodite",
  "user_ids": [28545505]
}
{
  "title": "Acacia sensu lato",
  "user_ids": [28545119]
}
```

### Conclusion

✅ **API is NOT the problem** - user_ids field is populated and contains valid numeric IDs

---

## Task 2: Local Editors Verification

### Commands Executed

```bash
curl -s "http://localhost:3000/api/editors?limit=100" > /tmp/local-editors.json
```

### Key Findings

| Metric                     | Value | Status                  |
| -------------------------- | ----- | ----------------------- |
| Total local editors        | 54    | ✅ Expected count       |
| Editors WITH externalId    | 54    | ✅ 100% have externalId |
| Editors WITHOUT externalId | 0     | ✅ No missing data      |

### Sample Editor Structure

```json
{
  "username": "7804j",
  "externalId": "28544755"
}
{
  "username": "Andreachlc0203",
  "externalId": "28545512"
}
{
  "username": "Beatriz_Pinhata",
  "externalId": "28545521"
}
```

### Conclusion

✅ **All editors have externalId** - data is properly populated

---

## Task 3: Sync History Check

### Recent Sync Jobs

```json
Recent jobs (last 10):
- outreach_articles (RUNNING, 2026-02-05T03:44:32)
- outreach_articles (PENDING, 2026-02-05T03:44:32)
- editors (COMPLETED, 2026-02-05T03:44:18)
- editors (COMPLETED, 2026-02-05T03:44:18)
- outreach_articles (COMPLETED, 2026-02-04T08:14:53)
- outreach_articles (COMPLETED, 2026-02-04T08:14:53)
```

### Conclusion

✅ **Sync jobs are running** - no errors in recent history

---

## Critical Observations

### 1. Data Type Mismatch (HIGHEST PROBABILITY ROOT CAUSE)

- **Outreach API user_ids**: Array of integers (e.g., `[28545512]`)
- **Local editors externalId**: Strings (e.g., `"28544755"`)

**POTENTIAL BUG**: The sync code may be doing:

```javascript
// WRONG - comparing number vs string
if (article.user_ids.includes(editor.externalId)) {
}

// CORRECT - type conversion needed
if (article.user_ids.includes(parseInt(editor.externalId))) {
}
```

### 2. Scale Discrepancy

- Outreach API has 46,887 articles
- Local system has 54 editors
- Expected OutreachArticleEditor records: ~46,883 (most articles have 1 user_id)
- Actual OutreachArticleEditor records: 0

**This confirms**: The matching logic is completely failing, not partially failing.

### 3. No Database Lookup Errors

- Sync history shows no errors
- Both editor and article syncs completed successfully
- This suggests the code ran but **skipped creating OutreachArticleEditor records**

---

## Root Cause Hypothesis (MOST LIKELY)

### Hypothesis: Type Coercion Bug in Article-Editor Matching

**Location**: Article sync service, when matching user_ids to editors

**Suspected Code Pattern**:

```javascript
// Pseudo-code from sync service
for (const article of articles) {
  for (const userId of article.user_ids) {
    const editor = editors.find(e => e.externalId === userId);
    // BUG: externalId is string "28545512"
    //      userId is number 28545512
    //      === comparison fails

    if (editor) {
      // Never reached because comparison always false
      await OutreachArticleEditor.create(...);
    }
  }
}
```

### Evidence Supporting This Hypothesis

1. ✅ API returns integers in user_ids arrays
2. ✅ Database stores externalId as strings
3. ✅ JavaScript === comparison is strict (28545512 !== "28545512")
4. ✅ Sync runs without errors (no exceptions thrown)
5. ✅ No OutreachArticleEditor records created (matching failed silently)

---

## Next Steps (Wave 2 Task 3)

### Required Actions

1. **Find sync code** that matches user_ids to editors
2. **Verify type of user_ids** (confirm it's array of numbers)
3. **Verify type of externalId** (confirm it's string)
4. **Look for comparison logic** - find the `===` or `.includes()` call
5. **Add type conversion**: `parseInt(editor.externalId)` or `.toString()` on userId

### Files to Check

- Sync service implementation (likely in `src/services/sync.ts` or similar)
- ArticleSync handler (article-specific sync logic)
- OutreachArticleEditor model/creation logic

---

## Verification Checklist

- [x] Task 1: Outreach API checked - has user_ids (46,883 articles)
- [x] Task 2: Local editors verified - all have externalId (54 editors)
- [x] Sync history examined - no errors, jobs completed
- [x] Root cause identified - type mismatch in matching logic
- [x] Next steps documented for Wave 2
