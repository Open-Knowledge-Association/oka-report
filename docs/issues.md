# OKA Stats Platform - Issues

This document contains all tasks for the project, organized by phase and broken into small actionable items.

---

# Phase 1: Database Schema ✅

Database schema is complete. See [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma).

---

# Phase 2: Wikimedia API Client

## report-0sj: Create WikimediaClient base class

- Type: task
- Priority: 0
- Labels: api-client, backend
- Depends on: none

Create the base WikimediaClient class in `packages/utils/src/wikimedia/`:

**Subtasks:**

1. Create `packages/utils/src/wikimedia/client.ts` file
2. Define WikimediaClientConfig interface (baseUrl, userAgent)
3. Implement constructor with config injection
4. Add User-Agent header per Wikimedia guidelines: `OKA-Stats/1.0 (https://oka.wiki; contact@oka.wiki)`
5. Implement generic `request<T>(endpoint, params)` method with fetch
6. Add error handling for HTTP errors and API errors
7. Export from `packages/utils/index.ts`

**Acceptance criteria:**

- Base class can make authenticated requests to any Wikimedia API
- Errors are properly typed and thrown

---

## report-abw: Implement getUserContributions in WikimediaClient

- Type: task
- Priority: 0
- Labels: api-client, backend
- Depends on: report-0sj

Implement `getUserContributions(username, options)` method.

**Subtasks:**

1. Define UserContribution type interface
2. Define GetUserContributionsOptions interface (limit, start, end)
3. Implement method calling `/w/api.php?action=query&list=usercontribs`
4. Add params: ucuser, ucprop (ids|title|timestamp|sizediff), uclimit, ucstart, ucend
5. Implement pagination with continue token handling
6. Transform API response to typed array

**Acceptance criteria:**

- Can fetch contributions for a username
- Handles pagination automatically
- Returns typed UserContribution[]

---

## report-x7t: Implement getArticleInfo in WikimediaClient

- Type: task
- Priority: 0
- Labels: api-client, backend
- Depends on: report-0sj

Implement `getArticleInfo(title, wikiProject)` method.

**Subtasks:**

1. Define ArticleInfo type interface
2. Implement method calling `/w/api.php?action=query&titles={title}&prop=revisions&rvlimit=1&rvdir=newer`
3. Extract pageId, creator username, creation timestamp
4. Handle article not found case

**Acceptance criteria:**

- Returns article creation metadata
- Properly handles missing articles

---

## report-9xt: Implement getPageviews in WikimediaClient

- Type: task
- Priority: 0
- Labels: api-client, backend
- Depends on: report-0sj

Implement `getPageviews(article, project, startDate, endDate)` method.

**Subtasks:**

1. Define PageviewData type interface
2. Use Wikimedia REST API base URL: `https://wikimedia.org/api/rest_v1`
3. Implement endpoint: `/metrics/pageviews/per-article/{project}/{access}/{agent}/{article}/{granularity}/{start}/{end}`
4. Set params: access=all-access, agent=user, granularity=daily
5. Transform response to typed array of daily counts

**Acceptance criteria:**

- Returns daily pageview counts for date range
- Properly formats dates for API

---

## report-6pk: Implement getCommonsUploads in WikimediaClient

- Type: task
- Priority: 1
- Labels: api-client, backend
- Depends on: report-0sj

Implement `getCommonsUploads(username)` method.

**Subtasks:**

1. Define CommonsUpload type interface
2. Use Commons API: `https://commons.wikimedia.org/w/api.php`
3. Implement query with list=allimages&aiuser={username}
4. Add params: aisort=timestamp, aiprop=timestamp|url|size
5. Handle pagination for users with many uploads

**Acceptance criteria:**

- Returns typed array of upload objects
- Handles pagination

---

## report-r32: Add rate limiting helper with exponential backoff

- Type: task
- Priority: 1
- Labels: api-client, backend
- Depends on: report-0sj

