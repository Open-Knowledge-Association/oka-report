# OKA Stats Platform - Development Tasks

This document tracks all development tasks for the OKA Stats Platform. Tasks are organized by phase and priority.

## Overview

Based on [HIGH_LEVEL_DESIGN.md](HIGH_LEVEL_DESIGN.md), the platform requires:

- Wikimedia API integration to fetch editor contributions, pageviews, and Commons uploads
- Background sync service to periodically update data
- Stats aggregation service for metrics calculation
- REST API for data access
- Frontend dashboard for visualization

---

## Phase 1: Database & Core Infrastructure ✅

Database schema is complete with migrations applied:

- [x] Editor model
- [x] Article model
- [x] Contribution model
- [x] Pageview model
- [x] CommonsUpload model
- [x] SyncJob model
- [x] User model

---

## Phase 2: Wikimedia API Client

Location: `packages/utils/`

| Task                        | Description                                                 | Priority |
| --------------------------- | ----------------------------------------------------------- | -------- |
| Create WikimediaClient base | HTTP client with User-Agent header per Wikimedia guidelines | P0       |
| getUserContributions()      | Fetch editor contributions from MediaWiki Action API        | P0       |
| getArticleInfo()            | Get article metadata (creator, creation date)               | P0       |
| getPageviews()              | Fetch pageview stats from Wikimedia Pageviews API           | P0       |
| getCommonsUploads()         | Fetch user uploads from Commons API                         | P1       |
| Rate limiting helper        | Exponential backoff for API rate limits                     | P1       |
| Unit tests                  | Test coverage for Wikimedia client                          | P2       |

---

## Phase 3: Background Sync Service

Location: `apps/api/src/services/`

| Task                      | Description                                     | Priority |
| ------------------------- | ----------------------------------------------- | -------- |
| SyncService class         | Base sync service skeleton                      | P0       |
| syncEditorContributions() | Fetch and store contributions for all editors   | P0       |
| syncArticlePageviews()    | Fetch pageviews for articles created by editors | P0       |
| syncCommonsUploads()      | Fetch and store Commons uploads                 | P1       |
| SyncJob tracking          | Create/update sync job records in database      | P0       |
| runFullSync()             | Orchestrate all sync operations                 | P0       |
| Cron scheduler            | Daily automated sync using node-cron            | P1       |

---

## Phase 4: Stats Service

Location: `apps/api/src/services/`

| Task                    | Description                                      | Priority |
| ----------------------- | ------------------------------------------------ | -------- |
| StatsService class      | Base stats service skeleton                      | P0       |
| getOverallStats()       | Aggregate totals (edits, words, pageviews, etc.) | P0       |
| getStatsByWikiProject() | Group stats by Wikipedia language version        | P0       |
| getStatsByEditor()      | Individual editor statistics                     | P0       |
| getTimeSeries()         | Daily/monthly metrics for charts                 | P1       |
| Filtering support       | Date range and wiki project filters              | P1       |

---

## Phase 5: API Endpoints

Location: `apps/api/src/routes/`

### Editor Endpoints

| Endpoint         | Method | Description                 | Priority |
| ---------------- | ------ | --------------------------- | -------- |
| /api/editors     | GET    | List all registered editors | P0       |
| /api/editors     | POST   | Register new editor         | P0       |
| /api/editors/:id | GET    | Get single editor details   | P0       |
| /api/editors/:id | PUT    | Update editor info          | P1       |
| /api/editors/:id | DELETE | Remove editor from tracking | P1       |

### Stats Endpoints

| Endpoint               | Method | Description                        | Priority |
| ---------------------- | ------ | ---------------------------------- | -------- |
| /api/stats/overall     | GET    | Aggregated stats by wiki project   | P0       |
| /api/stats/editors     | GET    | Stats grouped by editor            | P0       |
| /api/stats/editors/:id | GET    | Detailed stats for specific editor | P0       |
| /api/stats/timeseries  | GET    | Time-series data for charts        | P1       |

