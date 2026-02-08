# Draft: Dashboard Requires Authentication

## Requirements (confirmed)

- Dashboard pages must not be visible without login.
- Existing Google auth/session flow should be used.

## Scope Boundaries

- INCLUDE: frontend route guard for dashboard/admin pages, redirect to sign-in, backend protected endpoint checks validation.
- EXCLUDE: redesign of auth provider, additional auth providers.

## Test Strategy Decision

- Automated tests: TDD
- Agent-Executed QA: mandatory
