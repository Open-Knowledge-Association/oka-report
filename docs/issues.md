# Phase 2: Wikimedia API Client

## Create WikimediaClient base class

- Type: task
- Priority: 0
- Labels: api-client, backend

Create the base WikimediaClient class in `packages/utils/` with:

- Configurable base URL for different Wikipedia projects
- User-Agent header per Wikimedia guidelines: `OKA-Stats/1.0 (https://oka.wiki; contact@oka.wiki)`
- Generic request method with error handling
- TypeScript types for API responses

Reference: [HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) Section 3

---

## Implement getUserContributions in WikimediaClient

- Type: task
- Priority: 0
- Labels: api-client, backend

Implement `getUserContributions(username, options)` method:

- Endpoint: `GET /w/api.php?action=query&list=usercontribs`
- Parameters: ucuser, ucprop (ids|title|timestamp|sizediff), uclimit, ucstart, ucend
- Handle pagination with continue token
- Return typed array of contribution objects

Reference: MediaWiki API docs, [HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) Section 3.1

---

## Implement getArticleInfo in WikimediaClient

- Type: task
- Priority: 0
- Labels: api-client, backend

Implement `getArticleInfo(title, wikiProject)` method:

- Get article creation date and creator
- Endpoint: `GET /w/api.php?action=query&titles={title}&prop=revisions&rvlimit=1&rvdir=newer`
- Return article metadata including pageId, creator username, creation timestamp

Reference: [HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) Section 3.1

---

## Implement getPageviews in WikimediaClient

- Type: task
- Priority: 0
- Labels: api-client, backend

Implement `getPageviews(article, project, startDate, endDate)` method:

- Base URL: `https://wikimedia.org/api/rest_v1`
- Endpoint: `/metrics/pageviews/per-article/{project}/{access}/{agent}/{article}/{granularity}/{start}/{end}`
- Parameters: project, access=all-access, agent=user, granularity=daily
- Return array of daily pageview counts

Reference: Wikimedia Pageviews API, [HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) Section 3.2

---

## Implement getCommonsUploads in WikimediaClient

- Type: task
- Priority: 1
- Labels: api-client, backend

Implement `getCommonsUploads(username)` method:

- Base URL: `https://commons.wikimedia.org/w/api.php`
- Endpoint: `GET /w/api.php?action=query&list=allimages&aiuser={username}`
- Parameters: aisort=timestamp, aiprop=timestamp|url|size
- Return array of upload objects with fileName, fileUrl, fileSize, uploadedAt

Reference: [HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) Section 3.3

---

## Add rate limiting helper with exponential backoff

- Type: task
- Priority: 1
- Labels: api-client, backend

Create rate limiting utility for Wikimedia API calls:

- Implement exponential backoff on 429 responses
- Respect Retry-After headers
- Add configurable delay between requests
- Queue requests to avoid concurrent limit violations

Reference: Wikimedia API rate limits - 500 req/hour anonymous

---

## Add unit tests for Wikimedia API client

- Type: task
- Priority: 2
- Labels: api-client, testing

Write unit tests for WikimediaClient:

- Mock HTTP responses for each method
- Test error handling (network errors, API errors, rate limits)
- Test pagination handling
- Test date formatting and parameter building

---

# Phase 3: Background Sync Service

## Create SyncService class skeleton

- Type: task
- Priority: 0
- Labels: sync, backend

Create SyncService class in `apps/api/src/services/sync.service.ts`:

- Constructor accepting Prisma client and WikimediaClient
- Method stubs for all sync operations
- Error handling and logging setup

---

## Implement syncEditorContributions

- Type: task
- Priority: 0
- Labels: sync, backend

Implement `syncEditorContributions(editorId?, since?)` method:

- Fetch all active editors from database (or single editor if ID provided)
- For each editor, call WikimediaClient.getUserContributions()
- Upsert contributions to database
- Create/update Article records as needed
- Track which articles were created by which editors

---

## Implement syncArticlePageviews

- Type: task
- Priority: 0
- Labels: sync, backend

Implement `syncArticlePageviews(articleId?, since?)` method:

- Fetch articles created by tracked editors
- For each article, call WikimediaClient.getPageviews()
- Upsert daily pageview records to database
- Only fetch pageviews for articles where isCreation=true

Note: Per requirements, pageviews only counted for articles CREATED by editors, not just modified.

---

## Implement syncCommonsUploads

- Type: task
- Priority: 1
- Labels: sync, backend

Implement `syncCommonsUploads(editorId?)` method:

- Fetch active editors from database
- For each editor, call WikimediaClient.getCommonsUploads()
- Upsert CommonsUpload records to database
- Handle duplicate detection by fileName