Create rate limiting utility for Wikimedia API calls.

**Subtasks:**

1. Create `packages/utils/src/wikimedia/rate-limiter.ts`
2. Implement exponential backoff on 429 responses
3. Parse and respect Retry-After headers
4. Add configurable delay between requests (default 100ms)
5. Implement request queue to prevent concurrent limit violations
6. Integrate with WikimediaClient base class

**Acceptance criteria:**

- Automatically retries on rate limit
- Queues requests to respect limits

---

## report-tqy: Add unit tests for Wikimedia API client

- Type: task
- Priority: 2
- Labels: api-client, testing
- Depends on: report-0sj, report-abw, report-x7t, report-9xt

Write unit tests for WikimediaClient.

**Subtasks:**

1. Set up test file `packages/utils/src/wikimedia/__tests__/client.test.ts`
2. Mock HTTP responses using vitest
3. Test getUserContributions with pagination
4. Test getArticleInfo with found/not found
5. Test getPageviews date formatting
6. Test error handling (network errors, API errors)
7. Test rate limiting behavior

**Acceptance criteria:**

- All methods have test coverage
- Edge cases are tested

---

# Phase 3: Background Sync Service

## report-2h3: Create SyncService class skeleton

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-0sj

Create SyncService class in `apps/api/src/services/sync.service.ts`.

**Subtasks:**

1. Create `apps/api/src/services/` directory
2. Create `sync.service.ts` file
3. Define SyncService class with constructor(prisma, wikimediaClient)
4. Add method stubs: syncEditorContributions, syncArticlePageviews, syncCommonsUploads, runFullSync
5. Add logging setup with console or pino

**Acceptance criteria:**

- Class compiles and can be instantiated
- All method signatures defined

---

## report-c2g: Implement syncEditorContributions

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-2h3, report-abw

Implement `syncEditorContributions(editorId?, since?)` method.

**Subtasks:**

1. Query active editors from database (or single if editorId provided)
2. For each editor, call WikimediaClient.getUserContributions()
3. Determine which contributions are new articles (isCreation)
4. Upsert contributions to database with Prisma
5. Create/update Article records for new contributions
6. Return count of synced contributions

**Acceptance criteria:**

- Syncs all active editors or single editor
- Creates Article records for new articles
- Handles incremental sync with "since" date

---

## report-660: Implement syncArticlePageviews

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-2h3, report-9xt

Implement `syncArticlePageviews(articleId?, since?)` method.

**Subtasks:**

1. Query articles where isCreation=true (or single if articleId)
2. For each article, call WikimediaClient.getPageviews()
3. Upsert daily Pageview records to database
4. Return count of synced pageview records

**Note:** Per requirements, pageviews only counted for articles CREATED by editors.

**Acceptance criteria:**

- Only fetches pageviews for created articles
- Handles date ranges properly
- Upserts without duplicates

---

## report-noc: Implement syncCommonsUploads

- Type: task
- Priority: 1
- Labels: backend
- Depends on: report-2h3, report-6pk

Implement `syncCommonsUploads(editorId?)` method.

**Subtasks:**

1. Query active editors from database
2. For each editor, call WikimediaClient.getCommonsUploads()
3. Upsert CommonsUpload records to database
4. Handle duplicate detection by fileName
5. Return count of synced uploads

**Acceptance criteria:**

- Syncs uploads for all active editors
- No duplicate records

---

## report-0ro: Implement SyncJob tracking

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-2h3

Implement sync job lifecycle tracking.

**Subtasks:**

1. Implement `createSyncJob(jobType)` - create pending job record
2. Implement `startSyncJob(jobId)` - mark as running, set startedAt
3. Implement `completeSyncJob(jobId, metadata?)` - mark completed, set completedAt
4. Implement `failSyncJob(jobId, error)` - mark failed, store error message
5. Add metadata field for stats (recordsProcessed, etc.)