### Sync Endpoints

| Endpoint          | Method | Description               | Priority |
| ----------------- | ------ | ------------------------- | -------- |
| /api/sync/trigger | POST   | Manually trigger sync job | P1       |
| /api/sync/status  | GET    | Current sync job status   | P1       |
| /api/sync/history | GET    | List past sync jobs       | P2       |

### Infrastructure

| Task                      | Description                        | Priority |
| ------------------------- | ---------------------------------- | -------- |
| Zod validation schemas    | Input validation for all endpoints | P0       |
| Error handling middleware | Consistent error responses         | P0       |

---

## Phase 6: Authentication (Optional for MVP)

| Task                 | Description                             | Priority |
| -------------------- | --------------------------------------- | -------- |
| JWT helper           | Token generation and validation         | P2       |
| POST /api/auth/login | Authentication endpoint                 | P2       |
| Auth middleware      | Protect routes requiring authentication | P2       |
| Role-based access    | Admin/editor/viewer permissions         | P2       |

---

## Phase 7: Frontend

Location: `apps/web/`

### Setup

| Task                    | Description                   | Priority |
| ----------------------- | ----------------------------- | -------- |
| Initialize React + Vite | Frontend application scaffold | P1       |
| Tailwind CSS setup      | Styling configuration         | P1       |
| Layout component        | Navigation and page structure | P1       |

### Dashboard Page

| Task                | Description                                 | Priority |
| ------------------- | ------------------------------------------- | -------- |
| Dashboard page      | Main overall stats view                     | P1       |
| Stats summary cards | Edits, words, pageviews, articles cards     | P1       |
| Stats by wiki table | Table showing metrics per Wikipedia version | P1       |
| Time-series chart   | Line chart using Chart.js                   | P1       |

### Editor Stats Page

| Task                | Description                 | Priority |
| ------------------- | --------------------------- | -------- |
| Editors page        | Per-editor statistics table | P1       |
| Date range filter   | Filter by date range        | P1       |
| Wiki project filter | Filter by Wikipedia version | P1       |

### Admin Panel

| Task                   | Description                     | Priority |
| ---------------------- | ------------------------------- | -------- |
| Editor management page | List/add/remove editors         | P2       |
| Add editor form        | Single editor registration      | P2       |
| Bulk import form       | Import multiple editors at once | P2       |
| Export to CSV          | Download stats as CSV           | P2       |

---

## Phase 8: Testing & Quality

| Task                   | Description              | Priority |
| ---------------------- | ------------------------ | -------- |
| API integration tests  | Test API endpoints       | P2       |
| E2E tests              | Critical user flow tests | P2       |
| ESLint configuration   | Code linting setup       | P1       |
| Prettier configuration | Code formatting setup    | P1       |

---

## Phase 9: Deployment

| Task                 | Description                      | Priority |
| -------------------- | -------------------------------- | -------- |
| API Dockerfile       | Container for API server         | P2       |
| Web Dockerfile       | Container for frontend           | P2       |
| docker-compose.yml   | Local development setup          | P2       |
| GitHub Actions CI/CD | Automated testing and deployment | P2       |
| Wikimedia Cloud docs | Deployment documentation         | P2       |

---

## Recommended Implementation Order

1. **Phase 2** - Wikimedia API Client (foundation for data fetching)
2. **Phase 3** - Sync Service (populate database with real data)
3. **Phase 4** - Stats Service (calculate metrics)
4. **Phase 5** - API Endpoints (expose data via REST)
5. **Phase 7** - Frontend (visualize data)
6. **Phase 6, 8, 9** - Auth, Testing, Deployment (polish and production)

---

## Quick Start for Development

```bash
# Install dependencies
bun install

# Start database (ensure PostgreSQL is running)
cd packages/db && bun run db:migrate

# Start API server
cd apps/api && bun run dev

# Start web (once implemented)
cd apps/web && bun run dev
```
