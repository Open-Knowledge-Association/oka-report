## 2026-02-04 - Fix Article Sync Field Names

### Problem

Articles page was showing empty data despite sync job completing "successfully".

### Root Cause

Field name mismatch between:

- **Outreach Dashboard API**: Returns snake_case (`character_sum`, `references_count`, `new_article`)
- **Prisma Schema**: Expects camelCase (`characterSum`, `referencesCount`, `isNewArticle`)
- **Sync Service**: Was using snake_case keys in Prisma upsert, causing 46,860 errors

### Solution

Changed 6 field name mappings in `apps/api/src/services/outreach-sync.service.ts`:

- `character_sum:` → `characterSum:` (lines 154, 164)
- `references_count:` → `referencesCount:` (lines 155, 165)
- `new_article:` → `isNewArticle:` (lines 156, 166)

### Key Insight

The values (right side) should remain as `article.character_sum` etc. because that's what the API returns. Only the Prisma field names (left side) need to be camelCase.

### Verification

- Before: 0 articles in database
- After: 1,706+ articles synced successfully
- All 10 unit tests pass

### Pattern to Remember

When mapping external API data to Prisma:

1. Keep API response properties as-is (snake_case)
2. Map to Prisma schema field names (camelCase)
3. Example: `characterSum: article.character_sum`

### Related Files

- `apps/api/src/services/outreach-article-sync.service.ts` - Already had correct pattern
- `packages/db/prisma/schema.prisma` - Source of truth for field names
