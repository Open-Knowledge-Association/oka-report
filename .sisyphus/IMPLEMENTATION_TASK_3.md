# Task 3: E2E Verification - Full Flow

## Verification Steps

### Step 1: Restart Dev Servers

```bash
cd /home/rio/Works/oka/report
moon run :dev
```

### Step 2: Test API Endpoint

```bash
# Test /api/editors endpoint
curl -s "http://localhost:3000/api/editors?limit=3" | jq '.data[0] | {id, username, characterSum, referencesCount, uploadsCount}'

# Expected output:
# {
#   "id": "cmla82s1k0tyxvgjge1nrdahg",
#   "username": "Andreachlc0203",
#   "characterSum": 1234567,
#   "referencesCount": 89,
#   "uploadsCount": 12
# }
```

### Step 3: Test Frontend Navigation

Open browser and navigate:

1. **Go to**: http://localhost:3001/editors
   - Should see editor list with stats
   - Should see 53 editors

2. **Click any username**
   - Should navigate to /editors/{id}
   - URL should change without page reload (SPA navigation)
   - Profile page should load with:
     - Username header
     - Stats cards (Articles, Characters, References, Pageviews)
     - Charts section
     - Achievement badges
     - Articles table

3. **Click browser back button**
   - Should return to /editors list
   - List should still be visible

### Step 4: Verify No Console Errors

Open browser DevTools (F12) → Console tab:

- Should see NO red error messages
- May see some warnings (acceptable)

### Step 5: Mobile Responsive Test

1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select "iPhone SE" or "375x667"
4. Navigate to /editors
5. Verify table is scrollable horizontally
6. Click username and verify profile loads

### Step 6: Compare Stats

Verify stats consistency:

```bash
# Get stats from local API
curl -s "http://localhost:3000/api/editors?limit=1" | jq '.data[0].characterSum'

# Get stats from Outreach API
curl -s "http://localhost:3000/api/outreach/users?school=OKA&slug=OKA" | jq '.data.course.users[0].character_sum_ms'

# Values should match
```

## Expected Results

| Check         | Expected                        |
| ------------- | ------------------------------- |
| API response  | 200 OK with enriched data       |
| Editor list   | Shows 53 editors                |
| Username link | Internal navigation (no reload) |
| Profile page  | Loads with all sections         |
| Browser back  | Returns to list                 |
| Console       | No errors                       |
| Mobile        | Responsive layout               |
| Stats         | Match Outreach values           |

## Troubleshooting

### If API returns 500

- Check if Outreach API is accessible
- Check server logs: `tail -f apps/api/logs/*.log`

### If profile page shows 404

- Verify route exists: `ls apps/web/src/routes/editors.$editorId.tsx`
- Check if dev server regenerated routes

### If stats don't match

- Verify externalId is populated in database
- Check if Outreach sync ran successfully

## Final Checklist

- [ ] `/api/editors` returns enriched data
- [ ] Editor list page loads
- [ ] Username click navigates to profile
- [ ] Profile page shows correct data
- [ ] Browser back works
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Stats match Outreach Dashboard

## Done!

All tasks completed successfully!