---

## Implement SyncJob tracking

- Type: task
- Priority: 0
- Labels: sync, backend

Implement sync job lifecycle tracking:

- `createSyncJob(jobType)` - create pending job record
- `startSyncJob(jobId)` - mark as running, set startedAt
- `completeSyncJob(jobId, metadata?)` - mark completed, set completedAt
- `failSyncJob(jobId, error)` - mark failed, store error message

---

## Implement runFullSync orchestration

- Type: task
- Priority: 0
- Labels: sync, backend

Implement `runFullSync()` method:

- Create sync job record
- Run syncEditorContributions()
- Run syncArticlePageviews()
- Run syncCommonsUploads()
- Update sync job status on completion/failure
- Return summary of synced records

---

## Add cron scheduler for daily sync

- Type: task
- Priority: 1
- Labels: sync, backend

Set up automated daily sync:

- Install node-cron or use Bun's built-in scheduling
- Schedule: `0 2 * * *` (2 AM UTC daily)
- Call SyncService.runFullSync()
- Add logging for scheduled runs
- Make schedule configurable via env var SYNC_SCHEDULE

---

# Phase 4: Stats Service

## Create StatsService class skeleton

- Type: task
- Priority: 0
- Labels: stats, backend

Create StatsService class in `apps/api/src/services/stats.service.ts`:

- Constructor accepting Prisma client
- Method stubs for all stats queries
- Common filter types (dateRange, wikiProject, editorId)

---

## Implement getOverallStats

- Type: task
- Priority: 0
- Labels: stats, backend

Implement `getOverallStats(filters?)` method returning:

- Total edits (count of contributions)
- Total words added (sum of wordsAdded)
- Total pageviews (sum of pageviews for created articles)
- Articles created (count where isCreation=true)
- Articles modified (distinct article count)
- Commons uploads (count)

Support optional date range filter.

---

## Implement getStatsByWikiProject

- Type: task
- Priority: 0
- Labels: stats, backend

Implement `getStatsByWikiProject(filters?)` method:

- Group all metrics by Article.wikiProject
- Return array of stats objects, one per wiki project
- Sort by wordsAdded descending (as per requirements)
- Support date range filter

---

## Implement getStatsByEditor

- Type: task
- Priority: 0
- Labels: stats, backend

Implement `getStatsByEditor(filters?)` method:

- Group all metrics by Editor
- Return array with editor info + their stats
- Include: edits, wordsAdded, pageviews, articlesCreated, commonsUploads
- Support date range and wikiProject filters
- Sort by wordsAdded descending

---

## Implement getTimeSeries

- Type: task
- Priority: 1
- Labels: stats, backend

Implement `getTimeSeries(filters?, granularity?)` method:

- Return metrics aggregated by date
- Granularity options: daily, weekly, monthly
- Include: edits, wordsAdded, pageviews, articlesCreated per period
- Support date range and wikiProject filters

---

# Phase 5: API Endpoints

## Create GET /api/editors endpoint

- Type: task
- Priority: 0
- Labels: api, backend

Implement list editors endpoint:

- Route: GET /api/editors
- Query params: ?isActive=true, ?search=username
- Response: array of editor objects
- Include basic stats summary per editor (optional)

---

## Create POST /api/editors endpoint

- Type: task
- Priority: 0
- Labels: api, backend

Implement create editor endpoint:

- Route: POST /api/editors
- Body: { username, displayName? }
- Validate username exists on Wikipedia (optional)
- Response: created editor object
- Trigger initial sync for new editor (optional)

---

## Create GET /api/editors/:id endpoint

- Type: task
- Priority: 0
- Labels: api, backend

Implement get single editor endpoint:

- Route: GET /api/editors/:id
- Response: editor object with full details
- Include recent contributions summary

---

## Create PUT /api/editors/:id endpoint

- Type: task
- Priority: 1
- Labels: api, backend

Implement update editor endpoint:

- Route: PUT /api/editors/:id
- Body: { displayName?, isActive? }
- Response: updated editor object

---

## Create DELETE /api/editors/:id endpoint

- Type: task
- Priority: 1
- Labels: api, backend

Implement delete/deactivate editor endpoint:

- Route: DELETE /api/editors/:id
- Soft delete: set isActive=false (preserve data)
- Response: 204 No Content

---

## Create GET /api/stats/overall endpoint

- Type: task
- Priority: 0
- Labels: api, backend

Implement overall stats endpoint:

- Route: GET /api/stats/overall
- Query params: ?startDate, ?endDate, ?wikiProject
- Response: totals object + byWikiProject array
- Include meta with dateRange and generatedAt

