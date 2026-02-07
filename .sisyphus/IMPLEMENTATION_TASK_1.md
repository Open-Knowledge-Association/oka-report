# Task 1: Enhance /api/editors with Outreach Stats

## Changes Needed

### File: `apps/api/src/routes/editors.ts`

#### Step 1: Add import at line 2

```typescript
import { OutreachDashboardClient } from "@repo/utils";
```

#### Step 2: Add dashboardClient initialization after line 10

```typescript
const dashboardClient = new OutreachDashboardClient({
  baseUrl: "https://outreachdashboard.wmflabs.org",
});
```

#### Step 3: Replace lines 12-23 (GET "/" handler) with:

```typescript
editorsRoutes.get("/", async (c) => {
  const query = EditorQuerySchema.parse(c.req.query());
  const editors = await prisma.editor.findMany({
    where: {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search ? { username: { contains: query.search, mode: "insensitive" } } : {}),
    },
    orderBy: { username: "asc" },
  });

  // Fetch Outreach stats
  let outreachMap = new Map<string, any>();
  try {
    const userData = await dashboardClient.getUsers("OKA", "OKA");
    const users = userData.course?.users ?? userData.users ?? [];
    for (const user of users) {
      outreachMap.set(String(user.id), user);
    }
  } catch (error) {
    console.error("Failed to fetch Outreach stats:", error);
  }

  // Enrich editors with Outreach stats
  const enrichedEditors = editors.map((editor) => ({
    id: editor.id,
    username: editor.username,
    characterSum: outreachMap.get(editor.externalId ?? "")?.character_sum_ms ?? 0,
    referencesCount: outreachMap.get(editor.externalId ?? "")?.references_count ?? 0,
    uploadsCount: outreachMap.get(editor.externalId ?? "")?.total_uploads ?? 0,
  }));

  return c.json({ success: true, data: enrichedEditors });
});
```

## Verification

After making changes, run:

```bash
# Test the endpoint
curl -s "http://localhost:3000/api/editors?limit=3" | jq '.data[0] | {id, username, characterSum, referencesCount, uploadsCount}'

# Should return:
# {
#   "id": "cuid...",
#   "username": "...",
#   "characterSum": 12345,
#   "referencesCount": 67,
#   "uploadsCount": 8
# }
```

## Commit

```bash
git add apps/api/src/routes/editors.ts
git commit -m "feat(api): enhance /api/editors with Outreach stats enrichment"
```