**Acceptance criteria:**

- Full lifecycle tracking works
- Errors are captured with message

---

## report-860: Implement runFullSync orchestration

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-c2g, report-660, report-noc, report-0ro

Implement `runFullSync()` method.

**Subtasks:**

1. Create sync job record at start
2. Call syncEditorContributions() and capture count
3. Call syncArticlePageviews() and capture count
4. Call syncCommonsUploads() and capture count
5. Update job with completion status and metadata
6. Handle errors and mark job as failed if needed
7. Return summary object with counts

**Acceptance criteria:**

- Full sync completes all steps
- Job tracking reflects actual state

---

## report-55x: Add cron scheduler for daily sync

- Type: task
- Priority: 1
- Labels: backend
- Depends on: report-860

Set up automated daily sync.

**Subtasks:**

1. Install cron library (node-cron or similar)
2. Create `apps/api/src/scheduler.ts`
3. Default schedule: `0 2 * * *` (2 AM UTC)
4. Call SyncService.runFullSync() on schedule
5. Add logging for scheduled runs
6. Make schedule configurable via SYNC_SCHEDULE env var

**Acceptance criteria:**

- Sync runs automatically on schedule
- Schedule is configurable

---

# Phase 4: Stats Service

## report-0k8: Create StatsService class skeleton

- Type: task
- Priority: 0
- Labels: backend
- Depends on: none

Create StatsService class in `apps/api/src/services/stats.service.ts`.

**Subtasks:**

1. Create `stats.service.ts` file
2. Define StatsService class with constructor(prisma)
3. Define StatsFilter interface (startDate, endDate, wikiProject, editorId)
4. Add method stubs: getOverallStats, getStatsByWikiProject, getStatsByEditor, getTimeSeries
5. Export types for response objects

**Acceptance criteria:**

- Class compiles and can be instantiated
- All method signatures defined with proper types

---

## report-zzf: Implement getOverallStats

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-0k8

Implement `getOverallStats(filters?)` method.

**Subtasks:**

1. Query total edits count from Contribution table
2. Query total wordsAdded sum from Contribution
3. Query total pageviews sum from Pageview (for created articles)
4. Query articles created count (isCreation=true)
5. Query distinct articles modified count
6. Query Commons uploads count
7. Apply date range filter if provided
8. Return typed OverallStats object

**Acceptance criteria:**

- All metrics calculated correctly
- Date filter works

---

## report-e3u: Implement getStatsByWikiProject

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-0k8

Implement `getStatsByWikiProject(filters?)` method.

**Subtasks:**

1. Group contributions by Article.wikiProject
2. Calculate per-project: edits, wordsAdded, articlesCreated, articlesModified
3. Join with Pageview to get pageviews per project
4. Sort by wordsAdded descending
5. Apply date range filter if provided
6. Return typed WikiProjectStats[]

**Acceptance criteria:**

- Stats grouped correctly by project
- Sorted by words descending

---

## report-5y2: Implement getStatsByEditor

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-0k8

Implement `getStatsByEditor(filters?)` method.

**Subtasks:**

1. Group contributions by editorId
2. Calculate per-editor: edits, wordsAdded, articlesCreated
3. Join with Pageview for pageview totals
4. Join with CommonsUpload for upload counts
5. Include editor info (username, displayName)
6. Apply date range and wikiProject filters
7. Sort by wordsAdded descending
8. Return typed EditorStats[]

**Acceptance criteria:**

- All metrics per editor calculated
- Filters work correctly

---

## report-dih: Implement getTimeSeries

- Type: task
- Priority: 1
- Labels: backend
- Depends on: report-0k8

Implement `getTimeSeries(filters?, granularity?)` method.

**Subtasks:**

1. Define granularity options: 'daily' | 'weekly' | 'monthly'
2. Group contributions by date with granularity
3. Calculate per-period: edits, wordsAdded, articlesCreated
4. Join with Pageview for pageviews per period
5. Apply filters
6. Return typed TimeSeriesPoint[]

