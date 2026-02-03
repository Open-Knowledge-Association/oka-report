# Outreach Dashboard Integration

> **Reference**: OKA Course Dashboard - https://outreachdashboard.wmflabs.org/courses/OKA/OKA/

This document describes how to integrate the OKA Stats Platform with the Wikimedia Outreach Dashboard to import editor data and contribution statistics.

---

## Overview

The Outreach Dashboard (Wiki Education Foundation) tracks Wikipedia editing activities for courses and events. The OKA organization has a course at `OKA/OKA` that tracks member contributions across multiple Wikipedia language editions.

### Why This Integration Matters

1. **Single Source of Truth**: The Outreach Dashboard already tracks OKA member contributions
2. **Historical Data**: Access to contribution history from 2022-present
3. **Multi-Wiki Support**: Tracks edits across en, es, pt Wikipedia and Commons
4. **Automated Reporting**: Eliminates manual data entry for accountability reports

---

## Available API Endpoints

### Public JSON Endpoints (No Authentication Required)

| Endpoint        | URL Pattern                                 | Description                                    |
| --------------- | ------------------------------------------- | ---------------------------------------------- |
| **Course Data** | `/courses/{school}/{slug}/course.json`      | Course metadata, stats, enrolled editors count |
| **Articles**    | `/courses/{school}/{slug}/articles.json`    | Articles edited by course participants         |
| **Users**       | `/courses/{school}/{slug}/users.json`       | Detailed user statistics                       |
| **Assignments** | `/courses/{school}/{slug}/assignments.json` | Article assignments                            |
| **Uploads**     | `/courses/{school}/{slug}/uploads.json`     | Commons uploads                                |

### OKA Course Specific URLs

```
https://outreachdashboard.wmflabs.org/courses/OKA/OKA/course.json
https://outreachdashboard.wmflabs.org/courses/OKA/OKA/articles.json
https://outreachdashboard.wmflabs.org/courses/OKA/OKA/users.json
https://outreachdashboard.wmflabs.org/courses/OKA/OKA/assignments.json
https://outreachdashboard.wmflabs.org/courses/OKA/OKA/uploads.json
```

### Authenticated CSV Exports (Requires Login)

| Endpoint                              | Description                   |
| ------------------------------------- | ----------------------------- |
| `/course_csv?course_id={id}`          | Full course statistics CSV    |
| `/course_students_csv?course_id={id}` | Students/enrolled editors CSV |
| `/course_articles_csv?course_id={id}` | Articles data CSV             |
| `/course_uploads_csv?course_id={id}`  | Commons uploads CSV           |

**Note**: CSV endpoints return 401 Unauthorized without authentication. Use JSON endpoints for programmatic access.

---

## Course Data Structure

### Course Metadata (course.json)

```typescript
interface OutreachCourse {
  course: {
    id: number; // 33560
    title: string; // "OKA"
    description: string; // Course description
    start: string; // ISO date
    end: string; // ISO date (2052-05-06 - effectively ongoing)
    school: string; // "OKA"
    slug: string; // "OKA/OKA"
    submitted: boolean;

    // Aggregated Statistics
    character_sum: number; // Total characters added: 382,309,004
    upload_count: number; // Total uploads: 2,712
    uploads_in_use_count: number; // Uploads currently used: 469
    upload_usages_count: number; // Total usage count: 693

    // Wiki Coverage
    wikis: Array<{
      language: string;
      project: string;
    }>;

    // Calculated Stats
    created_count: string; // "13.3K" - articles created
    edited_count: string; // "46.8K" - articles edited
    article_count: number; // 46,831 - total articles
    edit_count: string; // "123K" - total edits
    student_count: number; // 53 - enrolled editors
    trained_count: number; // 53 - trained editors
    word_count: string; // "73.9M" - words added
    references_count: string; // "730K" - references added
    view_count: string; // "2.31B" - page views
    character_sum_human: string; // "382M" - human-readable

    // Per-Wiki Breakdown
    course_stats: {
      stats_hash: {
        [wikiNamespace: string]: {
          edited_count: string;
          new_count: string;
          revision_count: string;
          user_count: string;
          word_count: string;
          reference_count: string;
          view_count: string;
        };
      };
    };
  };
}
```

### Wiki Namespaces Tracked

| Wiki              | Namespaces                               |
| ----------------- | ---------------------------------------- |
| en.wikipedia      | 0 (Articles), 6 (Files), 14 (Categories) |
| pt.wikipedia      | 0, 6, 14, 10 (Templates)                 |
| es.wikipedia      | 10, 0, 14, 6                             |
| commons.wikimedia | 0, 14, 8                                 |

---

## Data Mapping

### Mapping Outreach Dashboard → OKA Stats Platform

| Outreach Field            | OKA Stats Field             | Table                 | Notes                         |
| ------------------------- | --------------------------- | --------------------- | ----------------------------- |
| `course.student_count`    | -                           | -                     | Use to verify import count    |
| `course.wikis`            | `wikiProject`               | Article, Contribution | Map to "{lang}.{project}.org" |
| `users.username`          | `Editor.username`           | Editor                | Direct mapping                |
| `users.id`                | `Editor.externalId`         | Editor                | Store as string               |
| `articles.title`          | `Article.title`             | Article               | Convert underscores           |
| `articles.page_id`        | `Article.pageId`            | Article               | Direct mapping                |
| `articles.wiki`           | `Article.wikiProject`       | Article               | Format as URL                 |
| `articles.character_sum`  | `Contribution.bytesChanged` | Contribution          | Character = Byte              |
| `articles.revision_count` | -                           | -                     | Use for validation            |
| `uploads.file_name`       | `CommonsUpload.fileName`    | CommonsUpload         | Direct mapping                |

