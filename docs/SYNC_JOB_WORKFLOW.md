# Sync Job Workflow and Impact

This document explains each sync job type, the correct execution order, and what data each job impacts.

## Quick Playbook (If X, run Y)

Use this section as a fast operational checklist.

| Symptom                                             | Run This                                | Then Run                                          | Why                                                         |
| --------------------------------------------------- | --------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| Views exist, but edits/words are zero for some wiki | `contributions`                         | `history_backfill` (affected range)               | Contribution table is stale/missing; reports read snapshots |
| Uploads are zero in Dashboard/Editors/History       | `commons`                               | `history_backfill` (affected range)               | Commons table feeds upload metrics; history needs recompute |
| Pageviews stale or many missing rows                | `pageviews`                             | `history_backfill` (optional for history screens) | Refresh daily pageviews first, then snapshot layer          |
| New participants not visible                        | `editors`                               | `full` or `contributions`                         | Editor roster must exist before contribution linkage        |
| New Outreach articles not visible                   | `outreach_articles`                     | `contributions` + `pageviews`                     | Article catalog needs refresh before downstream syncs       |
| Full sync failed at mid-stage                       | Retry failed child job (targeted)       | `history_backfill` if reports look off            | Faster recovery than rerunning everything                   |
| History table/cards inconsistent after bugfix       | (targeted raw-data sync jobs as needed) | `history_backfill`                                | Rebuild snapshots from source-of-truth tables               |

### Recommended order for manual recovery

1. Fix source data first: `editors` -> `outreach_articles` -> `contributions` -> `pageviews` -> `commons`
2. Rebuild snapshot layer: `history_backfill`
3. Validate on UI: Dashboard, Editors, Articles, History

## Quick Answer

- Use `full` for normal daily/regular sync.
- Use targeted jobs (`editors`, `outreach_articles`, `contributions`, `pageviews`, `commons`) for troubleshooting or partial refresh.
- Use `history_backfill` after major sync changes or when historical snapshots are missing/wrong.

---

## Job Types and What They Do

## 1) `editors`

Purpose:

- Sync editor roster from Outreach Dashboard (`OKA/OKA`) into `editors`.

Main impact:

- Upsert tracked editors (`username`, `externalId`, `isActive`, `source`).

Tables affected:

- `editors`
- `sync_jobs` (job log/metadata)

When to run:

- New participants expected.
- User list changed in Outreach Dashboard.

---

## 2) `outreach_articles`

Purpose:

- Sync article list and article metadata from Outreach Dashboard.

Main impact:

- Upsert articles and article-editor links.
- Upsert daily `CUMULATIVE` pageview snapshot (`agentType=ALL_AGENTS`) from dashboard `view_count`.

Tables affected:

- `articles`
- `article_editors`
- `pageviews` (type `CUMULATIVE`)
- `sync_jobs`

When to run:

- Before contributions/pageviews if article set changed.
- After Outreach course data updates.

---

## 3) `contributions`

Purpose:

- Sync edit history per tracked editor from Wikimedia user contributions.

Main impact:

- Upsert revisions into `contributions`.
- Set `createdByEditorId` for creation revisions.
- Uses multi-wiki fetch based on tracked article wiki projects (en/es/pt/etc.).

Tables affected:

- `contributions`
- `articles` (`createdByEditorId`, `pageId` updates in matching flow)
- `sync_jobs`

When to run:

- Edits/words are stale.
- Wiki breakdown shows views but edits/words are zero.

---

## 4) `pageviews`

Purpose:

- Sync article daily pageviews from Wikimedia Pageviews API.

Main impact:

- Upsert `DAILY` pageviews for tracked articles.
- Stores both agent types (`ALL_AGENTS` + `USER`) per day.
- Tracks progress metadata and 404 summary.

Tables affected:

- `pageviews` (type `DAILY`, `agentType`)
- `sync_jobs` metadata (stage, counters, skipped404)

When to run:

- Views are stale/missing.
- After contributions/articles changes.

---

## 5) `commons`

Purpose:

- Sync Wikimedia Commons uploads per tracked editor.

Main impact:

- Upsert files by `fileName` into `commons_uploads`.

Tables affected:

- `commons_uploads`
- `sync_jobs`

When to run:

- Upload metrics are zero/old in Dashboard, Editors, Articles, History.

---

## 6) `full`

Purpose:

- End-to-end orchestration job.

Execution order:

1. `editors`
2. `outreach_articles`
3. `contributions`
4. `pageviews`
5. `commons`

Main impact:

- Refreshes all operational datasets in one run.
- Parent job metadata tracks child progress/stage.

Tables affected:

- All above (`editors`, `articles`, `article_editors`, `contributions`, `pageviews`, `commons_uploads`, `sync_jobs`)

Important:

- If one child fails (example: `pageviews`), later children may not run.
- Example side-effect: `commons_uploads` remains zero if full sync fails before commons stage.

---

## 7) `history_backfill`

Purpose:

- Rebuild daily snapshot history for a date range.

Main impact:

- Recomputes day-level snapshot tables from source-of-truth tables.

Tables affected:

- `daily_stats`
- `daily_wiki_stats`
- `daily_source_stats`
- `daily_wiki_source_stats`
- `editor_daily_stats`
- `article_daily_stats`
- `sync_jobs`

When to run:

- After fixing sync logic.
- After large historical imports.
- When history cards/tables look inconsistent.

---

## Recommended Workflow

## A) Normal daily operation

1. Run `full`.
2. Check `sync-jobs` status is `completed`.
3. If any child failed, run only failed targeted job(s).

## B) After logic/schema fixes

1. Run targeted data jobs as needed (`contributions`, `pageviews`, `commons`).
2. Run `history_backfill` for affected date range.
3. Re-check reports/history.

## C) If metrics are weird (quick diagnosis)

- Views exist, edits/words zero by wiki:
  - Run `contributions` (multi-wiki) then `history_backfill`.
- Uploads zero everywhere:
  - Run `commons` then `history_backfill`.
- Daily tables outdated but raw tables look fresh:
  - Run `history_backfill`.

---

## Dependency Notes

- `contributions` depends on article matching (`title + wikiProject`) to link revisions.
- `pageviews` requires tracked articles (especially those with creator linkage for daily sync selection).
- `history_backfill` should be treated as the final reconciliation step after source tables are up to date.

---

## Operational Tips

- Use retry for failed jobs in Sync Job Manager.
- Avoid running duplicate active job types simultaneously.
- Prefer targeted rerun over full rerun when only one area is stale.
- For very large ranges, run `history_backfill` in chunks (e.g. quarter by quarter).

---

## File References (Implementation)

- `apps/api/src/routes/sync.ts`
- `apps/api/src/services/sync.service.ts`
- `apps/api/src/services/outreach-sync.service.ts`
- `apps/api/src/services/outreach-article-sync.service.ts`
- `apps/api/src/routes/stats.ts` (`/history/backfill`)
