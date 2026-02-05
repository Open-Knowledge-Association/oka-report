# Learnings - Add Editors Column to Articles Table

## Author Detection in Sync Service (Task 4)

### Implementation Pattern
- **Location**: `apps/api/src/services/outreach-article-sync.service.ts`
- **Trigger**: After creating/updating OutreachArticleEditor records
- **API Used**: `WikimediaClient.getArticleInfo()` - fetches first revision (creator)

### Key Implementation Details

1. **WikimediaClient Instantiation**:
   ```typescript
   const wikiBaseUrl = `https://${article.language}.${article.project}.org`;
   const wikimediaClient = new WikimediaClient({ baseUrl: wikiBaseUrl });
   ```
   - Construct base URL from article language and project
   - Create client instance per article (inherits rate limiter)

2. **Username Normalization**:
   ```typescript
   const normalizedCreator = articleInfo.creator.replace(/\s+/g, "_");
   const normalizedEditor = editor.username.replace(/\s+/g, "_");
   ```
   - Critical for comparison: Wikipedia uses underscores internally
   - Must normalize BOTH creator and editor usernames
   - Pattern: `replace(/\s+/g, "_")`

3. **Graceful Error Handling**:
   ```typescript
   try {
     // Author detection logic
   } catch (error) {
     console.warn("Failed to detect author...", error);
     // Continue sync - don't throw
   }
   ```
   - Wrap entire detection block in try/catch
   - Use `console.warn` for visibility without blocking
   - Sync continues even if author detection fails

4. **Update Pattern**:
   ```typescript
   const articleEditor = await this.prisma.outreachArticleEditor.upsert(...);
   // ... detect author ...
   await this.prisma.outreachArticleEditor.update({
     where: { id: articleEditor.id },
     data: { isAuthor: true },
   });
   ```
   - Store upsert result to get ID
   - Use ID for conditional update (only if creator matches)

### Why This Works
- **Rate Limiting**: WikimediaClient has built-in rate limiter (200 req/s with User-Agent)
- **Batching**: Already inside batch processing with concurrency limit (CONCURRENCY=5)
- **Performance**: Only fetches article info once per article-editor pair
- **Resilience**: Failures logged but don't block sync

### Existing Pattern Reference
Similar pattern in `sync.service.ts:213-229` for Article sync (not OutreachArticle).
Key difference: This implementation is inline in the editor loop, not a separate method.

## Editor Profile API Endpoint (Task 5)

### Implementation Details
- Created `GET /api/editors/:id/profile` endpoint in `apps/api/src/routes/editors.ts`
- Endpoint returns comprehensive editor profile combining Outreach and MediaWiki data

### Data Sources
1. **Database (Prisma)**:
   - Editor basic info (id, username)
   - Outreach articles through `OutreachArticleEditor` join table
   - Articles include pageviews data

2. **MediaWiki API**:
   - User profile data via `action=query&list=users`
   - Parameters: `ususers={username}&usprop=registration|editcount|gender`
   - Dynamically determines wiki URL from first article (fallback to en.wikipedia)

### Response Structure
```json
{
  "success": true,
  "data": {
    "editor": { "id": "...", "username": "..." },
    "outreachStats": {
      "articlesCount": 1027,
      "totalEdits": 1018,
      "charactersAdded": 20486686,
      "referencesAdded": 43888,
      "pageviews": 166107687
    },
    "wikimediaProfile": {
      "registrationDate": "2024-02-19T14:01:49Z",
      "editCount": 2546,
      "gender": "unknown"
    },
    "articles": [...]
  }
}
```

### Key Decisions
- **Import Path**: Use `@repo/utils` (not `@repo/utils/wikimedia`)
- **Type Assertion**: Use `as UserQueryResponse` instead of generic type parameter for `client.request()`
- **Wiki URL Logic**: Derive from first article's language/project; fallback to en.wikipedia if no articles
- **Error Handling**: MediaWiki API failures return `wikimediaProfile: null` instead of failing entire request
- **Stats Calculation**:
  - `totalEdits`: Count articles with characterSum > 0
  - `pageviews`: Sum latest cumulative views from each article
  - Articles sorted by snapshot date to get most recent pageview data

### Verification
- Tested with editor having 1027 articles: ✅ All data correct
- Tested with editor having 0 articles: ✅ MediaWiki profile still retrieved
- Tested 404 case: ✅ Returns 404 with proper error message
- TypeScript compilation: ✅ No errors in editors.ts

