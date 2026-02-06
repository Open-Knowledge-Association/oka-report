# Draft: Peningkatan Halaman Detail Editor

## User Decision (confirmed)

- User ingin MEMAKSIMALKAN semua aspek:
  - [x] Tambah visualisasi/chart
  - [x] Tambah data/metrik baru
  - [x] Perbaikan UI/UX
  - [x] Fitur baru
  - [x] Perbaikan tabel artikel
- Referensi UI: Tidak ada khusus, terserah desain terbaik

## Current State

Halaman Editor Profile (`editors.$editorId.tsx`) saat ini menampilkan:

- Header: Username + link ke Wikipedia user page
- 4 Stat Cards: Articles, Characters Added, References Added, Pageviews
- Wikipedia Profile section: Registration date, Total edits, Gender
- Articles table: Title, Wiki, Characters, References

## Available Data (from DB/API that's NOT yet displayed)

**From Database Schema:**

- `EditorDailyStat` - edits, wordsAdded, articlesCreated, articlesEdited, referencesAdded, commonsUploads per day → bisa untuk time-series chart
- `CommonsUpload` - fileName, fileUrl, fileSize, mimeType, uploadedAt → bisa tampilkan di profile
- `Contribution` - bytesChanged, wordsAdded, isCreation, editTimestamp → detail kontribusi
- `Pageview` (daily) - views per hari per artikel → trend chart
- Article `isNewArticle`, `rating` - belum ditampilkan

**From Wikimedia API (sudah ada di profile endpoint):**

- wikimediaProfile.editCount, registration, gender

## Technical Context

- Stack: TanStack Start + shadcn/ui + Tailwind CSS v4
- Data source: `/api/editors/{id}/profile` endpoint
- Component location: `apps/web/src/routes/editors.$editorId.tsx`
- UI Guidelines: docs/UI_RULES_OF_THUMB.md

## Confirmed Decisions

### Visualizations (all selected)

1. Contribution Timeline Chart - trend kontribusi per bulan/minggu
2. Pageviews per Article Chart - bar chart pageviews per artikel
3. Activity Heatmap (GitHub-style) - aktivitas harian
4. Wiki Distribution Chart - pie/donut distribusi per wiki

### New Data/Metrics (all selected)

1. Commons Uploads Gallery - tampilkan foto/file uploads
2. Full Wikipedia Stats - stats lengkap dari Wikimedia API
3. Words Added Metric - bukan hanya karakter
4. Daily Activity Stats - untuk time-series

### New Features (all selected)

1. Export Profile (CSV/PDF)
2. Share Profile
3. Compare Editors
4. Achievement Badges

### Table Improvements (all selected)

1. Sorting & Filtering
2. More Columns (pageviews, rating, is_new)
3. Pagination
4. Search Box

### Technical Decisions

- **Priority**: Semua sama penting, implementasi bertahap
- **Chart Library**: Chart.js (Recommended)
- **Backend**: Sesuai kebutuhan (boleh buat endpoint baru)
- **Testing**: TDD (Test-Driven Development) dengan Vitest
- **Activity Heatmap**: External library (react-activity-calendar atau similar)
- **Compare Editors**: New dedicated page (/editors/compare)
- **Export Scope**: Full data export (summary + articles + daily stats)
- **Article Volume**: < 50 per editor (client-side pagination cukup)
- **Mobile Charts**: Tabbed view (user pilih chart)

### Achievement Badges (7 total)

1. 🎉 First Article - First article created
2. 📚 Centurion - 100+ articles contributed
3. ✍️ Wordsmith - 1000+ characters added
4. 👁️ Popular - 10000+ total pageviews
5. 📷 Photographer - 5+ Commons uploads
6. 🔥 Consistent - 30+ days active
7. 🌍 Polyglot - 3+ different wikis

## Scope Boundaries

- **INCLUDE**:
  - All 4 visualizations
  - All 4 new metrics/data sections
  - All 4 new features
  - All 4 table improvements
  - New API endpoints as needed
  - Vitest tests (TDD approach)
- **EXCLUDE**:
  - Authentication/authorization changes
  - Database schema changes (use existing tables)
  - Mobile app (web only)
  - Real-time updates (batch/refresh based)
