# Learnings - Pageviews by Wiki Language

## Type Definition Patterns

### OutreachArticle Interface

- Added `OutreachArticle` interface following snake_case naming convention for API fields
- Fields: id, title, language, project, view_count, average_views, character_sum, references_count, new_article, rating, url, user_ids
- user_ids field is an array type: `number[]`
- Mirrors OutreachUser pattern (lines 154-176) for consistency

### ArticleData Response Wrapper

- Follows pattern: `{ course: { articles: OutreachArticle[] } }`
- Consistent with UserData structure: `{ course?: { users: OutreachUser[] } }`
- Added after UploadData wrapper (line 206)

### Verification

- types.ts compiles successfully with no errors
- Pre-existing test errors in client.test.ts unrelated to this change
- All 12 fields from API response correctly typed

## Frontend API Integration - Task 4

### OutreachArticle Type & fetchOutreachArticles()

- Added `OutreachArticle` type to `apps/web/src/lib/api.ts` (lines 103-115)
- Added fields: id, title, language, project, view_count, average_views, character_sum, references_count, new_article, rating, url
- Implemented `fetchOutreachArticles()` async function (lines 117-122)
- Function calls endpoint: `/outreach/articles?school=OKA&slug=OKA`
- Extracts articles from nested response: `data.course.articles`
- Returns `OutreachArticle[]`
- Pattern: Exact mirror of `fetchOutreachUsers()` (lines 96-101)
- Verification: `bun run tsc --noEmit` passes with no errors
- LSP diagnostics: No errors on modified file
