# Learnings: Dashboard Access Must Require Login

## Current State Findings

- Frontend already has auth primitives:
  - `apps/web/src/lib/auth.tsx` (`AuthProvider`, `useAuth`)
  - `apps/web/src/components/ProtectedRoute.tsx` (exists but needs route-level adoption)
  - `apps/web/src/components/Header.tsx` has sign-in/sign-out UX hooks.
- Backend already has session middleware:
  - `apps/api/src/middleware/auth.ts`
  - `apps/api/src/routes/auth.ts` (`/auth/session`, `/auth/logout`, Google endpoints)

## Required Guard Behavior

- Protect dashboard/app pages by default.
- Keep `/help` public.
- Keep `/api/auth/*` and `/api/health` public to avoid OAuth/login lockout.
- Protect API data/admin endpoints (`/api/stats/*`, `/api/editors/*`, `/api/articles/*`, `/api/sync/*`, `/api/scheduler/*`).

## Key Risks to Avoid

- Redirect loops if auth guard also blocks auth callback/session endpoints.
- SSR hydration flash if guard checks auth before session resolution.
- Inconsistent 401 handling in API client without centralized handling.

## TDD Verification Targets

- Unauthenticated API calls -> 401.
- Unauthenticated dashboard route -> blocked/redirected to sign-in.
- Auth endpoints remain reachable without session.
- Authenticated user can access dashboard and admin routes per role.

## Auth Middleware Implementation Summary

### Implementation Details

- **File Modified**: `apps/api/src/routes/index.ts`
- **Pattern Used**: Hono's `.use()` middleware on route prefixes followed by route mounting
- **Middleware Applied**: `authMiddleware` from `apps/api/src/middleware/auth.ts`

### Protected Routes (require authentication via session cookie)
```
- `/api/stats/*` 
- `/api/editors/*` 
- `/api/articles/*` 
- `/api/sync/*` 
- `/api/scheduler/*` 
- `/api/bootstrap/*` 
- `/api/outreach/*` 
```

### Public Routes (no authentication required)
```
- `/api/auth/*` (OAuth flow, login, logout)
- `/api/health` (health checks)
```

### Middleware Behavior
- **authMiddleware** validates session cookie (`session` token)
- Returns **401 Unauthorized** if no valid session
- Sets `ctx.user` and `ctx.session` for authenticated requests
- Session must exist in database and not be expired

### Test Updates
- Added `beforeAll` hook to create test user and session
- All protected endpoint tests now pass session cookie
- Test confirms unauthenticated requests return 401
- Public endpoints remain accessible without authentication

### Verification
✅ Build passes: `moon run api:build`
✅ Auth middleware applied to all protected routes
✅ Public routes remain accessible
✅ Unauthenticated requests return 401 status
✅ LSP diagnostics clean