Reference: [HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) Section 6.3

---

## Create GET /api/stats/editors endpoint

- Type: task
- Priority: 0
- Labels: api, backend

Implement stats by editor endpoint:

- Route: GET /api/stats/editors
- Query params: ?startDate, ?endDate, ?wikiProject, ?page, ?limit
- Response: paginated array of editor stats
- Sort by wordsAdded descending

---

## Create GET /api/stats/editors/:id endpoint

- Type: task
- Priority: 0
- Labels: api, backend

Implement single editor stats endpoint:

- Route: GET /api/stats/editors/:id
- Query params: ?startDate, ?endDate, ?wikiProject
- Response: detailed stats for specific editor
- Include breakdown by wiki project

---

## Create GET /api/stats/timeseries endpoint

- Type: task
- Priority: 1
- Labels: api, backend

Implement time-series stats endpoint:

- Route: GET /api/stats/timeseries
- Query params: ?startDate, ?endDate, ?wikiProject, ?granularity
- Response: array of data points with date and metrics
- Default granularity: daily

---

## Create POST /api/sync/trigger endpoint

- Type: task
- Priority: 1
- Labels: api, backend

Implement manual sync trigger endpoint:

- Route: POST /api/sync/trigger
- Body: { jobType?: 'full' | 'contributions' | 'pageviews' | 'commons' }
- Start sync job in background
- Response: sync job object with ID

---

## Create GET /api/sync/status endpoint

- Type: task
- Priority: 1
- Labels: api, backend

Implement sync status endpoint:

- Route: GET /api/sync/status
- Response: latest sync job status
- Include: status, startedAt, completedAt, error

---

## Create GET /api/sync/history endpoint

- Type: task
- Priority: 2
- Labels: api, backend

Implement sync history endpoint:

- Route: GET /api/sync/history
- Query params: ?limit, ?jobType
- Response: array of recent sync jobs

---

## Add Zod validation schemas for API

- Type: task
- Priority: 0
- Labels: api, backend

Create Zod schemas for all API endpoints:

- Request body validation
- Query parameter validation
- Response type definitions
- Shared filter schemas (dateRange, pagination)

Location: `apps/api/src/schemas/`

---

## Add error handling middleware

- Type: task
- Priority: 0
- Labels: api, backend

Create error handling middleware for Hono:

- Catch and format validation errors
- Handle database errors
- Handle not found errors
- Consistent error response format: { success: false, error: { code, message } }

---

# Phase 7: Frontend

## Initialize TanStack Start app

- Type: task
- Priority: 1
- Labels: frontend

Set up frontend application in `apps/web/` using TanStack Start:

- Initialize with TanStack Start (full-stack React framework)
- Configure path aliases
- Set up API client with TanStack Query for backend communication
- Add environment variable support
- TanStack Router for file-based routing

TanStack Start features:

- Server-side rendering (SSR)
- File-based routing
- Built-in data fetching with TanStack Query
- TypeScript first
- Vinxi/Nitro as the underlying server

---

## Set up Tailwind CSS

- Type: task
- Priority: 1
- Labels: frontend

Configure Tailwind CSS for TanStack Start:

- Install tailwindcss, postcss, autoprefixer
- Create tailwind.config.js compatible with TanStack Start
- Set up base styles and CSS variables
- Configure for production build optimization
- Add @tailwindcss/forms plugin for form styling

---

## Create layout component with navigation

- Type: task
- Priority: 1
- Labels: frontend

Create main layout component with TanStack Router:

- Root layout using TanStack Router's createRootRoute
- Header with OKA Stats Platform branding
- Navigation links: Dashboard, Editors, Admin (using Link component)
- Responsive sidebar/navbar
- Footer with version info
- Outlet for nested routes

---

## Create Dashboard page

- Type: task
- Priority: 1
- Labels: frontend

Create main dashboard page with TanStack:

- Route: / (index route)
- Use TanStack Query for data fetching from /api/stats/overall
- Use createFileRoute for route definition
- Include stats cards, table, and chart components
- Add date range filter controls with URL search params
- Loading and error states with TanStack Query

---

## Create stats summary cards component

- Type: task
- Priority: 1
- Labels: frontend

Create reusable stats cards component:

- Display: Edits, Words Added, Pageviews, Articles Created
- Show trend indicator (up/down percentage)
- Responsive grid layout
- Loading skeleton state

---

## Create stats by wiki project table

- Type: task
- Priority: 1
- Labels: frontend

Create sortable data table component using TanStack Table:

- Columns: Wiki Project, Edits, Words, Pageviews, Created, Modified
- Sortable columns using TanStack Table (default: words descending)
- Total row at bottom
- TypeScript types for table data
- Responsive design with Tailwind

