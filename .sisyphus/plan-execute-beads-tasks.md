# Plan: Execute Beads Tasks and Fix Bugs

## Overview
Execute all ready tasks from beads issue tracker and fix TypeScript compilation errors in the API.

## Analysis Summary

### Current State
- **10 ready tasks** in beads (all API endpoints)
- **TypeScript errors** need fixing in API
- Most API endpoints already implemented but need verification

### Existing Implementation Status

#### Already Implemented:
1. ✅ GET /api/editors - List all editors
2. ✅ POST /api/editors - Create editor
3. ✅ GET /api/editors/:id - Get editor by ID
4. ✅ PUT /api/editors/:id - Update editor
5. ✅ DELETE /api/editors/:id - Soft delete editor
6. ✅ GET /api/stats/overall - Overall statistics
7. ✅ GET /api/stats/editors - Stats by editor
8. ✅ GET /api/stats/editors/:id - Single editor stats
9. ✅ GET /api/stats/timeseries - Time series data
10. ✅ POST /api/sync/trigger - Trigger sync job
11. ✅ GET /api/sync/status - Get sync status
12. ✅ GET /api/sync/history - Get sync history

### TypeScript Errors to Fix

1. **apps/api/tsconfig.json** - Need to set target to ES2022 and enable skipLibCheck
2. **apps/api/src/services/sync.service.ts:164** - Type issue with metadata parameter

---

## Tasks

### Task 1: Fix TypeScript Configuration
**Priority:** HIGH  
**File:** `apps/api/tsconfig.json`

Update tsconfig.json with proper settings:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### Task 2: Fix SyncService Metadata Type
**Priority:** HIGH  
**File:** `apps/api/src/services/sync.service.ts`

At line 158, change the `completeSyncJob` method signature:
```typescript
// Change from:
async completeSyncJob(jobId: string, metadata?: Record<string, unknown>) {

// Change to:
async completeSyncJob(jobId: string, metadata?: Prisma.InputJsonObject) {
```

Or cast the metadata in the update call.

### Task 3: Close Completed Beads Tasks
**Priority:** MEDIUM

After verifying the code compiles, close these beads tasks:
- report-oxq: GET /api/editors
- report-abe: POST /api/editors
- report-95i: GET /api/editors/:id
- report-kos: PUT /api/editors/:id
- report-304: DELETE /api/editors/:id
- report-aa4: GET /api/stats/overall
- report-00x: GET /api/stats/editors
- report-b98: GET /api/stats/editors/:id
- report-fys: GET /api/stats/timeseries
- report-q25: POST /api/sync/trigger

Also close these that are implemented:
- report-juv: GET /api/sync/status
- report-y5a: GET /api/sync/history
- report-rzq: Error handling middleware
- report-11q: Zod validation schemas

### Task 4: Verify API Works
**Priority:** HIGH

Run the API server and verify endpoints work:
```bash
moon run api:dev
```

Test endpoints with curl or similar.

---

## Execution Order

1. Fix tsconfig.json
2. Fix sync.service.ts type issue
3. Run typecheck to verify fixes
4. Start API server to verify runtime
5. Close completed beads tasks
6. Sync beads with git
7. Commit changes
8. Push to remote

---

## Success Criteria

- [x] TypeScript compiles without errors
- [x] API server starts successfully
- [x] All implemented endpoints respond correctly
- [x] Beads tasks marked as closed
- [x] Changes committed and pushed

---

## Status: ✅ COMPLETED
All Phase 1 tasks completed on 2026-02-02.
