# Outreach Dashboard Fixes - Learnings

## 2026-02-04 - Bug Fixes Completed

### Issues Fixed

1. **TanStack Router Route Export Missing**
   - File: `apps/web/src/routes/admin/outreach.tsx`
   - Problem: Component exported as `export default` instead of using `createFileRoute`
   - Solution: Added `import { createFileRoute }` and `export const Route = createFileRoute("/admin/outreach")({...})`
   - Lesson: TanStack Router file-based routing requires the Route export pattern

2. **Missing useToast Hook**
   - File: `apps/web/src/hooks/use-toast.ts` (didn't exist)
   - Problem: Components imported `useToast` from `@/hooks/use-toast` but file didn't exist
   - Solution: Created basic useToast hook implementation
   - Lesson: Check for missing dependencies when build fails with import errors

3. **API Response Structure Mismatch**
   - File: `apps/api/src/services/outreach-sync.service.ts`
   - Problem: Code expected `{ users: [...] }` but actual API returns `{ course: { users: [...] } }`
   - Solution: Updated code to handle both structures: `userData.course?.users ?? userData.users ?? []`
   - Lesson: Always verify actual API response structure against assumptions

### Commits Created

1. `e53d9b4` - fix(web): add TanStack Router Route export to admin/outreach
2. `31daa93` - feat(web): add useToast hook for notifications
3. `dd2da0e` - fix(api): handle Outreach Dashboard API response structure correctly

### Data Import Results

- **54 editors imported** from Outreach Dashboard
  - 53 students + 1 instructor
  - All with `source='outreach_dashboard'`
  - Usernames normalized (spaces → underscores)
  - All marked as `isActive: true`

### Verification Commands

```bash
# Check editor count
curl "http://localhost:3000/api/editors?source=outreach_dashboard" | jq '.data | length'
# Result: 54

# Check course data
curl "http://localhost:3000/api/outreach/course?school=OKA&slug=OKA" | jq '.data.course.id'
# Result: 33560

# Build verification
moon run :build
# Result: All tasks completed successfully
```

### Key Takeaways

1. **Always test the actual API** - Mock tests showed different structure than real API
2. **Build before claiming done** - Build caught the missing hook and route export issues
3. **Check route registration** - TanStack Router needs explicit Route export
4. **Handle API variations** - Real-world APIs may have nested structures
