# Implementation Guide: editor-list-proper-links

## Summary

This plan fixes the editor list page to enable navigation to internal profile pages.

## Problem

- `editors.tsx` links to Wikipedia user pages (external)
- Cannot access internal editor profile pages from the list
- Data comes from Outreach API directly (not local DB)

## Solution

1. Enhance `/api/editors` to return editors with Outreach stats
2. Update `editors.tsx` to use local API and `<Link>` for internal navigation
3. Verify end-to-end flow works

## Files to Modify

### 1. `apps/api/src/routes/editors.ts`

**See**: `.sisyphus/IMPLEMENTATION_TASK_1.md`

Changes:

- Add `OutreachDashboardClient` import
- Initialize dashboard client
- Modify GET "/" handler to enrich editors with Outreach stats
- Return: `id`, `username`, `characterSum`, `referencesCount`, `uploadsCount`

### 2. `apps/web/src/routes/editors.tsx`

**See**: `.sisyphus/IMPLEMENTATION_TASK_2.md`

Changes:

- Remove `fetchOutreachUsers` import
- Add local `fetchEditors()` function
- Update `useQuery` to use new fetch function
- Replace `<a href="...wikipedia...">` with `<Link to={`/editors/${id}`}>`
- Update loading and error messages

## Verification

**See**: `.sisyphus/IMPLEMENTATION_TASK_3.md`

Steps:

1. Restart dev servers
2. Test API endpoint returns enriched data
3. Test frontend navigation (list → click → profile → back)
4. Verify no console errors
5. Test mobile responsive

## Commands

```bash
# After making changes, restart servers
moon run :dev

# Test API
curl -s "http://localhost:3000/api/editors?limit=3" | jq '.data[0]'

# Commit changes
git add apps/api/src/routes/editors.ts apps/web/src/routes/editors.tsx
git commit -m "feat: enable editor profile navigation from list"
```

## Expected Result

- ✅ Click username in list → navigates to `/editors/{id}`
- ✅ Profile page loads with charts, stats, badges
- ✅ SPA navigation (no page reload)
- ✅ Stats match Outreach Dashboard values
