# WLA REVIEWER RULES

Rejection criteria for reviewing Radar / live-UI changes. These rules apply
alongside `invariants.md`. "Tests pass" does not override these UX regressions.

## Selection and focus

Reject a Radar implementation if:

- a background qualification or refetch changes the selected Lead;
- a background state change that removes the selected Lead from the current
  filtered view causes another Lead to be auto-selected — selection must stay
  on the (now off-view) Lead with a "no longer in current view" notice;
- user-caused removal and background removal are handled identically —
  explicit user actions may move selection to an adjacent row, background
  reconciliation may not;
- the Lead currently being qualified automatically steals focus;
- an OperationRun target automatically steals focus;
- a temporary refetch/loading state selects the first Lead;
- selection is keyed by row index or transient object reference instead of a
  stable `selectedLeadId`;
- the selected Lead's detail panel unmounts or resets during a background
  refresh while the Lead still exists.

## Live-update stability

Reject a Radar implementation if:

- the table visibly jumps during qualification — verify in a real browser;
- row order is technically stable but row geometry still shifts (bounding-box
  tops/heights, scrollTop);
- background updates change scrollTop;
- changing badge/status/score text shifts column widths (table must use
  `table-layout: fixed` with stable cell geometry);
- rows remount unnecessarily (keys must be stable lead IDs);
- the selected row moves position due to live score/status updates;
- new background rows are inserted above the user's current viewport — new
  rows append at the end;
- background reconciliation removes rows from under the user's viewport —
  removal waits for an explicit refresh boundary;
- a scrollbar appearing/disappearing shifts layout (use
  `scrollbar-gutter: stable`);
- unrelated Factory/Discovery/log events without a leadId refetch the Radar
  lead list;
- a log/activity event triggers a Lead list or stats refetch;
- multiple aggressive refresh mechanisms duplicate the same data without
  debounce/coalescing;
- scroll position, filters, search or sort reset on a live update;
- component keys use changing values (score, status, updatedAt) for stable
  entities;
- existing content flashes, disappears, or is replaced by a skeleton/empty
  state during reconciliation after the initial load;
- a Lead's status/score change remounts unrelated rows or the detail panel.

## Human review vs automation

Reject a Radar implementation if:

- GOOD / UNSURE / BAD are disabled or hidden solely because automated
  qualification is incomplete;
- early review controls look disabled (they must be muted but clearly
  clickable, with an "early review" indication);
- an early GOOD makes a Lead Ready for Generation before automated gates
  complete;
- an early BAD allows unnecessary later Audit/Lighthouse/AI/Scoring stages
  to be scheduled or queued work to run;
- an automated status update overwrites or resets a human review decision;
- review status and qualification status are conflated into one enum;
- cancelling a Lead's work kills shared browser/worker infrastructure;
- an operation is reported CANCELLED while its work is still running;
- rejecting a Lead causes the selection to jump to the lead currently being
  qualified instead of the adjacent row.

## Performance and rendering

Reject a Radar implementation if:

- one Lead's update causes all rows or the whole page to rerender/remount;
- the Activity Console grows unboundedly or pushes page controls;
- the table layout shifts on status transitions;
- counters remount or shift surrounding layout when values change.

## Evidence standard

- Verify Radar behavior in a real browser, not only via API/unit tests.
- A successful backend response is not proof of correct Radar UX.
- Reject a change that claims a live-update fix based only on unit tests —
  Playwright video/trace and bounding-box/scrollTop measurements are
  mandatory evidence.
- Reject a static screenshot presented as proof that flashing/jumping is
  fixed — motion evidence (video or trace) is required.
- Reject if repository AI invariants are stored only under a subdirectory
  such as `scripts/.ai` instead of root `.ai`.
- Reject a UI fix if a Playwright acceptance test requires force clicks,
  `dispatchEvent`, or DOM `click()` to get past an overlay — interception is
  a real UI bug, not a test artifact.
- Reject if a fixed/absolute panel intercepts unrelated controls (header
  actions, filters, row actions, navigation, scrollbars).
- Reject if "missing from payload" is treated as authoritative removal
  without proving the payload is a complete result for the current query
  scope (paginated/limited responses are not authoritative).

- Reject a DEMO_READY claim without a linked, non-empty screenshot file and
  a visible Hub preview — route-200 and CMS row counts are not evidence.
- Reject visual QA that was not actually executed (empty/error responses are
  not passes) — quota failures mean NEEDS_ATTENTION, not silent pass.
- Reject entity card images that are logos, SVG icons, or images shared as
  site-wide chrome across many documents.

### CATALOGUE-SITE REVIEW RULES

Reject a generated catalogue site if:
- Product cards show only image + title while useful grounded attributes exist;
- Product Detail discards available specifications or galleries;
- hero typography breaks into excessive one-word lines (word-per-line layout);
- the homepage is sparse while useful grounded sections (stats, FAQ, process,
  about, configurator evidence) exist in the reviewed plan;
- the implementer self-certifies DEMO_READY — only explicit human approval may
  transition AWAITING_HUMAN_REVIEW → DEMO_READY;
- Gemini quota failure is treated as a permanent blocker instead of proceeding
  to human review (AI_VISUAL_QA = QUOTA_UNAVAILABLE);
- mobile is merely desktop stacking without visual verification at 390×844.

### CMS/LINK CONTRACT REVIEW RULES

Reject a generation if:
- multiple Product/Project/Service detail routes exist but CMS exposes no
  separate editable records for them;
- generated detail content cannot be independently edited in Studio;
- "Смотреть проекты" (or any nav/CTA label) links to Contacts or any unrelated
  destination — a link returning HTTP 200 to the wrong page is a FAIL;
- the renderer guesses a missing target through a generic fallback instead of
  omitting the optional CTA;
- a homepage-section anchor (#projects) and the collection route (/projects)
  are conflated without an explicit semantic target;
- a link audit checks status codes only and ignores semantic correctness;
- a contact label renders with an empty value (e.g. "EMAIL" with no address);
- the Hub shows a screenshot whose variant/hash doesn't match the current
  preferred generation (unversioned preview URL).
