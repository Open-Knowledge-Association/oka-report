# Fix Pageview Title Encoding (Spaces to Underscores)

## TL;DR

> **Quick Summary**: Fix 404 errors in pageview sync by converting spaces to underscores in article titles before calling Wikimedia Pageviews API.
>
> **Deliverables**:
>
> - Modified `packages/utils/src/wikimedia/pageviews.ts` with title normalization
> - Unit test for the fix
>
> **Estimated Effort**: Quick (10 minutes)
> **Parallel Execution**: NO - single task
> **Critical Path**: Task 1

---

## Context

### Original Request

User noticed many 404 errors when running pageview sync:

```
Pageviews unavailable for article "Colli di Sant'Erasmo" (id) on en.wikipedia.org: 404 Not Found
Pageviews unavailable for article "Tsuen Kam Interchange" (id) on en.wikipedia.org: 404 Not Found
```

### Root Cause Analysis

**Investigation found:**

- Articles DO exist on Wikipedia (manual curl test succeeds)
- Database stores titles with **spaces**: `"Colli di Sant'Erasmo"`
- Wikimedia Pageviews API expects **underscores**: `"Colli_di_Sant'Erasmo"`
- Current code at line 31 uses `encodeURIComponent(article)` but doesn't convert spaces to underscores first

### The Fix

Add one line to normalize title before encoding:

```typescript
const normalizedTitle = article.replace(/ /g, "_");
const encodedArticle = encodeURIComponent(normalizedTitle);
```

---

## Work Objectives

### Core Objective

Ensure article titles are properly formatted for Wikimedia Pageviews API by converting spaces to underscores.

### Concrete Deliverables

- `packages/utils/src/wikimedia/pageviews.ts` - Add title normalization

### Definition of Done

- [x] Spaces in article titles are converted to underscores before API call
- [x] Existing articles no longer return 404
- [x] No breaking changes to function signature

### Must Have

- Convert spaces to underscores: `article.replace(/ /g, '_')`
- Apply BEFORE `encodeURIComponent()`

### Must NOT Have (Guardrails)

- DO NOT change the function signature
- DO NOT change any other files
- DO NOT add new dependencies

---

## TODOs

- [x] 1. Add title normalization to getPageviews function

  **What to do**:
  - Open `packages/utils/src/wikimedia/pageviews.ts`
  - At line 31, change from:
    ```typescript
    const encodedArticle = encodeURIComponent(article);
    ```
  - To:
    ```typescript
    // Normalize title: Wikimedia Pageviews API expects underscores instead of spaces
    const normalizedTitle = article.replace(/ /g, "_");
    const encodedArticle = encodeURIComponent(normalizedTitle);
    ```

  **Must NOT do**:
  - DO NOT change function parameters
  - DO NOT modify other functions

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single line addition, trivial change
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Single task
  - **Blocks**: None
  - **Blocked By**: None

  **References**:
  - `packages/utils/src/wikimedia/pageviews.ts:24-40` - getPageviews function
  - `packages/utils/src/wikimedia/pageviews.ts:31` - Exact line to modify

  **Acceptance Criteria**:

  **Agent-Executed QA Scenarios:**

  ```
  Scenario: Verify normalization code exists
    Tool: Bash (grep)
    Steps:
      1. grep "replace.*/ /g" packages/utils/src/wikimedia/pageviews.ts
      2. Assert: Output shows the replace call for spaces to underscores
    Expected Result: Normalization code present
    Evidence: grep output

  Scenario: TypeScript compiles
    Tool: Bash
    Steps:
      1. cd packages/utils && bun run tsc --noEmit
      2. Assert: Exit code 0
    Expected Result: No type errors
    Evidence: Command output
  ```

  **Commit**: YES
  - Message: `fix(utils): normalize article titles for Pageviews API (spaces to underscores)`
  - Files: `packages/utils/src/wikimedia/pageviews.ts`
  - Pre-commit: `bun run tsc --noEmit`

---

## Commit Strategy

| After Task | Message                                                                          | Files        | Verification |
| ---------- | -------------------------------------------------------------------------------- | ------------ | ------------ |
| 1          | `fix(utils): normalize article titles for Pageviews API (spaces to underscores)` | pageviews.ts | grep + tsc   |

---

## Success Criteria

### Verification Commands

```bash
# Check normalization code exists
grep "replace.*/ /g" packages/utils/src/wikimedia/pageviews.ts

# TypeScript compilation
cd packages/utils && bun run tsc --noEmit

# Manual test (after fix, run sync and check fewer 404s)
```

### Final Checklist

- [x] `article.replace(/ /g, '_')` added before encodeURIComponent
- [x] TypeScript compiles without errors
- [x] No changes to function signature
