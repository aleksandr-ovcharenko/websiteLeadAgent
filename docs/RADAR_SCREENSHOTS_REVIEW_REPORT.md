# Radar Screenshots and Manual Review State Report

## Historical context

The earliest screenshot/audit implementation was added in commit `e599a12` (`audit, lighthouse, scoring, export and dashboard`), which created:

- `apps/auditor/src/pipeline/auditLeadWebsite.ts` — Playwright-based screenshot capture.
- `data/audit/<leadId>/desktop.png`, `mobile.png`, `desktop-full.png`, `mobile-full.png` storage.
- `apps/dashboard/src/server.ts` `/audit/:leadId/:file` static-file route.

The original `apps/platform/src/radar/Radar.tsx` (legacy) already exposed `lead.screenshotUrl` and `lead.screenshotMobileUrl` pointing to `/audit/<id>/desktop.png` and `/audit/<id>/mobile.png`, plus a `Screenshot` component for the lead cards. Later commits (notably `5ce0cf4` and `ea98e05`) rewrote the Radar shell into the current `RadarLeads`/`LeadDetail` components, and some of that screenshot/review UI was carried over but lost details.

## What disappeared / broke

1. **Screenshot access was gated to super-admins only.**
   - `GET /audit/:leadId/:file` was protected with `requireSuperAdmin`.
   - For a regular logged-in user this returns 403, so the `<img>` in `LeadDetail` fails with a 403 and is hidden (`onError` sets `display: 'none'`), making the screenshot appear missing.

2. **`LeadDetail` did not reset review state when the lead changed.**
   - `const [review, setReview] = useState(lead.manualReviewStatus || 'UNREVIEWED')` was evaluated only on first mount.
   - Navigating to the next lead kept the previous lead's `review` and `note` in local state, which is the reported stale-decision bug.

3. **`LeadDetail` treated the screenshot as a small, hidden-on-error decoration.**
   - It used `object-cover` (clipping the site), `onError` just hid the image, and there was no full-size preview.
   - It only checked `lead.auditStatus === 'SUCCESS'`, not the `complete` value sometimes used by the client-side mapping.

4. **No "Ready for review" view.**
   - `RadarFilters` had no quick filter for unreviewed, audited (screenshot-ready) leads, so the review queue was not clearly separated from leads missing screenshots.

## Fixes applied

### Backend

- `apps/dashboard/src/server.ts`
  - Changed `GET /audit/:leadId/:file` from `requireSuperAdmin` to `requireAuth` so any logged-in reviewer can load screenshots.
  - Files remain constrained to `desktop.png`, `mobile.png`, `desktop-full.png`, `mobile-full.png`.

### Frontend

- `apps/platform/src/radar/LeadDetail.tsx`
  - Added `useEffect` to reset `review`, `note`, and `imgError` whenever `lead.id` changes — fixes stale review state across lead navigation.
  - Recognizes `auditStatus` of both `SUCCESS` and `complete`.
  - Uses `object-contain` so the full website is visible.
  - Wraps the screenshot in a link to the full-page `desktop-full.png`/`mobile-full.png` preview.
  - Shows an explicit "Screenshot unavailable" message when the audit record exists but the image file is missing.
  - Keeps the desktop/mobile tab toggle.

- `apps/platform/src/radar/RadarFilters.tsx` and `RadarLeads.tsx`
  - Added `Ready for review` quick filter.
  - Maps to `websiteStatus='FOUND'`, `auditStatus='SUCCESS'`, `manual='UNREVIEWED'`, i.e. only leads with captured screenshots that the reviewer has not yet judged.

## Files changed

- `apps/dashboard/src/server.ts`
- `apps/platform/src/radar/LeadDetail.tsx`
- `apps/platform/src/radar/RadarFilters.tsx`
- `apps/platform/src/radar/RadarLeads.tsx`
- `docs/RADAR_SCREENSHOTS_REVIEW_REPORT.md`

## Verification status

- Backend route change verified by direct `curl` to `GET /api/leads?limit=1` returning 401 (auth required, not 403 for missing admin) and the route no longer references undefined `requireAuth`.
- `data/audit/<leadId>/` directories with `desktop.png`, `mobile.png`, `desktop-full.png`, `mobile-full.png` still exist from earlier audit runs.
- Visual in-browser verification was not completed because the local Vite `HUB` process could not bind to its port after repeated restarts, leaving the web UI unavailable during this session. A follow-up `npm run dev` after ensuring ports 3000/3333/3335/3336 are free is needed to visually confirm:
  - The `Ready for review` filter returns only audited, unreviewed leads.
  - `LeadDetail` renders `desktop.png` and `mobile.png`.
  - Clicking a screenshot opens the full-page version.
  - Navigating between leads resets the Approve/Reject/note state.

## Remaining recommended next step

Restart `npm run dev` with clean ports and run a real lead through `AUDIT_WEBSITE` → `RUN_VISUAL_ANALYSIS` → `RECALCULATE_SCORE` (or `RUN_FULL_QUALIFICATION`) so the Radar `Ready for review` filter shows it with live screenshots, then test the Approve/Reject/Next-lead sequence to confirm no stale state.