---

## Create time-series chart component

- Type: task
- Priority: 1
- Labels: frontend

Create line chart component using Chart.js:

- Multiple series: edits, words, pageviews over time
- Toggleable series visibility
- Responsive sizing
- Tooltip with formatted values

---

## Create Editors stats page

- Type: task
- Priority: 1
- Labels: frontend

Create per-editor statistics page with TanStack:

- Route: /editors using createFileRoute
- Use TanStack Query to fetch from /api/stats/editors
- Use TanStack Table for editor stats display
- Include search/filter controls using URL search params
- Pagination support with TanStack Table

---

## Create date range filter component

- Type: task
- Priority: 1
- Labels: frontend

Create reusable date range picker component:

- Start date and end date inputs
- Preset options: Last 7 days, Last 30 days, This year, All time
- Use TanStack Router search params for state management
- Apply filter triggers route navigation with updated params
- Compatible with TanStack Query cache invalidation

---

## Create wiki project filter component

- Type: task
- Priority: 1
- Labels: frontend

Create wiki project dropdown filter component:

- Fetch available projects from API using TanStack Query
- Multi-select or single select option
- "All projects" option
- Use TanStack Router search params for state
- Integrate with TanStack Query for data refetching

---

## Create Admin Editor Management page

- Type: task
- Priority: 2
- Labels: frontend, admin

Create admin page for editor management:

- Route: /admin/editors using createFileRoute
- Use TanStack Query for fetching and mutating editors
- List all registered editors with status
- Add/Edit/Remove editor actions with mutations
- Bulk import form
- Optimistic updates with TanStack Query

---

## Create Add Editor form

- Type: task
- Priority: 2
- Labels: frontend, admin

Create form to register new editor:

- Fields: Wikipedia username, Display name (optional)
- Validate username format
- Use TanStack Query mutation for POST /api/editors
- Show success/error feedback with toast notifications
- Invalidate editors query on success

---

## Create Bulk Import form

- Type: task
- Priority: 2
- Labels: frontend, admin

Create bulk editor import form:

- Textarea for pasting usernames (one per line)
- Preview list before import
- Progress indicator during import
- Summary of successful/failed imports

---

## Create Export to CSV functionality

- Type: task
- Priority: 2
- Labels: frontend

Add CSV export feature:

- Export current view data to CSV
- Button on Dashboard and Editors pages
- Include all visible columns
- Filename with date stamp

---

# Phase 8: Testing & Quality

## Set up ESLint configuration

- Type: task
- Priority: 1
- Labels: tooling

Configure ESLint for the monorepo:

- TypeScript support
- React rules for frontend
- Shared config in root
- Pre-commit hook integration

---

## Set up Prettier configuration

- Type: task
- Priority: 1
- Labels: tooling

Configure Prettier for code formatting:

- Shared config in root .prettierrc
- Integration with ESLint
- Format on save in VS Code
- Pre-commit hook

---

## Add API integration tests

- Type: task
- Priority: 2
- Labels: testing

Write integration tests for API endpoints:

- Test each endpoint with valid/invalid inputs
- Use test database
- Mock Wikimedia API calls
- Test authentication (when implemented)

---

## Add E2E tests for critical flows

- Type: task
- Priority: 2
- Labels: testing

Write end-to-end tests:

- Dashboard loads and displays data
- Editor registration flow
- Filter functionality
- Use Playwright or Cypress

---

# Phase 9: Deployment

## Create API Dockerfile

- Type: task
- Priority: 2
- Labels: devops

Create Dockerfile for API server:

- Base image: oven/bun
- Multi-stage build for smaller image
- Copy only necessary files
- Health check endpoint
- Non-root user

---

## Create Web Dockerfile

- Type: task
- Priority: 2
- Labels: devops

Create Dockerfile for frontend:

- Build stage with Node/Bun
- Production stage with nginx
- Copy built assets
- Configure nginx for SPA routing

---

## Create docker-compose.yml

- Type: task
- Priority: 2
- Labels: devops

Create docker-compose for local development:

- API service
- Web service
- PostgreSQL database
- Volume mounts for development
- Environment variable management

---

## Set up GitHub Actions CI/CD

- Type: task
- Priority: 2
- Labels: devops

Create GitHub Actions workflows:

- Run tests on PR
- Lint and type check
- Build Docker images
- Deploy to staging/production

---

## Document Wikimedia Cloud deployment

- Type: task
- Priority: 2
- Labels: docs, devops

Write deployment documentation:

- Wikimedia Cloud Services setup steps
- Kubernetes configuration
- Database provisioning
- Environment variables
- Monitoring setup
