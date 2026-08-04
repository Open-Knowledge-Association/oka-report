# OKA Stats Platform - High-Level Design Document

> 📋 **Product Requirements Document**: See [PRD Doc](https://docs.google.com/document/d/1E_9ZE0Kc_fP05CBsUGHtwdhETrNZVDy_ee7ug_q0UKY/edit?tab=t.0#heading=h.4wbw0bxdr2eg) for project overview and requirements.

## Table of Contents

- [1. System Overview](#1-system-overview)
- [2. Technology Stack](#2-technology-stack)
- [3. External APIs](#3-external-apis)
- [4. Database Design](#4-database-design)
- [5. System Architecture](#5-system-architecture)
- [6. API Design](#6-api-design)
- [7. Data Flow](#7-data-flow)
- [8. UI Mockups](#8-ui-mockups)
- [9. Editor Management](#9-editor-management)
- [10. Deployment Architecture](#10-deployment-architecture)
- [11. Security Considerations](#11-security-considerations)
- [12. Limitations & Constraints](#12-limitations--constraints)

---

## 1. System Overview

The OKA Stats Platform is a comprehensive solution for tracking Wikipedia editing impact. The system automatically collects editor contributions across all Wikipedia language editions and calculates key metrics for organizational reporting.

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           OKA Stats Platform                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   Frontend   │───▶│   Hono API   │───▶│      PostgreSQL DB       │ │
│  │   (Web App)  │◀───│   Server     │◀───│   (Prisma ORM)           │ │
│  └──────────────┘     └──────┬───────┘     └──────────────────────────┘ │
│                              │                                          │
│                              │                                          │
│                              ▼                                          │
│                    ┌─────────────────────┐                              │
│                    │   Background Jobs   │                              │
│                    │   (Data Sync)       │                              │
│                    └──────────┬──────────┘                              │
│                               │                                         │
└───────────────────────────────┼─────────────────────────────────────────┘
                                │
                                ▼
            ┌───────────────────────────────────────────┐
            │          Wikimedia APIs                   │
            ├───────────────────────────────────────────┤
            │  • MediaWiki API (Edit History)           │
            │  • Pageviews API (Article Statistics)     │
            │  • Commons API (Media Uploads)            │
            └───────────────────────────────────────────┘
```

---

## 2. Technology Stack

### Backend

| Component       | Technology | Purpose                                                                                                                                       | Alternatives Considered                                                                                                       |
| --------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Runtime         | Bun        | Fastest JS runtime, native TypeScript support, built-in bundler reduces tooling complexity                                                    | Node.js (slower startup, requires TS compilation), Deno (smaller ecosystem)                                                   |
| API Framework   | Hono       | Ultra-lightweight (14kb), edge-ready, excellent TypeScript support, Bun-optimized                                                             | Express (heavier, older API design), Fastify (good but less Bun-optimized), Elysia (newer, less mature)                       |
| ORM             | Prisma     | Type-safe queries with auto-generated types, excellent migration system, visual Studio tool for debugging                                     | Drizzle (newer, less documentation), TypeORM (verbose, weaker type inference), Kysely (query builder only, no migrations)     |
| Database        | PostgreSQL | Industry standard for relational data, excellent JSON support, available on Wikimedia Cloud Services. Required for production hosting target. | SQLite (no concurrent writes), MySQL (less feature-rich JSON support), MongoDB (document DB not ideal for relational metrics) |
| Task Scheduling | node-cron  | Simple, reliable cron-style scheduling, sufficient for daily sync jobs                                                                        | BullMQ (overkill for our needs), Agenda (MongoDB dependency)                                                                  |
| Validation      | Zod        | Runtime + compile-time validation, excellent TypeScript type inference, integrates seamlessly with Hono                                       | Yup (weaker TypeScript support), io-ts (steeper learning curve), Valibot (newer, smaller community)                           |

### Frontend

| Component     | Technology      | Purpose                                                                                                 | Alternatives Considered                                                                                |
| ------------- | --------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Framework     | TanStack Start  | Full-stack React with SSR, file-based routing, excellent TypeScript integration, built-in data fetching | Next.js (heavier, Vercel-focused), Remix (less type-safe routing), Vite + React (no SSR)               |
| Routing       | TanStack Router | File-based routing with full type safety, integrated with TanStack Start                                | React Router (less type-safe), Wouter (too simple)                                                     |
| Data Fetching | TanStack Query  | Best-in-class server state management, caching, background refetching                                   | SWR (less features), Apollo (GraphQL-focused), RTK Query (Redux dependency)                            |
| Data Tables   | TanStack Table  | Headless, highly customizable, excellent TypeScript support, sorting/filtering built-in                 | AG Grid (heavy, commercial), React Table v7 (deprecated)                                               |
| UI Components | shadcn/ui       | Copy-paste components (no dependency lock-in), Radix primitives for accessibility, highly customizable  | Material UI (heavy, opinionated), Chakra UI (runtime CSS-in-JS overhead), Ant Design (large bundle)    |
| Styling       | Tailwind CSS v4 | Utility-first with tiny production bundles, CSS-native config in v4, excellent DX                       | CSS Modules (more boilerplate), Styled Components (runtime overhead), vanilla CSS (slower development) |
| Charts        | Chart.js        | Simple API, good performance, sufficient for time-series line charts                                    | Recharts (heavier), D3 (overkill for our needs), Visx (steeper learning curve)                         |

> **Note**: Frontend (TanStack Start) is separate from Backend (Hono.js API). The frontend fetches data from the Hono API via REST endpoints.

### DevOps & Infrastructure

| Component | Technology               | Purpose                                                                                    | Alternatives Considered                                                                         |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Monorepo  | Moon v2                  | Fast Rust-based task runner, intelligent caching, project-aware dependencies               | Turborepo (Vercel lock-in), Nx (complex configuration), pnpm workspaces (no task orchestration) |
| Toolchain | proto                    | Manages runtime versions (bun, node), integrates with Moon, reproducible environments      | nvm/fnm (Node only), asdf (slower), volta (less Moon integration)                               |
| Hosting   | Wikimedia Cloud Services | Free for Wikimedia-affiliated projects, direct infrastructure access, PostgreSQL available | Vercel (paid for backend), Railway (cost), self-hosted (maintenance burden)                     |
| CI/CD     | GitHub Actions           | Free for open source, excellent ecosystem, easy configuration                              | GitLab CI (migration effort), CircleCI (cost for private)                                       |

---

## 3. External APIs

### 3.1 MediaWiki Action API

**Purpose**: Retrieve editor contributions, article metadata, and revision history.

**Base URL**: `https://{lang}.wikipedia.org/w/api.php`

**User-Agent Requirement** (MANDATORY):

We **MUST** include a custom User-Agent header on all requests. This is required by Wikimedia API policy and provides:

- Higher rate limits (200 req/s vs 50 req/s for anonymous)
- Better support from Wikimedia operations team
- Compliance with Wikimedia API etiquette

```typescript
// REQUIRED: Custom User-Agent for all Wikimedia API requests
const USER_AGENT = "OKAStatsBot/1.0 (https://oka.wiki/stats; tech@oka.wiki) bun/1.3.5";

const headers = {
  "User-Agent": USER_AGENT,
  "Api-User-Agent": USER_AGENT, // Some APIs prefer this header
};
```

**Key Endpoints**:

```
# Get user contributions
GET /w/api.php?action=query&list=usercontribs&ucuser={username}&ucprop=ids|title|timestamp|sizediff&format=json

# Get article info (creation date, word count)
GET /w/api.php?action=query&titles={article}&prop=revisions&rvprop=size|timestamp|user&rvlimit=1&rvdir=newer&format=json

# Check if user created the article
GET /w/api.php?action=query&titles={article}&prop=revisions&rvprop=user&rvlimit=1&rvdir=newer&format=json
```

**Rate Limits**:

| Type                  | Limit     | Notes           |
| --------------------- | --------- | --------------- |
| Anonymous             | 50 req/s  | Not recommended |
| With User-Agent       | 200 req/s | **We use this** |
| Authenticated (OAuth) | 200 req/s | Future option   |

**Example Response** (User Contributions):

```json
{
  "query": {
    "usercontribs": [
      {
        "userid": 12345,
        "user": "ExampleEditor",
        "pageid": 67890,
        "revid": 111213,
        "parentid": 111212,
        "ns": 0,
        "title": "Example Article",
        "timestamp": "2026-01-15T10:30:00Z",
        "sizediff": 1500
      }
    ]
  }
}
```

### 3.2 Wikimedia Pageviews API

**Purpose**: Retrieve article view statistics for time-series and total views.

**Base URL**: `https://wikimedia.org/api/rest_v1`

**Capabilities & Limitations**:

| Feature               | Value                                       | Notes                                   |
| --------------------- | ------------------------------------------- | --------------------------------------- |
| **Granularity**       | Daily, Monthly                              | We use **daily** for time-series charts |
| **History Available** | ~2.5 years                                  | Data starts from July 2015              |
| **Max Date Range**    | 1 year per request                          | Pagination needed for longer periods    |
| **Data Delay**        | ~24 hours                                   | Not real-time                           |
| **Access Types**      | all-access, desktop, mobile-app, mobile-web | We use **all-access**                   |
| **Agent Types**       | all-agents, user, spider                    | We use **user** (excludes bots)         |

**Implementation for Total Views + Time-Series**:

```typescript
// Fetch daily pageviews for time-series charts
const getDailyPageviews = async (article: string, project: string, start: string, end: string) => {
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/user/${encodeURIComponent(article)}/daily/${start}/${end}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  return response.json();
};

// Calculate total views by summing daily data
const calculateTotalViews = (items: PageviewItem[]) => {
  return items.reduce((sum, item) => sum + item.views, 0);
};

// Store both:
// 1. Daily snapshots → pageviews table (for time-series charts)
// 2. Running total → calculated on-demand from daily data
```

**Key Endpoint**:

```
# Get pageviews for an article
GET /metrics/pageviews/per-article/{project}/{access}/{agent}/{article}/{granularity}/{start}/{end}

# Example
GET /metrics/pageviews/per-article/en.wikipedia/all-access/user/Example_Article/daily/20260101/20260119
```

**Parameters**:

- `project`: Wikipedia project (e.g., `en.wikipedia`, `fr.wikipedia`)
- `access`: `all-access`, `desktop`, `mobile-app`, `mobile-web`
- `agent`: `user`, `spider`, `all-agents`
- `granularity`: `daily`, `monthly`

**Example Response**:

```json
{
  "items": [
    {
      "project": "en.wikipedia",
      "article": "Example_Article",
      "granularity": "daily",
      "timestamp": "2026011500",
      "access": "all-access",
      "agent": "user",
      "views": 1234
    }
  ]
}
```

### 3.3 Wikimedia Commons API

**Purpose**: Track media uploads by editors.

**Base URL**: `https://commons.wikimedia.org/w/api.php`

**Key Endpoints**:

```
# Get user uploads
GET /w/api.php?action=query&list=allimages&aisort=timestamp&aiuser={username}&aiprop=timestamp|url|size&format=json
```

---

## 4. Database Design

### 4.1 Entity Relationship Diagram

```
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│      Editor       │       │   Contribution    │       │     Article       │
├───────────────────┤       ├───────────────────┤       ├───────────────────┤
│ id (PK)           │       │ id (PK)           │       │ id (PK)           │
│ username          │◀─────│ editorId (FK)     │─────▶│ pageId            │
│ wikimediaUserId   │       │ articleId (FK)    │       │ title             │
│ isActive          │       │ revisionId        │       │ wikiProject       │
│ source            │       │ bytesChanged      │       │ createdByEditorId │
│ externalId        │       │ wordsAdded        │       │ articleCreatedAt  │
│ createdAt         │       │ isCreation        │       │ createdAt         │
│ updatedAt         │       │ editTimestamp     │       │ updatedAt         │
└───────────────────┘       │ createdAt         │       └───────────────────┘
         │                  └───────────────────┘                │
         │                                                       │
         │                  ┌───────────────────┐                │
         │                  │    Pageview       │                │
         │                  ├───────────────────┤                │
         │                  │ id (PK)           │                │
         │                  │ articleId (FK)    │◀──────────────┘
         │                  │ date              │
         │                  │ views             │
         │                  │ createdAt         │
         │                  └───────────────────┘
         │
         │                  ┌───────────────────┐
         │                  │   CommonsUpload   │
         │                  ├───────────────────┤
         └────────────────▶│ id (PK)           │
                            │ editorId (FK)     │
                            │ fileName          │
                            │ fileUrl           │
                            │ fileSize          │
                            │ mimeType          │
                            │ uploadedAt        │
                            │ createdAt         │
                            └───────────────────┘

┌───────────────────┐       ┌───────────────────┐
│     SyncJob       │       │       User        │
├───────────────────┤       ├───────────────────┤
│ id (PK)           │       │ id (PK)           │
│ jobType           │       │ email             │
│ status            │       │ name              │
│ startedAt         │       │ password (hashed) │
│ completedAt       │       │ role              │
│ error             │       │ createdAt         │
│ metadata (JSON)   │       │ updatedAt         │
│ createdAt         │       └───────────────────┘
└───────────────────┘
```

### 4.2 Prisma Schema

See [packages/db/prisma/schema.prisma](../packages/db/prisma/schema.prisma) for the complete annotated schema with field definitions and example values.

Key design decisions:

- **No displayName field**: Removed per reviewer feedback - Wikipedia only shows public usernames
- **source field on Editor**: Tracks origin (manual, csv_import, outreach_dashboard) for audit trail
- **Daily pageviews**: Stored individually for time-series, totals calculated on-demand
- **Words estimated from bytes**: `wordsAdded = bytesChanged / 6` per Wikimedia methodology

### 4.3 Indexes and Performance

Key indexes for query optimization:

| Table         | Index                      | Purpose                              |
| ------------- | -------------------------- | ------------------------------------ |
| contributions | `editorId, editTimestamp`  | Editor stats with date filtering     |
| contributions | `articleId, editTimestamp` | Article contribution history         |
| pageviews     | `articleId, date`          | Pageview lookups by date range       |
| articles      | `wikiProject, createdAt`   | Filter by Wikipedia language version |

---

## 5. System Architecture

### 5.1 Component Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Presentation Layer                         │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  Dashboard View │  │  Editor Stats   │  │  Admin Panel    │     │
│  │  (Overall)      │  │  (Per-Editor)   │  │  (Management)   │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                          API Layer (Hono)                          │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  /api/stats     │  │  /api/editors   │  │  /api/sync      │     │
│  │  (Metrics API)  │  │  (Editor CRUD)  │  │  (Trigger Jobs) │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                        Service Layer                               │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │  StatsService   │  │  SyncService    │  │  WikimediaClient│     │
│  │  (Aggregation)  │  │  (Background)   │  │  (API Wrapper)  │     │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘     │
└────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                 │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Prisma ORM + PostgreSQL                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### 5.2 Data Sync Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Background Sync Process                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────┐  │
│  │  CRON   │──▶│ Fetch Active │──▶│ For Each     │──▶│ Store  │  │
│  │ (Daily) │    │ Editors      │    │ Editor:      │    │ in DB  │  │
│  └─────────┘    └──────────────┘    │              │    └────────┘  │
│                                     │ 1. Get       │                │
│                                     │    Contribs  │                │
│                                     │ 2. Get       │                │
│                                     │    Pageviews │                │
│                                     │ 3. Get       │                │
│                                     │    Commons   │                │
│                                     └──────────────┘                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. API Design

### 6.1 REST API Endpoints

#### Editors Management

| Method | Endpoint           | Description                 |
| ------ | ------------------ | --------------------------- |
| GET    | `/api/editors`     | List all registered editors |
| POST   | `/api/editors`     | Register a new editor       |
| GET    | `/api/editors/:id` | Get editor details          |
| PUT    | `/api/editors/:id` | Update editor info          |
| DELETE | `/api/editors/:id` | Remove editor from tracking |

#### Statistics

| Method | Endpoint                 | Description                        |
| ------ | ------------------------ | ---------------------------------- |
| GET    | `/api/stats/overall`     | Aggregated stats by wiki project   |
| GET    | `/api/stats/editors`     | Stats grouped by editor            |
| GET    | `/api/stats/editors/:id` | Detailed stats for specific editor |
| GET    | `/api/stats/timeseries`  | Time-series data for charts        |

#### Data Sync

| Method | Endpoint            | Description                 |
| ------ | ------------------- | --------------------------- |
| POST   | `/api/sync/trigger` | Manually trigger a sync job |
| GET    | `/api/sync/status`  | Get current sync job status |
| GET    | `/api/sync/history` | List recent sync jobs       |

### 6.2 Query Parameters

**Common Filters**:

```
?startDate=2026-01-01
?endDate=2026-01-19
?wikiProject=en.wikipedia.org
?editorId=clx123...
```

### 6.3 Response Formats

**Overall Stats Response**:

```json
{
  "success": true,
  "data": {
    "totals": {
      "edits": 15420,
      "wordsAdded": 2450000,
      "pageviews": 8500000,
      "articlesCreated": 342,
      "articlesModified": 1205,
      "commonsUploads": 89
    },
    "byWikiProject": [
      {
        "wikiProject": "en.wikipedia.org",
        "edits": 8500,
        "wordsAdded": 1500000,
        "pageviews": 5000000,
        "articlesCreated": 200,
        "articlesModified": 650,
        "commonsUploads": 45
      },
      {
        "wikiProject": "fr.wikipedia.org",
        "edits": 3200,
        "wordsAdded": 550000,
        "pageviews": 1800000,
        "articlesCreated": 85,
        "articlesModified": 320,
        "commonsUploads": 22
      }
    ]
  },
  "meta": {
    "dateRange": {
      "start": "2026-01-01",
      "end": "2026-01-19"
    },
    "generatedAt": "2026-01-19T10:30:00Z"
  }
}
```

**Time-Series Response**:

```json
{
  "success": true,
  "data": {
    "granularity": "daily",
    "series": [
      {
        "date": "2026-01-01",
        "edits": 520,
        "wordsAdded": 85000,
        "pageviews": 280000,
        "articlesCreated": 12
      },
      {
        "date": "2026-01-02",
        "edits": 480,
        "wordsAdded": 72000,
        "pageviews": 295000,
        "articlesCreated": 8
      }
    ]
  }
}
```

---

## 7. Data Flow

### 7.1 Editor Registration Flow

```
User                    API                     Database              Wikimedia
  │                      │                          │                     │
  │  POST /api/editors   │                          │                     │
  │  {username: "X"}     │                          │                     │
  │────────────────────▶│                          │                     │
  │                      │  Validate username       │                     │
  │                      │─────────────────────────────────────────────▶ │
  │                      │                          │   Return user info  │
  │                      │◀───────────────────────────────────────────── │
  │                      │                          │                     │
  │                      │  INSERT editor           │                     │
  │                      │────────────────────────▶│                     │
  │                      │                          │                     │
  │  201 Created         │◀────────────────────────│                     │
  │◀────────────────────│                          │                     │
```

### 7.2 Metrics Calculation Flow

```
                    ┌─────────────────────────────────────────────────┐
                    │              Metrics Calculation                │
                    └─────────────────────────────────────────────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────┐
          │                               │                           │
          ▼                               ▼                           ▼
   ┌─────────────┐               ┌─────────────┐              ┌─────────────┐
   │   Edits     │               │   Words     │              │  Pageviews  │
   │   COUNT(*)  │               │   SUM(      │              │  SUM(views) │
   │   FROM      │               │   wordsAdded│              │  FROM       │
   │contributions│               │   ) FROM    │              │  pageviews  │
   └─────────────┘               │contributions│              │  WHERE      │
                                 └─────────────┘              │  isCreation │
                                                              └─────────────┘
          │                               │                           │
          └───────────────────────────────┼───────────────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │  Aggregate Results  │
                              │  - By wiki project  │
                              │  - By editor        │
                              │  - By date range    │
                              └─────────────────────┘
```

---

## 8. UI Mockups

### 8.1 Overall Statistics Dashboard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OKA Stats Platform                                    [Filter ▼] [Export]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Date Range: [2026-01-01] to [2026-01-19]                    [Apply Filter] │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │   EDITS     │ │   WORDS     │ │  PAGEVIEWS  │ │  ARTICLES   │            │
│  │   15,420    │ │  2.45M      │ │   8.5M      │ │    342      │            │
│  │   ↑ 12%     │ │  ↑ 8%       │ │   ↑ 15%     │ │   ↑ 5%      │            │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📈 Metrics Over Time                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │     ╱╲    ╱╲                                                        │    │
│  │    ╱  ╲  ╱  ╲     ╱╲                                                │    │
│  │   ╱    ╲╱    ╲   ╱  ╲                                               │    │
│  │  ╱            ╲ ╱    ╲                                              │    │
│  │ ╱              ╲      ╲                                             │    │
│  │                                                                     │    │
│  │ Jan 1    Jan 5     Jan 10      Jan 15      Jan 19                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 Stats by Wikipedia Version                                    [Sort ▼]  │
│  ┌────────────────┬────────┬──────────┬───────────┬──────────┬──────────┐   │
│  │ Wiki Project   │ Edits  │ Words    │ Pageviews │ Created  │ Modified │   │
│  ├────────────────┼────────┼──────────┼───────────┼──────────┼──────────┤   │
│  │ en.wikipedia   │ 8,500  │ 1.5M     │ 5.0M      │ 200      │ 650      │   │
│  │ fr.wikipedia   │ 3,200  │ 550K     │ 1.8M      │ 85       │ 320      │   │
│  │ de.wikipedia   │ 2,100  │ 280K     │ 1.2M      │ 42       │ 180      │   │
│  │ es.wikipedia   │ 1,620  │ 120K     │ 500K      │ 15       │ 55       │   │
│  ├────────────────┼────────┼──────────┼───────────┼──────────┼──────────┤   │
│  │ TOTAL          │ 15,420 │ 2.45M    │ 8.5M      │ 342      │ 1,205    │   │
│  └────────────────┴────────┴──────────┴───────────┴──────────┴──────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Per-Editor Statistics View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OKA Stats Platform  >  Editor Statistics                   [Filter ▼]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filters:                                                                   │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────────────────────┐   │
│  │ Date Range   ▼ │ │ Wiki Project ▼ │ │ Search editor...             🔍│   │
│  └────────────────┘ └────────────────┘ └────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 Editor Statistics (sorted by Words Added)                               │
│  ┌──────────────────┬────────┬──────────┬───────────┬──────────┬─────────┐  │
│  │ Editor           │ Edits  │ Words    │ Pageviews │ Created  │ Uploads │  │
│  ├──────────────────┼────────┼──────────┼───────────┼──────────┼─────────┤  │
│  │ WikiEditor2024   │ 2,340  │ 450K     │ 1.2M      │ 45       │ 12      │  │
│  │ KnowledgeSeeker  │ 1,890  │ 380K     │ 980K      │ 38       │ 8       │  │
│  │ ArticleCrafter   │ 1,560  │ 320K     │ 850K      │ 32       │ 15      │  │
│  │ InfoContributor  │ 1,200  │ 250K     │ 620K      │ 28       │ 5       │  │
│  │ WikiEnthusiast   │ 980    │ 180K     │ 450K      │ 22       │ 3       │  │
│  │ ...              │ ...    │ ...      │ ...       │ ...      │ ...     │  │
│  └──────────────────┴────────┴──────────┴───────────┴──────────┴─────────┘  │
│                                                                             │
│  ◀ Previous    Page 1 of 5    Next ▶                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Admin Panel - Editor Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  OKA Stats Platform  >  Admin  >  Editors               [+ Add Editor]      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [+ Add Editor]  [📥 Import CSV]  [🔄 Sync Now]                             │
│                                                                             │
│  Registered Editors (47)                              [Search... 🔍]        │
│  ┌──────────────────┬─────────────────┬──────────┬────────┬─────────────┐   │
│  │ Username         │ Wiki Projects   │ Source   │ Status │ Actions     │   │
│  ├──────────────────┼─────────────────┼──────────┼────────┼─────────────┤   │
│  │ Jimbo_Wales      │ en, id, jv      │ manual   │ Active │ [✏️] [🗑️]   │   │
│  │ Example_User     │ id, su          │ csv      │ Active │ [✏️] [🗑️]   │   │
│  │ Another_Editor   │ en              │ manual   │ Active │ [✏️] [🗑️]   │   │
│  │ ...              │                 │          │        │             │   │
│  └──────────────────┴─────────────────┴──────────┴────────┴─────────────┘   │
│                                                                             │
│  [< Prev]  Page 1 of 5  [Next >]                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Sign In Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                         OKA Stats Platform                                  │
│                                                                             │
│                    ┌─────────────────────────┐                              │
│                    │                         │                              │
│                    │      🔐 Admin Login     │                              │
│                    │                         │                              │
│                    │  Email                  │                              │
│                    │  ┌─────────────────┐    │                              │
│                    │  │ admin@oka.wiki │    │                              │
│                    │  └─────────────────┘    │                              │
│                    │                         │                              │
│                    │  Password               │                              │
│                    │  ┌─────────────────┐    │                              │
│                    │  │ ••••••••••••••  │    │                              │
│                    │  └─────────────────┘    │                              │
│                    │                         │                              │
│                    │  ┌─────────────────┐    │                              │
│                    │  │    Sign In      │    │                              │
│                    │  └─────────────────┘    │                              │
│                    │                         │                              │
│                    └─────────────────────────┘                              │
│                                                                             │
│              📊 Dashboard is publicly viewable                              │
│              🔒 Sign in required for admin functions                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Editor Management

### 9.1 Hybrid Approach

The platform supports multiple sources for registering editors:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Editor Sources                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐                                           │
│  │ 1. Manual Add    │──┐                                        │
│  │    (Admin UI)    │  │                                        │
│  └──────────────────┘  │                                        │
│                        │    ┌─────────────────┐                 │
│  ┌──────────────────┐  │    │                 │                 │
│  │ 2. CSV Import    │──┼──▶│  editors table  │                 │
│  │    (Bulk upload) │  │    │  (PostgreSQL)   │                 │
│  └──────────────────┘  │    │                 │                 │
│                        │    └─────────────────┘                 │
│  ┌──────────────────┐  │                                        │
│  │ 3. API Sync      │──┘                                        │
│  │    (Future)      │                                           │
│  └──────────────────┘                                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Source Types

| Source                 | Status    | Use Case                                           |
| ---------------------- | --------- | -------------------------------------------------- |
| **Manual Add**         | ✅ MVP    | Add individual editors via Admin UI                |
| **CSV Import**         | ✅ MVP    | Initial migration from Google Sheets, bulk updates |
| **Outreach Dashboard** | 🔮 Future | Sync from existing Wikimedia campaigns             |
| **Wiki Category**      | 🔮 Future | Sync from "Category:OKA_editors" page              |

### 9.3 CSV Import Format

```csv
username
Jimbo_Wales
Example_User
Another_Editor
```

### 9.4 Deduplication

Editors are deduplicated by `username`. When importing:

- Existing editors are updated (wiki projects merged)
- New editors are created
- `source` field tracks origin for audit

---

## 10. Deployment Architecture

### 10.1 Wikimedia Cloud Services Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Wikimedia Cloud Services                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         Kubernetes Cluster                          │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐  │    │
│  │  │    API Pod      │  │   Web Pod       │  │   Cron Job Pod      │  │    │
│  │  │   (Hono)        │  │   (Frontend)    │  │   (Sync Workers)    │  │    │
│  │  │   Replicas: 2   │  │   Replicas: 2   │  │   Schedule: Daily   │  │    │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘  │    │
│  │           │                    │                     │              │    │
│  │           └────────────────────┼─────────────────────┘              │    │
│  │                                │                                    │    │
│  │                                ▼                                    │    │
│  │                    ┌─────────────────────┐                          │    │
│  │                    │  PostgreSQL (RDS)   │                          │    │
│  │                    │  Managed Database   │                          │    │
│  │                    └─────────────────────┘                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────┐                                                        │
│  │   Ingress /     │◀──────── External Traffic                             │
│  │   Load Balancer │                                                        │
│  └─────────────────┘                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Environment Configuration

```bash
# Production Environment Variables
DATABASE_URL="postgresql://user:pass@db-host:5432/oka_stats"
NODE_ENV="production"

# Wikimedia API (REQUIRED)
WIKIMEDIA_USER_AGENT="OKAStatsBot/1.0 (https://oka.wiki/stats; tech@oka.wiki) bun/1.3.5"

# Sync Configuration
SYNC_SCHEDULE="0 2 * * *"  # Daily at 2 AM UTC

# Authentication
JWT_SECRET="your-secure-secret-here"
```

---

## 11. Security Considerations

### 11.1 Authentication & Authorization

- **Public access**: Dashboard and stats endpoints are publicly viewable
- **Admin access**: Editor management, sync triggers require authentication
- **JWT-based auth**: Stateless tokens for API authentication
- **Role-based access**: Admin (full), Viewer (read-only)

### 11.2 Data Protection

- No personally identifiable information stored beyond Wikipedia usernames (public data)
- Database connections encrypted via TLS
- Passwords hashed with bcrypt
- Environment variables for sensitive configuration

### 11.3 API Security

- Input validation using Zod schemas
- SQL injection prevention via Prisma ORM
- CORS configuration for frontend origin only
- Rate limiting on authentication endpoints

### 11.4 Wikimedia API Compliance

- **REQUIRED**: Custom User-Agent header on all requests
- Respect rate limits with exponential backoff
- Cache responses where appropriate
- No scraping or circumventing API limits

---

## 12. Limitations & Constraints

### 12.1 Wikimedia API Limitations

| Limitation                                  | Impact                         | Mitigation                                                   |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| **Pageview history from July 2015 only**    | No historical data before 2015 | Show "N/A" for older articles, document in UI                |
| **Pageviews delayed ~24 hours**             | No real-time stats             | Display "as of yesterday" disclaimer                         |
| **Rate limits (200 req/s with User-Agent)** | Large syncs take time          | Background processing, chunked requests, exponential backoff |
| **No word count API**                       | Must estimate from bytes       | Use Wikimedia standard: `bytes / 6 ≈ words`                  |
| **Article renames**                         | Pageview history may be split  | Track redirects where possible                               |
| **Deleted articles**                        | No pageview data available     | Mark as deleted, preserve historical contribution data       |

### 12.2 Data Accuracy Limitations

| Limitation                      | Impact                                         | Mitigation                               |
| ------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| **Bytes ≠ Words**               | Word count is approximation                    | Label as "estimated words" in UI         |
| **No edit quality metric**      | Cannot distinguish good vs. reverted edits     | Future: track reverts separately         |
| **Commons username may differ** | Some editors use different username on Commons | Future: allow mapping in editor settings |

### 12.3 Features Explicitly Not Supported (MVP)

| Feature                       | Status     | Notes                                                                              |
| ----------------------------- | ---------- | ---------------------------------------------------------------------------------- |
| Real-time statistics          | ❌         | Wikimedia APIs have inherent 24-hour delay                                         |
| Edit quality scoring          | ❌         | Would require ML/complex analysis                                                  |
| All Wikimedia sister projects | ⚠️ Partial | Wikipedia + Commons supported; Wiktionary, Wikibooks, etc. require additional work |
| Public editor profiles        | ❌         | Privacy considerations; dashboard is aggregate only                                |
| Email notifications           | ❌         | Out of scope for MVP                                                               |
| Mobile app                    | ❌         | Web responsive design is sufficient                                                |

---

## Appendix A: Supported Wikipedia Projects

Initial supported projects (can be expanded):

| Code    | Project              |
| ------- | -------------------- |
| en      | English Wikipedia    |
| id      | Indonesian Wikipedia |
| jv      | Javanese Wikipedia   |
| su      | Sundanese Wikipedia  |
| ms      | Malay Wikipedia      |
| commons | Wikimedia Commons    |

---

## Appendix B: Words Added Calculation

The "words added" metric follows Wikimedia's methodology:

```typescript
// Simple estimation (used in sync)
const estimatedWords = Math.round(bytesChanged / 6);

// More accurate (future enhancement)
// 1. Fetch revision diff
// 2. Strip wikitext markup
// 3. Count actual words in added content
```

---

## Document History

| Version | Date       | Author | Changes                                                                                                                                                                                                          |
| ------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-01-19 | Team   | Initial draft                                                                                                                                                                                                    |
| 1.1     | 2026-01-20 | Team   | Added technology rationale, User-Agent requirements, Pageviews API details, Editor management hybrid approach, Sign-in UI mock, Limitations section. Removed displayName field. Updated Prisma schema reference. |
