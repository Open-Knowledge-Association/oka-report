# OKA Stats Platform - Project Structure & Roadmap

## Current Project Structure

```
oka-report/
├── .moon/                      # Moon v2 configuration
│   ├── workspace.yml           # Workspace projects config
│   └── toolchain.yml           # Toolchain config
├── .prototools                 # proto versions (bun=1.3.5, node=25.3.0)
├── .beads/                     # bd issue tracker database
├── .env                        # Environment variables (DATABASE_URL, etc.)
│
├── apps/
│   ├── api/                    # ✅ EXISTS - Hono.js Backend API
│   │   ├── src/
│   │   │   └── index.ts        # Entry point (basic setup done)
│   │   ├── moon.yml            # Moon tasks (dev, build)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                    # ✅ EXISTS - TanStack Router Frontend
│       ├── src/
│       │   ├── routes/         # File-based routing (TanStack Router)
│       │   │   ├── __root.tsx  # ✅ Root layout
│       │   │   └── index.tsx   # ✅ Index page (scaffold)
│       │   ├── components/     # UI components
│       │   │   └── Header.tsx  # ✅ Basic header
│       │   └── lib/
│       │       └── utils.ts    # ✅ cn() helper
│       ├── components.json     # ✅ shadcn/ui config (new-york style)
│       ├── moon.yml            # ✅ Moon tasks
│       ├── package.json        # ✅ TanStack Router + Tailwind v4
│       ├── vite.config.ts      # ✅ Vite config
│       └── tsconfig.json
│
├── packages/
│   ├── db/                     # ✅ EXISTS - Prisma Database Package
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # ✅ Complete (Editor, Article, Contribution, etc.)
│   │   │   └── migrations/     # ✅ Migrations applied
│   │   ├── generated/prisma/   # ✅ Generated Prisma client
│   │   ├── index.ts            # Export prisma client
│   │   ├── moon.yml            # Tasks (generate, migrate)
│   │   └── package.json
│   │
│   └── utils/                  # 🔲 TO CREATE - Shared Utilities
│       ├── src/
│       │   ├── wikimedia/      # Wikimedia API client
│       │   │   ├── client.ts   # Base WikimediaClient class
│       │   │   ├── contributions.ts
│       │   │   ├── pageviews.ts
│       │   │   ├── commons.ts
│       │   │   └── types.ts
│       │   ├── rate-limiter.ts # Exponential backoff
│       │   └── index.ts        # Exports
│       ├── moon.yml
│       └── package.json
│
├── docs/
│   ├── HIGH_LEVEL_DESIGN.md    # ✅ Technical design document
│   ├── TASKS.md                # ✅ Task overview by phase
│   ├── PROJECT_STRUCTURE.md    # ✅ This file
│   └── issues.md               # ✅ Issue source for bd
│
├── package.json                # Root workspace package
├── bun.lock
├── AGENTS.md                   # AI agent instructions
└── README.md                   # Project overview
```

---

## Folder Mapping by Purpose

### 🟢 EXISTS & COMPLETE

| Folder                             | Purpose                        | Status         |
| ---------------------------------- | ------------------------------ | -------------- |
| `.moon/`                           | Moon v2 workspace config       | ✅ Ready       |
| `packages/db/`                     | Prisma ORM, schema, migrations | ✅ Complete    |
| `packages/db/prisma/schema.prisma` | All models defined             | ✅ Complete    |
| `apps/api/`                        | Hono.js API scaffold           | ✅ Basic setup |
| `apps/web/`                        | TanStack Router + shadcn/ui    | ✅ Scaffold    |
| `docs/`                            | Documentation                  | ✅ Complete    |

### 🟡 EXISTS BUT INCOMPLETE

| Folder            | Purpose          | Missing                            |
| ----------------- | ---------------- | ---------------------------------- |
| `apps/api/src/`   | API source code  | Routes, services, middleware       |
| `apps/web/src/`   | Frontend source  | Pages, components, API integration |
| `packages/utils/` | Shared utilities | Everything (empty folder)          |

### 🔴 TO CREATE

| Folder                            | Purpose              | Phase     |
| --------------------------------- | -------------------- | --------- |
| `apps/api/src/routes/`            | API route handlers   | Phase 5   |
| `apps/api/src/services/`          | Business logic       | Phase 3-4 |
| `apps/api/src/schemas/`           | Zod validation       | Phase 5   |
| `apps/web/src/routes/editors.tsx` | Editors stats page   | Phase 7   |
| `apps/web/src/routes/admin/`      | Admin pages          | Phase 7   |
| `apps/web/src/components/ui/`     | shadcn/ui components | Phase 7   |
| `packages/utils/src/wikimedia/`   | Wikimedia API client | Phase 2   |

---

## Implementation Roadmap

### 🚀 Phase 2: Wikimedia API Client (Week 1)

**Location:** `packages/utils/`

```
packages/utils/
├── src/
│   ├── wikimedia/
│   │   ├── client.ts           # Base class with User-Agent
│   │   ├── contributions.ts    # getUserContributions()
│   │   ├── articles.ts         # getArticleInfo()
│   │   ├── pageviews.ts        # getPageviews()
│   │   ├── commons.ts          # getCommonsUploads()
│   │   └── types.ts            # TypeScript interfaces
│   ├── rate-limiter.ts         # Exponential backoff helper
│   └── index.ts
├── moon.yml
├── package.json
└── tsconfig.json
```

