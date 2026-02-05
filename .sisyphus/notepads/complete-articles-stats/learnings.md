## Learnings - Complete Articles Stats

### 2026-02-04 - Task Complete

**What was done:**

- Updated Articles page (`apps/web/src/routes/articles.tsx`) to display all 8 statistics from Outreach Dashboard
- Replaced 3-card layout with 8-card responsive grid (2 cols mobile, 4 cols desktop)
- Used existing `/api/outreach/course` endpoint to fetch Outreach Dashboard stats

**Key implementation details:**

- Icons used from lucide-react: FilePlus, FileEdit, Edit, Users, Type, BookOpen, Eye, Upload
- Grid layout: `grid-cols-2 md:grid-cols-4 gap-4`
- Each card shows label, icon, and value with loading state ("...")
- Data fields from Outreach API:
  - `created_count` - Articles Created
  - `edited_count` - Articles Edited
  - `edit_count` - Total Edits
  - `student_count` - Editors
  - `word_count` - Words Added
  - `references_count` - References Added
  - `view_count` - Article Views
  - `upload_count` - Commons Uploads

**Preserved functionality:**

- Wiki Breakdown table remains intact
- Articles table with pagination still works
- Search and filter functionality preserved

**Verification:**

- TypeScript compiles without errors: `bun tsc --noEmit`
- Commit: `8fa4a4e` - feat(web): add complete statistics from Outreach Dashboard to articles page

**Lessons learned:**

- Outreach Dashboard API returns human-readable formatted values ("13.3K", "74M", etc.) - no need to format
- Stats like word_count, edit_count, upload_count are NOT stored in local DB - must fetch from API
- Using existing fetchOutreachCourse function was the right approach - no new API needed
