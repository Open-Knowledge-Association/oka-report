# OKA Stats Platform

A fully automated, open-source platform for tracking and visualizing Wikipedia editing impact metrics for OKA (Open Knowledge Association) editors and grant recipients.

## Overview

The OKA Stats Platform replaces a manual Google Sheet-based workflow with a comprehensive, automated system that tracks Wikipedia contributions across multiple language versions. Built with scalability and flexibility in mind, the platform provides real-time insights into editing activities, article performance, and overall organizational impact.

## Problem Statement

For over 2 years, OKA relied on manual tracking via Google Sheets, which presented several critical challenges:

- **Manual Entry Bias**: Only captured manually-listed articles, missing smaller edits and improvements
- **Scalability Issues**: Approaching Google Sheets row limits with no viable splitting strategy
- **Maintenance Overhead**: Significant annual effort required for data integrity and broken link fixes
- **Data Gaps**: Missing critical metrics like word counts and edit frequency

## Why Not Use Existing Solutions?

While tools like the Wikimedia "Outreach Dashboard" exist, they proved unsuitable because:

- Complex codebase difficult to modify due to community constraints
- Architecture optimized for short-term "editathons" rather than long-term organizational tracking
- Limited customization for OKA's specific reporting needs

## Core Features

### Automated Metrics Tracking

The platform automatically collects and calculates:

- **Edits**: Total number of edits per editor
- **Words Added**: Based on Wikimedia's proven methodology
- **Pageviews**: Cumulative views for created articles (excludes modified-only articles)
- **Articles Created**: New articles authored by tracked editors
- **Articles Modified**: All articles touched (including creations)
- **Commons Uploads**: Media contributions to Wikimedia Commons

### Dashboard & Visualizations

#### Overall Statistics View

- Tabular format showing metrics across all Wikipedia language versions
- Time-series visualizations (line charts) for trend analysis
- Filtering by date range and Wikipedia version
- Sorted by word count contribution

#### Per-Editor Statistics View

- Individual contributor performance tracking
- Granular filtering by editor, date range, and Wikipedia version
- Essential for grant recipient oversight and progress reporting

## Use Cases

1. **Organizational Impact Reporting**: Track OKA's overall Wikipedia contributions for annual reports and donor transparency
2. **Grant Oversight**: Monitor individual grantee performance and deliverables
3. **Community Visibility**: Demonstrate OKA's contributions to the broader Wikipedia community
4. **Internal Steering**: Data-driven decision making for resource allocation and strategy

## Tech Stack

### Backend

- **Runtime**: Bun
- **API Framework**: Hono
- **Database**: PostgreSQL with Prisma ORM
- **Validation**: Zod

### Frontend

- **Framework**: TanStack Start (full-stack React with SSR)
- **Routing**: TanStack Router (file-based, type-safe)
- **UI Components**: shadcn/ui (Radix primitives)
- **Styling**: Tailwind CSS v4
- **Data Fetching**: TanStack Query
- **Tables**: TanStack Table

### Tooling

- **Monorepo**: Moon v2
- **Toolchain**: proto (bun 1.3.5, node 25.3.0)
- **Language**: TypeScript
- **Hosting**: Wikimedia Cloud Services (planned)

## Project Structure

```
report/
├── .moon/              # Moon v2 workspace config
├── .prototools         # Toolchain versions (bun, node)
├── apps/
│   ├── api/            # Hono API server
│   └── web/            # TanStack Start frontend (SSR + shadcn/ui)
├── docs/
│   ├── HIGH_LEVEL_DESIGN.md   # Technical design document
│   ├── PROJECT_STRUCTURE.md   # Folder mapping & roadmap
│   └── TASKS.md               # Task overview by phase
├── packages/
│   ├── db/             # Prisma schema and database client
│   └── utils/          # Shared utilities (Wikimedia API client)
└── README.md
```

> 📖 For detailed folder mapping, see [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md)

## Getting Started

### Prerequisites