**Issues:** `report-0sj`, `report-abw`, `report-x7t`, `report-9xt`, `report-6pk`, `report-r32`

---

### 🔄 Phase 3: Sync Service (Week 2)

**Location:** `apps/api/src/services/`

```
apps/api/src/
├── services/
│   ├── sync.service.ts         # SyncService class
│   │   ├── syncEditorContributions()
│   │   ├── syncArticlePageviews()
│   │   ├── syncCommonsUploads()
│   │   └── runFullSync()
│   └── index.ts
├── jobs/
│   └── scheduler.ts            # Cron scheduler (daily sync)
└── index.ts
```

**Issues:** `report-2h3`, `report-c2g`, `report-660`, `report-noc`, `report-0ro`, `report-860`, `report-55x`

---

### 📊 Phase 4: Stats Service (Week 2-3)

**Location:** `apps/api/src/services/`

```
apps/api/src/services/
├── stats.service.ts            # StatsService class
│   ├── getOverallStats()
│   ├── getStatsByWikiProject()
│   ├── getStatsByEditor()
│   └── getTimeSeries()
├── sync.service.ts
└── index.ts
```

**Issues:** `report-0k8`, `report-zzf`, `report-e3u`, `report-5y2`, `report-dih`

---

### 🌐 Phase 5: API Endpoints (Week 3)

**Location:** `apps/api/src/routes/`

```
apps/api/src/
├── routes/
│   ├── editors.ts              # /api/editors CRUD
│   ├── stats.ts                # /api/stats/* endpoints
│   ├── sync.ts                 # /api/sync/* endpoints
│   └── index.ts                # Route aggregator
├── schemas/
│   ├── editor.schema.ts        # Zod schemas for editors
│   ├── stats.schema.ts         # Zod schemas for stats
│   ├── sync.schema.ts          # Zod schemas for sync
│   └── common.schema.ts        # Shared schemas (pagination, dateRange)
├── middleware/
│   └── error-handler.ts        # Global error handling
├── services/
└── index.ts
```

**Issues:** `report-oxq`, `report-abe`, `report-95i`, `report-kos`, `report-304`, `report-aa4`, `report-00x`, `report-b98`, `report-fys`, `report-q25`, `report-juv`, `report-y5a`, `report-11q`, `report-rzq`

---

### 🖥️ Phase 7: Frontend (Week 4-5)

**Location:** `apps/web/`

```
apps/web/
├── src/
│   ├── routes/
│   │   ├── __root.tsx          # Root layout (nav, toaster)
│   │   ├── index.tsx           # Dashboard (/)
│   │   ├── editors.tsx         # Editor stats (/editors)
│   │   └── admin/
│   │       └── editors.tsx     # Admin panel (/admin/editors)
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── table.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── select.tsx
│   │   │   ├── input.tsx
│   │   │   └── toast.tsx
│   │   ├── stats-cards.tsx     # Summary cards component
│   │   ├── stats-table.tsx     # TanStack Table + shadcn
│   │   ├── time-chart.tsx      # Chart.js line chart
│   │   └── filters/
│   │       ├── date-range.tsx  # Date range picker
│   │       └── wiki-select.tsx # Wiki project filter
│   ├── lib/
│   │   ├── api.ts              # API client (fetch wrapper)
│   │   ├── queries.ts          # TanStack Query hooks
│   │   └── utils.ts            # cn() helper
│   └── styles/
│       └── globals.css         # Tailwind imports
├── app.config.ts               # TanStack Start config
├── tailwind.config.ts
├── components.json             # shadcn/ui config
├── moon.yml
├── package.json
└── tsconfig.json
```

**Issues:** `report-k0h`, `report-5p7`, `report-8ph`, `report-523`, `report-afh`, `report-bf8`, `report-ch5`, `report-rjo`, `report-0rf`, `report-jeu`, `report-6q9`, `report-bhc`, `report-o7e`, `report-6x3`, `report-hq5`

---

## Timeline Summary

| Week | Phase     | Focus          | Deliverables                        |
| ---- | --------- | -------------- | ----------------------------------- |
| 1    | Phase 2   | Wikimedia API  | API client in `packages/utils`      |
| 2    | Phase 3-4 | Services       | Sync + Stats services in `apps/api` |
| 3    | Phase 5   | API Routes     | Complete REST API                   |
| 4    | Phase 7   | Frontend Setup | TanStack Start + shadcn/ui          |
| 5    | Phase 7   | Frontend Pages | Dashboard, Editors, Admin           |
| 6    | Phase 8-9 | Polish         | Testing, CI/CD, Deployment          |

---

## Quick Commands

```bash
# Development
moon run api:dev        # Start Hono API (port 3000)
moon run web:dev        # Start TanStack Start (port 3001)
moon run db:generate    # Regenerate Prisma client
moon run db:migrate     # Run database migrations

# Build
moon run api:build      # Build API to binary
moon run web:build      # Build frontend for production

# All projects
moon run :dev           # Start all dev servers
moon run :build         # Build all projects
moon run :test          # Run all tests
```

---

## Next Steps

1. **Start with `report-0sj`** - Create WikimediaClient base class
2. Run `bd ready` to see available tasks
3. Use `bd update <id> --status in_progress` to claim work
4. Use `bd close <id>` when done