### Important Mapping Notes

1. **Words Calculation**: Outreach Dashboard uses bytes/6 for word estimation (same as our methodology)
2. **Wiki Project Format**: Dashboard uses `{lang}.{project}` → We use `{lang}.{project}.org`
3. **Title Format**: Both use underscores for spaces
4. **Date Range**: Dashboard course runs 2022-2052, we can filter by actual contribution dates

---

## Integration Architecture

### Sync Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              Outreach Dashboard Sync Process                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Fetch      │───▶│  Parse &     │───▶│  Store in        │   │
│  │  course.json│    │  Transform   │    │  Database        │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│         │                  │                     │              │
│         ▼                  ▼                     ▼              │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Get editor │    │  Map to      │    │  Insert/Update   │   │
│  │  list from  │    │  Editor      │    │  Editor records  │   │
│  │  users.json │    │  model       │    │  (source=        │   │
│  │             │    │              │    │   outreach_      │   │
│  │             │    │              │    │   dashboard)     │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│                                                                 │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Fetch      │    │  Create      │    │  Store           │   │
│  │  articles   │───▶│  Article &   │───▶│  Contributions   │   │
│  │  per editor │    │  Contribution│    │                  │   │
│  └─────────────┘    └──────────────┘    └──────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation Components

1. **OutreachDashboardClient** (`packages/utils/src/outreach-dashboard/`)
   - HTTP client for dashboard API
   - Methods: `getCourse()`, `getUsers()`, `getUploads()`
   - Response type definitions

2. **OutreachSyncService** (`apps/api/src/services/`)
   - `syncEditorsFromDashboard()` - Import/update editor list
   - `syncContributionsFromDashboard()` - Import contribution data
   - `getDashboardStats()` - Fetch current course statistics

3. **API Routes** (`apps/api/src/routes/`)
   - `POST /api/sync/outreach` - Trigger manual sync
   - `GET /api/sync/outreach/status` - Check sync status
   - `GET /api/stats/outreach` - Get dashboard-derived stats

4. **Admin UI** (`apps/web/src/routes/admin/`)
   - Sync button with progress indicator
   - Last sync timestamp display
   - Editor import preview

---

## Usage Examples

### Fetch Course Statistics

```typescript
import { OutreachDashboardClient } from "@oka/utils/outreach-dashboard";

const client = new OutreachDashboardClient();

// Get course metadata
const course = await client.getCourse("OKA", "OKA");
console.log(`Enrolled editors: ${course.course.student_count}`);
console.log(`Total edits: ${course.course.edit_count}`);
console.log(`Words added: ${course.course.word_count}`);
```

### Sync Editors

```typescript
import { OutreachSyncService } from "@/services/outreach-sync.service";

const syncService = new OutreachSyncService();

// Import all editors from dashboard
const result = await syncService.syncEditorsFromDashboard("OKA", "OKA");
console.log(`Imported ${result.imported} editors`);
console.log(`Updated ${result.updated} editors`);
console.log(`Skipped ${result.duplicates} duplicates`);
```

### API Endpoint

```bash
# Trigger manual sync
curl -X POST http://localhost:3000/api/sync/outreach \
  -H "Content-Type: application/json" \
  -d '{"school": "OKA", "slug": "OKA"}'

# Response
{
  "success": true,
  "data": {
    "editorsImported": 53,
    "editorsUpdated": 0,
    "syncJobId": "clx123..."
  }
}
```

---

## Current OKA Course Statistics (Snapshot)

**As of 2026-02-03:**

| Metric           | Value   |
| ---------------- | ------- |
| Course ID        | 33560   |
| Enrolled Editors | 53      |
| Total Edits      | 123,000 |
| Articles Created | 13,300  |
| Articles Edited  | 46,800  |
| Total Articles   | 46,831  |
| Words Added      | 73.9M   |
| References Added | 730K    |
| Page Views       | 2.31B   |
| Character Sum    | 382M    |
| Uploads          | 2,712   |
| Uploads in Use   | 469     |

### Per-Wiki Breakdown

| Wiki         | Edits | New Articles | Words | Users |
| ------------ | ----- | ------------ | ----- | ----- |
| en.wikipedia | 16.7K | 4.84K        | 35M   | 51    |
| pt.wikipedia | 22.7K | 6.51K        | 26.7M | 18    |
| es.wikipedia | 7.07K | 1.87K        | 12.2M | 15    |

---

## Limitations & Considerations

1. **Historical Data**: Dashboard tracks from 2022-05-06 to present
2. **Real-time Lag**: Dashboard updates are batched, not real-time
3. **User Privacy**: Only aggregate data is public; individual user details may require authentication
4. **Rate Limiting**: Be respectful with API calls; cache results when possible
5. **Data Duplication**: Must handle cases where editors are already in our database

---

## Related Issues

- `report-bbr` - Create API client for dashboard data fetching
- `report-633` - Sync service to import editors from dashboard
- `report-umv` - Import contributions data from dashboard course
- `report-931` - UI for dashboard sync management
- `report-71k` - Document API endpoints and data mapping (this document)

---

## References

- [Outreach Dashboard GitHub](https://github.com/WikiEducationFoundation/WikiEduDashboard)
- [OKA Course Page](https://outreachdashboard.wmflabs.org/courses/OKA/OKA/)
- [HIGH_LEVEL_DESIGN.md](./HIGH_LEVEL_DESIGN.md) - Platform technical design
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Implementation roadmap