**Acceptance criteria:**

- All granularities work
- Data points sorted by date

---

# Phase 5: API Endpoints

## report-oxq: Create GET /api/editors endpoint

- Type: task
- Priority: 0
- Labels: backend
- Depends on: none

Implement list editors endpoint.

**Subtasks:**

1. Create `apps/api/src/routes/editors.ts`
2. Set up Hono route group `/api/editors`
3. Implement GET handler
4. Add query params: ?isActive=true, ?search=username
5. Query editors from database with filters
6. Return JSON array of editor objects

**Acceptance criteria:**

- Lists editors with optional filters
- Returns proper JSON response

---

## report-abe: Create POST /api/editors endpoint

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-oxq, report-11q

Implement create editor endpoint.

**Subtasks:**

1. Add POST handler to editors route
2. Parse and validate body with Zod: { username, displayName? }
3. Check for duplicate username
4. Create editor record in database
5. Return created editor object with 201 status

**Acceptance criteria:**

- Creates new editor
- Validates input
- Prevents duplicates

---

## report-95i: Create GET /api/editors/:id endpoint

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-oxq

Implement get single editor endpoint.

**Subtasks:**

1. Add GET /:id handler to editors route
2. Validate id parameter
3. Query editor by id
4. Return 404 if not found
5. Return editor object with basic stats summary

**Acceptance criteria:**

- Returns single editor
- Proper 404 handling

---

## report-kos: Create PUT /api/editors/:id endpoint

- Type: task
- Priority: 1
- Labels: backend
- Depends on: report-oxq, report-11q

Implement update editor endpoint.

**Subtasks:**

1. Add PUT /:id handler
2. Validate body with Zod: { displayName?, isActive? }
3. Update editor record
4. Return 404 if not found
5. Return updated editor object

**Acceptance criteria:**

- Updates editor fields
- Validates input

---

## report-304: Create DELETE /api/editors/:id endpoint

- Type: task
- Priority: 1
- Labels: backend
- Depends on: report-oxq

Implement delete/deactivate editor endpoint.

**Subtasks:**

1. Add DELETE /:id handler
2. Soft delete: set isActive=false (preserve data)
3. Return 404 if not found
4. Return 204 No Content on success

**Acceptance criteria:**

- Soft deletes by deactivating
- Data is preserved

---

## report-aa4: Create GET /api/stats/overall endpoint

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-zzf, report-11q

Implement overall stats endpoint.

**Subtasks:**

1. Create `apps/api/src/routes/stats.ts`
2. Set up Hono route group `/api/stats`
3. Add GET /overall handler
4. Parse query params: ?startDate, ?endDate, ?wikiProject
5. Call StatsService.getOverallStats(filters)
6. Return JSON with totals, byWikiProject array, and meta

**Acceptance criteria:**

- Returns overall stats
- Filters work

---

## report-00x: Create GET /api/stats/editors endpoint

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-5y2, report-11q

Implement stats by editor endpoint.

**Subtasks:**

1. Add GET /editors handler to stats routes
2. Parse query params: ?startDate, ?endDate, ?wikiProject, ?page, ?limit
3. Call StatsService.getStatsByEditor(filters)
4. Implement pagination
5. Return paginated JSON response

**Acceptance criteria:**

- Returns editor stats
- Pagination works

---

## report-b98: Create GET /api/stats/editors/:id endpoint

- Type: task
- Priority: 0
- Labels: backend
- Depends on: report-5y2, report-11q

Implement single editor stats endpoint.

**Subtasks:**

1. Add GET /editors/:id handler
2. Parse query params for filters
3. Call StatsService.getStatsByEditor with editorId filter
4. Return 404 if editor not found
5. Return detailed stats object

**Acceptance criteria:**

- Returns stats for specific editor
- Includes breakdown by wiki project

