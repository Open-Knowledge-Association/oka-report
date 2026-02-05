# Recovery Article Sync

## TL;DR

> **Summary**: Restart article sync setelah server crash
> **Effort**: 10 menit
> **Sequential**: Yes

---

## Context

Server mati saat article sync berjalan (34%, 16,000/46,887 articles). Perlu:

1. Reset stuck jobs
2. Trigger ulang sync
3. Verify relationships terbuat

---

## TODOs

- [x] 1. Cek Server Status

  **Commands**:

  ```bash
  curl -s "http://localhost:3000/api/editors?limit=1" | head -c 100
  ```

  **If no response**: Start server dulu

  ```bash
  cd /home/rio/Works/oka/report/apps/api && bun run dev
  ```

---

- [x] 2. Cek Sync Jobs

  **Command**:

  ```bash
  curl -s "http://localhost:3000/api/sync/history?limit=5" | jq '.data[] | {id, jobType, status}'
  ```

  **Decision**: Jika ada `status: "running"` → lanjut Task 3

---

- [x] 3. Reset Stuck Jobs

  **Via Prisma**:

  ```bash
  cd /home/rio/Works/oka/report/packages/db
  echo "UPDATE sync_jobs SET status = 'failed' WHERE status = 'running';" | bunx prisma db execute --stdin
  ```

  **Verify**:

  ```bash
  curl -s "http://localhost:3000/api/sync/history?limit=3" | jq '.data[] | {status}'
  ```

---

- [x] 4. Trigger New Sync

  **Command**:

  ```bash
  curl -X POST "http://localhost:3000/api/outreach/articles/sync" \
    -H "Content-Type: application/json" \
    -d '{"school": "OKA", "slug": "OKA"}'
  ```

---

- [x] 5. Verify Sync Running

  **Command**:

  ```bash
  curl -s "http://localhost:3000/api/sync/history?limit=1" | jq '.data[0]'
  ```

  **Expected**: `status: "running"` atau `"pending"`

---

- [x] 6. Verify Articles Have Editors

  **Command**:

  ```bash
  curl -s "http://localhost:3000/api/outreach/articles/db?limit=5" | jq '.data.articles | map({title, editorCount: (.editors | length)})'
  ```

  **Expected**: `editorCount > 0`

---

## Success Criteria

- [x] No stuck "running" jobs
- [x] New sync running
- [x] Articles have editors