- [proto](https://moonrepo.dev/proto) - Toolchain manager
- PostgreSQL database

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd report
```

2. Install proto toolchain (manages bun, node versions):

```bash
curl -fsSL https://moonrepo.dev/install/proto.sh | bash
proto use   # Installs bun 1.3.5, node 25.3.0
```

3. Install dependencies:

```bash
bun install
```

4. Set up environment variables:

Create `.env` file in the root:

```env
DATABASE_URL="postgresql://user:password@host:port/database"
```

5. Run database migrations:

```bash
moon run db:migrate
```

6. Start development servers:

```bash
moon run api:dev   # API at http://localhost:3000
moon run web:dev   # Frontend at http://localhost:3001
```

## Development

### Running Development Servers

```bash
moon run api:dev   # Hono API server (port 3001)
moon run web:dev   # TanStack Start frontend (port 3000)
moon run :dev      # Run all dev servers
```

### Database Management

```bash
moon run db:generate    # Generate Prisma Client
moon run db:migrate     # Run migrations
moon run db:studio      # Open Prisma Studio
```

### Project Commands (Moon v2)

```bash
# Install dependencies
bun install

# Development
moon run api:dev        # Start API server
moon run web:dev        # Start frontend
moon run :dev           # Start all dev servers

# Build
moon run api:build      # Build API to binary
moon run web:build      # Build frontend for production
moon run :build         # Build all projects

# Testing
moon run web:test       # Run frontend tests (vitest)
moon run :test          # Run all tests
```

## Architecture

The platform is built as a monorepo with clear separation of concerns:

- **API Layer**: RESTful API built with Hono for lightweight, fast HTTP handling
- **Database Layer**: PostgreSQL with Prisma for type-safe database operations
- **Integration Layer**: Consumes Wikimedia APIs for automated data collection
- **Frontend**: TanStack Start + shadcn/ui dashboard for visualization and filtering

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│   Frontend   │───▶│   Hono API   │───▶│      PostgreSQL DB       │
│   (Web App)  │◀───│   Server     │◀───│   (Prisma ORM)           │
└──────────────┘     └──────┬───────┘     └──────────────────────────┘
                            │
                            ▼
                  ┌─────────────────────┐
                  │   Wikimedia APIs    │
                  │  • MediaWiki API    │
                  │  • Pageviews API    │
                  │  • Commons API      │
                  └─────────────────────┘
```

> 📖 For detailed technical documentation, see [docs/HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md)

## Data Sources

The platform integrates with official Wikimedia APIs:

| API                      | Base URL                                  | Purpose                        |
| ------------------------ | ----------------------------------------- | ------------------------------ |
| **MediaWiki Action API** | `https://{lang}.wikipedia.org/w/api.php`  | Edit history, article metadata |
| **Pageviews API**        | `https://wikimedia.org/api/rest_v1`       | Article view statistics        |
| **Commons API**          | `https://commons.wikimedia.org/w/api.php` | Media upload tracking          |

### Example API Calls

```bash
# Get user contributions
curl "https://en.wikipedia.org/w/api.php?action=query&list=usercontribs&ucuser=ExampleUser&format=json"

# Get article pageviews
curl "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/Example_Article/daily/20260101/20260119"
```

## Database Schema

The platform uses PostgreSQL with Prisma ORM. Key entities:

| Table             | Purpose                               |
| ----------------- | ------------------------------------- |
| `editors`         | Registered Wikipedia editors to track |
| `articles`        | Wikipedia articles created/modified   |
| `contributions`   | Individual edits with metrics         |
| `pageviews`       | Daily article view statistics         |
| `commons_uploads` | Wikimedia Commons file uploads        |
| `sync_jobs`       | Background job tracking               |

> 📖 See [docs/HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md#4-database-design) for full schema details and ERD.

## API Endpoints

### Statistics

| Method | Endpoint                | Description                      |
| ------ | ----------------------- | -------------------------------- |
| GET    | `/api/stats/overall`    | Aggregated stats by wiki project |
| GET    | `/api/stats/editors`    | Stats grouped by editor          |
| GET    | `/api/stats/timeseries` | Time-series data for charts      |

### Editors Management

| Method | Endpoint           | Description                 |
| ------ | ------------------ | --------------------------- |
| GET    | `/api/editors`     | List all registered editors |
| POST   | `/api/editors`     | Register a new editor       |
| DELETE | `/api/editors/:id` | Remove editor from tracking |

> 📖 See [docs/HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md#6-api-design) for full API documentation.

## Design Principles

1. **Automation First**: Minimize manual intervention to reduce bias and effort
2. **Open Source**: All code and dependencies are open-source
3. **API-Driven**: Leverage existing Wikimedia infrastructure
4. **Multi-Language**: Support all Wikipedia language editions and sister projects
5. **Scalability**: Built to handle growing data volumes and user base

## Roadmap

### Phase 1: Foundation ✅

- [x] Project scaffolding and Moon v2 monorepo setup
- [x] Database schema design (Prisma)
- [x] Frontend scaffold (TanStack Start + shadcn/ui)

### Phase 2: API Integration (Current)

- [ ] Wikimedia API client (`packages/utils`)
- [ ] Background sync service
- [ ] Core metrics calculation engine

### Phase 3: Backend API

- [ ] Editor management endpoints
- [ ] Statistics endpoints
- [ ] Sync trigger endpoints

### Phase 4: Frontend Dashboard

- [ ] Overall statistics dashboard
- [ ] Per-editor statistics view
- [ ] Time-series visualizations (Chart.js)
- [ ] Date range and wiki project filtering

### Phase 5: Polish & Deploy

- [ ] Export functionality (CSV)
- [ ] Migration to Wikimedia Cloud Services
- [ ] CI/CD with GitHub Actions
- [ ] Performance optimization

> 📖 For detailed task breakdown, see [docs/TASKS.md](docs/TASKS.md)

## Contributing

This is an open-source project and contributions are welcome! Please ensure:

- All code follows TypeScript best practices
- Database changes include proper migrations
- API endpoints are documented
- Tests are included for new features

## Documentation

- [README.md](README.md) - Project overview and getting started
- [docs/HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) - Technical design, APIs, database schema, and mockups
- [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) - Folder mapping and implementation roadmap
- [docs/TASKS.md](docs/TASKS.md) - Task overview organized by phase

### Issue Tracking

This project uses [bd (beads)](https://github.com/symphco/beads) for issue tracking:

```bash
bd ready              # Show available work
bd show <id>          # View issue details
bd update <id> --status in_progress  # Claim work
bd close <id>         # Complete work
```

## License

[To be determined - typically MIT or GPL for Wikimedia-aligned projects]

## Contact

For questions or support, please contact the OKA team.

## Acknowledgments

Built with support from the Open Knowledge Association and the broader Wikimedia community.