---

## report-fys: Create GET /api/stats/timeseries endpoint

- Type: task
- Priority: 1
- Labels: backend
- Depends on: report-dih, report-11q

Implement time-series stats endpoint.

**Subtasks:**

1. Add GET /timeseries handler
2. Parse query params: ?startDate, ?endDate, ?wikiProject, ?granularity
3. Default granularity to 'daily'
4. Call StatsService.getTimeSeries(filters, granularity)
5. Return JSON array of data points

**Acceptance criteria:**

- Returns time series data
- Granularity option works

---

## report-q25: Create POST /api/sync/trigger endpoint

- Type: task
- Priority: 1
- Labels: backend
- Depends on: report-860, report-11q

Implement manual sync trigger endpoint.

**Subtasks:**

1. Create `apps/api/src/routes/sync.ts`
2. Set up Hono route group `/api/sync`
3. Add POST /trigger handler
4. Parse body: { jobType?: 'full' | 'contributions' | 'pageviews' | 'commons' }
5. Start sync job in background (don't await)
6. Return sync job object with ID immediately

**Acceptance criteria:**

- Triggers sync without blocking
- Returns job ID for tracking

---

## report-juv: Create GET /api/sync/status endpoint

- Type: task
- Priority: 1
- Labels: backend
- Depends on: report-0ro

Implement sync status endpoint.

**Subtasks:**

1. Add GET /status handler
2. Query latest sync job from database
3. Return job status: status, startedAt, completedAt, error

**Acceptance criteria:**

- Returns latest sync status
- Shows error if failed

---

## report-y5a: Create GET /api/sync/history endpoint

- Type: task
- Priority: 2
- Labels: backend
- Depends on: report-0ro

Implement sync history endpoint.

**Subtasks:**

1. Add GET /history handler
2. Parse query params: ?limit, ?jobType
3. Query recent sync jobs
4. Return JSON array of job records

**Acceptance criteria:**

- Returns sync job history
- Filters work

---

## report-11q: Add Zod validation schemas for API

- Type: task
- Priority: 0
- Labels: backend
- Depends on: none

Create Zod schemas for all API endpoints.

**Subtasks:**

1. Create `apps/api/src/schemas/` directory
2. Create `editor.schema.ts` with CreateEditor, UpdateEditor schemas
3. Create `stats.schema.ts` with StatsFilter schema
4. Create `sync.schema.ts` with TriggerSync schema
5. Create `common.schema.ts` with pagination, dateRange schemas
6. Export all schemas from index.ts

**Acceptance criteria:**

- All request bodies have validation
- Query params have validation
- Types are exported

---

## report-rzq: Add error handling middleware

- Type: task
- Priority: 0
- Labels: backend
- Depends on: none

Create error handling middleware for Hono.

**Subtasks:**

1. Create `apps/api/src/middleware/error-handler.ts`
2. Catch Zod validation errors - return 400
3. Catch Prisma not found errors - return 404
4. Catch generic errors - return 500
5. Format response: { success: false, error: { code, message } }
6. Add logging for errors
7. Register middleware in main app

**Acceptance criteria:**

- All errors return consistent format
- No stack traces in production

---

# Phase 7: Frontend

## report-k0h: Initialize TanStack Router app ✅

- Type: task
- Priority: 1
- Labels: frontend
- Status: CLOSED

Frontend initialized with TanStack Router + Vite in `apps/web/`.

---

## report-5p7: Set up Tailwind CSS ✅

- Type: task
- Priority: 1
- Labels: frontend
- Status: CLOSED

Tailwind CSS v4 configured in `apps/web/`.

---

## report-8ph: Set up shadcn/ui components ✅

- Type: task
- Priority: 1
- Labels: frontend
- Status: CLOSED

shadcn/ui configured with new-york style in `apps/web/`.

---

## report-523: Create layout component with navigation

- Type: task
- Priority: 1
- Labels: frontend
- Depends on: none

Enhance main layout component with proper navigation.

**Current state:** Basic Header.tsx exists with hamburger menu.

**Subtasks:**

1. Update Header.tsx with OKA Stats Platform branding (replace TanStack logo)
2. Add navigation links: Dashboard, Editors, Admin
3. Style with shadcn/ui components (Button, NavigationMenu)
4. Add responsive mobile menu
5. Add Footer component with version info
6. Update \_\_root.tsx layout structure

**Acceptance criteria:**

- Clean navigation between pages
- Mobile responsive
- OKA branding applied

---

## report-afh: Create Dashboard page

- Type: task
- Priority: 1
- Labels: frontend
- Depends on: report-523, report-aa4

Create main dashboard page.

**Subtasks:**

1. Update `apps/web/src/routes/index.tsx` for dashboard
2. Set up TanStack Query client and provider
3. Create API client utility in `apps/web/src/lib/api.ts`
4. Add useQuery hook for /api/stats/overall
5. Add loading skeleton state
6. Add error state handling
7. Integrate stats cards, table, and chart components

**Acceptance criteria:**

- Dashboard fetches and displays data
- Loading and error states work

---

## report-bf8: Create stats summary cards component

- Type: task
- Priority: 1
- Labels: frontend
- Depends on: none

Create reusable stats cards component.

**Subtasks:**

1. Create `apps/web/src/components/stats/StatsCards.tsx`
2. Use shadcn/ui Card component
3. Display: Edits, Words Added, Pageviews, Articles Created
4. Add icons for each stat (lucide-react)
5. Create loading skeleton variant
6. Make responsive with grid layout

**Acceptance criteria:**

- Displays all 4 main stats
- Has loading skeleton
- Responsive grid

---

## report-ch5: Create stats by wiki project table

- Type: task
- Priority: 1
- Labels: frontend
- Depends on: none

Create sortable data table component using TanStack Table.

**Subtasks:**

1. Install @tanstack/react-table
2. Create `apps/web/src/components/stats/WikiProjectTable.tsx`
3. Define columns: Wiki Project, Edits, Words, Pageviews, Created, Modified
4. Implement sorting with TanStack Table
5. Add total row at bottom
6. Use shadcn/ui Table components for styling
7. Make responsive

**Acceptance criteria:**

- Table sorts on column click
- Shows totals
- Responsive

---

## report-rjo: Create time-series chart component

- Type: task
- Priority: 1
- Labels: frontend
- Depends on: none

Create line chart component using Chart.js.

**Subtasks:**

1. Install chart.js and react-chartjs-2
2. Create `apps/web/src/components/stats/TimeSeriesChart.tsx`
3. Configure line chart with multiple series
4. Add series: edits, words, pageviews over time
5. Make series toggleable with legend
6. Add responsive sizing
7. Style tooltips with formatted values

**Acceptance criteria:**

- Chart renders time series data
- Series can be toggled
- Responsive

---

## report-0rf: Create Editors stats page

- Type: task
- Priority: 1
- Labels: frontend
- Depends on: report-523, report-00x

Create per-editor statistics page.

**Subtasks:**

1. Create `apps/web/src/routes/editors.tsx`
2. Set up route with createFileRoute
3. Add TanStack Query for /api/stats/editors
4. Create editors table with TanStack Table
5. Add search input for filtering
6. Implement pagination controls
7. Add loading and error states

**Acceptance criteria:**

- Shows all editors with stats
- Search works
- Pagination works

---

## report-jeu: Create date range filter component

- Type: task
- Priority: 1
- Labels: frontend
- Depends on: none

Create reusable date range picker component.

**Subtasks:**

1. Install date-fns for date handling
2. Create `apps/web/src/components/filters/DateRangeFilter.tsx`
3. Add start date and end date inputs using shadcn/ui
4. Add preset buttons: Last 7 days, Last 30 days, This year, All time
5. Use TanStack Router search params for state
6. Emit onChange with selected range

**Acceptance criteria:**

- Date inputs work
- Presets work
- Persists in URL

---

## report-6q9: Create wiki project filter component

- Type: task
- Priority: 1
- Labels: frontend
- Depends on: none

Create wiki project dropdown filter.

**Subtasks:**

1. Create `apps/web/src/components/filters/WikiProjectFilter.tsx`
2. Use shadcn/ui Select component
3. Fetch available projects from API
4. Add "All projects" option
5. Use TanStack Router search params
6. Support single selection

**Acceptance criteria:**

- Dropdown lists projects
- Selection persists in URL

---

## report-bhc: Create Admin Editor Management page

- Type: task
- Priority: 2
- Labels: frontend, admin
- Depends on: report-523, report-oxq

Create admin page for editor management.

**Subtasks:**

1. Create `apps/web/src/routes/admin/editors.tsx`
2. Create nested route structure for /admin
3. List all registered editors with status
4. Add edit/delete actions per row
5. Add "Add Editor" button linking to form
6. Use TanStack Query mutations for actions

**Acceptance criteria:**

- Lists all editors
- Can edit/delete from list

---

## report-o7e: Create Add Editor form

- Type: task
- Priority: 2
- Labels: frontend, admin
- Depends on: report-bhc, report-abe

Create form to register new editor.

**Subtasks:**

1. Create `apps/web/src/components/admin/AddEditorForm.tsx`
2. Add fields: Wikipedia username, Display name (optional)
3. Use shadcn/ui Form components
4. Add Zod validation for client-side
5. Use TanStack Query mutation for POST /api/editors
6. Show success/error toast notifications
7. Invalidate editors query on success

**Acceptance criteria:**

- Form validates input
- Creates editor via API
- Shows feedback

---

## report-6x3: Create Bulk Import form

- Type: task
- Priority: 2
- Labels: frontend, admin
- Depends on: report-bhc, report-abe

Create bulk editor import form.

**Subtasks:**

1. Create `apps/web/src/components/admin/BulkImportForm.tsx`
2. Add textarea for pasting usernames (one per line)
3. Parse and preview list before import
4. Show progress indicator during import
5. Process imports sequentially
6. Show summary of successful/failed imports

**Acceptance criteria:**

- Can paste multiple usernames
- Shows preview before import
- Reports results

---

## report-hq5: Create Export to CSV functionality

- Type: task
- Priority: 2
- Labels: frontend
- Depends on: report-afh, report-0rf

Add CSV export feature.

**Subtasks:**

1. Create `apps/web/src/lib/export-csv.ts` utility
2. Add "Export CSV" button to Dashboard
3. Add "Export CSV" button to Editors page
4. Generate CSV from current view data
5. Include all visible columns
6. Filename with date stamp (e.g., oka-stats-2024-01-15.csv)
7. Trigger download in browser

**Acceptance criteria:**

- CSV downloads with correct data
- Works on both pages

---

# Phase 8: Testing & Quality

## report-bkj: Set up ESLint configuration

- Type: task
- Priority: 1
- Labels: tooling
- Depends on: none

Configure ESLint for the monorepo.

**Subtasks:**

1. Install eslint and plugins (@typescript-eslint, eslint-plugin-react)
2. Create root `.eslintrc.cjs` or `eslint.config.js`
3. Configure TypeScript rules
4. Configure React rules for apps/web
5. Add `moon run :lint` task
6. Add to pre-commit hook (optional)

**Acceptance criteria:**

- Lint runs without errors
- Catches common issues

---

## report-41e: Set up Prettier configuration

- Type: task
- Priority: 1
- Labels: tooling
- Depends on: none

Configure Prettier for code formatting.

**Subtasks:**

1. Install prettier
2. Create root `.prettierrc` config
3. Add `.prettierignore` for generated files
4. Add `moon run :format` task
5. Configure VS Code settings for format on save

**Acceptance criteria:**

- Format runs consistently
- Works with VS Code

---

## report-atz: Add API integration tests

- Type: task
- Priority: 2
- Labels: testing
- Depends on: report-oxq, report-aa4, report-q25

Write integration tests for API endpoints.

**Subtasks:**

1. Set up test database configuration
2. Create test fixtures for editors, contributions, etc.
3. Test GET /api/editors endpoints
4. Test POST/PUT/DELETE /api/editors endpoints
5. Test GET /api/stats/\* endpoints
6. Test POST /api/sync/trigger
7. Mock Wikimedia API calls

**Acceptance criteria:**

- All endpoints tested
- Tests are isolated

---

## report-a2r: Add E2E tests for critical flows

- Type: task
- Priority: 2
- Labels: testing
- Depends on: report-afh, report-0rf, report-bhc

Write end-to-end tests.

**Subtasks:**

1. Install Playwright
2. Set up test configuration
3. Test: Dashboard loads and displays stats
4. Test: Editor registration flow
5. Test: Date filter changes data
6. Test: Navigation works

**Acceptance criteria:**

- Critical user flows tested
- Tests run in CI

---

# Phase 9: Deployment

## report-bg2: Create API Dockerfile

- Type: task
- Priority: 2
- Labels: devops
- Depends on: none

Create Dockerfile for API server.

**Subtasks:**

1. Create `apps/api/Dockerfile`
2. Use base image: oven/bun:latest
3. Multi-stage build for smaller image
4. Copy only necessary files (src, package.json)
5. Add health check endpoint (/health)
6. Run as non-root user
7. Expose port 3000

**Acceptance criteria:**

- Docker image builds
- Container starts and responds

---

## report-8xg: Create Web Dockerfile

- Type: task
- Priority: 2
- Labels: devops
- Depends on: none

Create Dockerfile for frontend.

**Subtasks:**

1. Create `apps/web/Dockerfile`
2. Build stage: use node image, run vite build
3. Production stage: use nginx:alpine
4. Copy built assets to nginx html dir
5. Configure nginx for SPA routing (fallback to index.html)
6. Expose port 80

**Acceptance criteria:**

- Docker image builds
- Static files served correctly

---

## report-695: Create docker-compose.yml

- Type: task
- Priority: 2
- Labels: devops
- Depends on: report-bg2, report-8xg

Create docker-compose for local development.

**Subtasks:**

1. Create root `docker-compose.yml`
2. Add api service from apps/api
3. Add web service from apps/web
4. Add postgres service
5. Configure volumes for persistence
6. Set up environment variables
7. Configure network between services

**Acceptance criteria:**

- `docker compose up` starts all services
- Services can communicate

---

## report-w83: Set up GitHub Actions CI/CD

- Type: task
- Priority: 2
- Labels: devops
- Depends on: report-bkj, report-atz

Create GitHub Actions workflows.

**Subtasks:**

1. Create `.github/workflows/ci.yml`
2. Run on pull requests
3. Steps: checkout, setup bun, install deps
4. Run lint (`moon run :lint`)
5. Run type check (`moon check`)
6. Run tests (`moon run :test`)
7. Build Docker images (optional)

**Acceptance criteria:**

- CI runs on PRs
- Catches issues before merge

---

## report-3py: Document Wikimedia Cloud deployment

- Type: task
- Priority: 2
- Labels: devops
- Depends on: report-695

Write deployment documentation.

**Subtasks:**

1. Create `docs/DEPLOYMENT.md`
2. Document Wikimedia Cloud Services setup
3. Document Kubernetes/Toolforge configuration
4. List required environment variables
5. Document database provisioning
6. Add monitoring setup notes
7. Add troubleshooting section

**Acceptance criteria:**

- Deployment steps are clear
- Someone can follow docs to deploy
