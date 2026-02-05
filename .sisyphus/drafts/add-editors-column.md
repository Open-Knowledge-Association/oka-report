# Draft: Add Editors Column to Articles Table

## Requirements (confirmed)

- Display editors in a new column after Wiki column
- Format: Count with tooltip showing names (e.g., "3 editors" → hover to see names)
- Editors separated (not comma-joined in cell)
- OKA members should be highlighted with icon
- Editors should be clickable → links to new profile page
- Distinguish "original author" vs "editor" with badge

## User Decisions

- **Link destination**: Create new editor profile page `/editors/:id`
- **OKA highlight**: Small icon/logo next to OKA member names
- **Non-OKA editors**: Only show tracked editors (dari database)
- **Author detection timing**: Kombinasi - real-time saat sync + background job untuk backfill
- **Editor profile content**: Outreach stats + MediaWiki data

## Technical Findings

### API Response (READY)

- `/api/outreach/articles/db` already includes editors with nested data
- Structure: `article.editors[].editor.username`, `.id`, `.isActive`, `.source`, `.externalId`

### Frontend Types (NEEDS UPDATE)

- `apps/web/src/lib/api.ts` - OutreachArticle type MISSING `editors` field
- Need to add `OutreachArticleEditor` type with `isAuthor` field

### OKA Membership

- All editors in `OutreachArticleEditor` table ARE OKA-tracked
- Can show OKA icon for all editors in this column

### Author Detection (INFRASTRUCTURE EXISTS!)

- `packages/utils/src/wikimedia/client.ts` - WikimediaClient with rate limiting
- `packages/utils/src/wikimedia/articles.ts` - `getArticleInfo()` already fetches first revision
- Returns `{ creator, createdAt }` - exactly what we need!
- `apps/api/src/services/sync.service.ts` - Already uses this for Article model

## Scope Boundaries

- INCLUDE:
  1. **Schema Changes**
     - Add `isAuthor` boolean to `OutreachArticleEditor` model
  2. **Backend Services**
     - Create author detection service using existing WikimediaClient
     - Integrate into OutreachArticleSyncService (real-time)
     - Create background job for backfill
     - Add API endpoint for editor profile data
  3. **Frontend Types**
     - Add `OutreachArticleEditor` type with `isAuthor`
     - Update `OutreachArticle` type with `editors`
  4. **Articles Table UI**
     - Add Editors column after Wiki
     - Show count badge with tooltip
     - Show OKA icon
     - Show "Author" badge for original authors
     - Link to editor profile
  5. **Editor Profile Page**
     - Create `/editors/:id` route
     - Display Outreach stats (articles, edits, characters, etc.)
     - Display MediaWiki data (total contributions, registration date)
- EXCLUDE:
  - Non-OKA editors display
  - Caching MediaWiki API responses (can add later)

## Files to Modify/Create

### Schema & Database

- `packages/db/prisma/schema.prisma` - Add `isAuthor` to OutreachArticleEditor

### Backend

- `apps/api/src/services/outreach-article-sync.service.ts` - Add author detection
- `apps/api/src/services/author-detection.service.ts` - NEW: Background job service
- `apps/api/src/routes/editors.ts` - Add profile endpoint with MediaWiki data

### Frontend Types

- `apps/web/src/lib/api.ts` - Update types

### Frontend UI

- `apps/web/src/routes/articles.tsx` - Add Editors column
- `apps/web/src/routes/editors/$id.tsx` - NEW: Editor profile page

## Test Strategy

- No TDD (test infrastructure assessment not done)
- Agent-Executed QA Scenarios for each feature
- Playwright for UI verification
- curl for API verification
