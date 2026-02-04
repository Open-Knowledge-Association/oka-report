# Fix API Timeout for Articles - Learnings

## 2026-02-04 - Task 1: Fix Bun Server Timeout

### Problem

Bun's default `idleTimeout` is 10 seconds, which is insufficient for fetching ~47K articles (~5MB payload) from Outreach Dashboard.

### Solution

Export a Bun server configuration object instead of just the Hono app:

```typescript
// Export app for tests (named export)
export { app };

// Export Bun server config with increased timeout
export default {
  port: 3000,
  fetch: app.fetch,
  idleTimeout: 60, // 60 seconds instead of default 10
};
```

### Key Insight: Dual Export Pattern

When changing from `export default app` to a server config object, tests break because they use `app.request()`. Solution:

1. Named export `{ app }` for tests
2. Default export server config for Bun runtime
3. Update tests to use named import: `import { app } from "../index"`

### Bun Server Config Options

- `port`: Server port (3000)
- `fetch`: Request handler function (`app.fetch` for Hono)
- `idleTimeout`: Max idle time in seconds (default: 10)
- `maxRequestBodySize`: Optional max body size

### Why 60 Seconds?

- ~47K articles payload is ~5MB
- External API + JSON parsing takes ~15-30s
- 60s provides comfortable buffer
- Can optimize later with pagination/streaming

### Files Changed

- `apps/api/src/index.ts` - Added server config with idleTimeout: 60
- `apps/api/src/__tests__/api.test.ts` - Updated import to use named export

### Verification

- Server starts successfully
- Responds to health check
- All commits pushed to origin/dev
