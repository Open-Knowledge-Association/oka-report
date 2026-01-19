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

- **Runtime**: Bun
- **API Framework**: Hono
- **Database**: PostgreSQL with Prisma ORM
- **Language**: TypeScript
- **Build Tool**: Moon (monorepo orchestration)
- **Hosting**: Wikimedia Cloud Services (planned)

## Project Structure

```
report/
├── apps/
│   ├── api/          # Hono API server
│   └── web/          # Frontend application (planned)
├── docs/
│   └── HIGH_LEVEL_DESIGN.md  # Technical design document
├── packages/
│   ├── db/           # Prisma schema and database client
│   └── utils/        # Shared utilities
└── README.md
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (latest version)
- PostgreSQL database
- Node.js 18+ (for tooling compatibility)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd report
```

2. Install dependencies:

```bash
bun install
```

3. Set up environment variables:

Create `.env` file in the root:

```env
DATABASE_URL="postgresql://user:password@host:port/database"
```

4. Run database migrations:

```bash
cd packages/db
bun prisma migrate dev
```

5. Start the development server:

```bash
moon run api:dev
```

The API will be available at `http://localhost:3000`

## Development

### Running the API Server

```bash
moon run api:dev
```

### Database Management

```bash
# Generate Prisma Client
moon run db:generate

# Run migrations
cd packages/db && bun prisma migrate dev

# Open Prisma Studio
bun prisma studio
```

### Project Commands

```bash
# Install dependencies
bun install

# Run specific app
moon run api:dev
moon run web:dev

# Build all packages
moon run :build
```

## Architecture

The platform is built as a monorepo with clear separation of concerns:

- **API Layer**: RESTful API built with Hono for lightweight, fast HTTP handling
- **Database Layer**: PostgreSQL with Prisma for type-safe database operations
- **Integration Layer**: Consumes Wikimedia APIs for automated data collection
- **Frontend**: (Planned) Dashboard interface for visualization and filtering

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│   Frontend   │────▶│   Hono API   │────▶│      PostgreSQL DB       │
│   (Web App)  │◀────│   Server     │◀────│   (Prisma ORM)           │
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

### Phase 1 (Current)

- [x] Project scaffolding and monorepo setup
- [x] Database schema design
- [ ] Wikimedia API integration
- [ ] Core metrics calculation engine

### Phase 2

- [ ] Overall statistics dashboard
- [ ] Time-series visualizations
- [ ] Date range filtering

### Phase 3

- [ ] Per-editor statistics view
- [ ] Advanced filtering (editor, wiki version)
- [ ] Export functionality

### Phase 4

- [ ] Migration to Wikimedia Cloud Services
- [ ] Performance optimization
- [ ] Commons upload tracking

## Contributing

This is an open-source project and contributions are welcome! Please ensure:

- All code follows TypeScript best practices
- Database changes include proper migrations
- API endpoints are documented
- Tests are included for new features

## Documentation

- [README.md](README.md) - Project overview and getting started
- [docs/HIGH_LEVEL_DESIGN.md](docs/HIGH_LEVEL_DESIGN.md) - Technical design, APIs, database schema, and mockups

## License

[To be determined - typically MIT or GPL for Wikimedia-aligned projects]

## Contact

For questions or support, please contact the OKA team.

## Acknowledgments

Built with support from the Open Knowledge Association and the broader Wikimedia community.
