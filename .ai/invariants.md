# WLA RUNTIME / UX INVARIANTS

These rules are architectural invariants.

They apply to all future implementation work unless explicitly overridden by
a human decision.

AI agents must treat violations of these rules as regressions even if tests,
API responses or backend operations otherwise succeed.


## RADAR LIVE UI STABILITY

Radar is a continuously updating operational UI.

LIVE DATA MUST FEEL STATIC.

Background updates must update information without visually refreshing,
jumping, flashing or resetting the page.

### Existing data must never disappear during background refresh

After Radar has rendered successfully:

- never clear the Lead list before a refetch;
- never replace existing content with a full-page spinner;
- never show the initial skeleton again during background refresh;
- never temporarily render an empty Lead list;
- never temporarily remove selected Lead details;
- never temporarily remove already loaded screenshots.

Initial loading and background refreshing are different states.

Initial load may use skeletons.

Background refresh must keep stale/current data visible until replacement data
is ready.


## RADAR MUST NOT FULL-REFRESH FOR ONE LEAD CHANGE

A status update for Lead A must not cause unrelated Lead B-Z components to
reload/remount.

Preferred flow:

Operation/SSE event
→ patch affected Lead state
→ update affected counters
→ quietly reconcile with backend

Avoid:

event
→ clear queries
→ reload entire Radar
→ rebuild table
→ rebuild LeadDetail.


## SSE / POLLING MUST NOT CREATE REFRESH STORMS

Do not maintain multiple aggressive refresh mechanisms for the same data.

If SSE already reports operation changes:

- patch known state from the event;
- debounce/coalesce authoritative backend reconciliation;
- keep polling only as a slow fallback if necessary.

LOG events must not invalidate the Lead table.

Example:

"Launching Chrome"

may update Activity Console.

It must NOT trigger:

GET /leads
GET /stats
GET /lead/:id.

Only meaningful state transitions should affect Lead state.


## RADAR ROW ORDER MUST BE VISUALLY STABLE

Background qualification changes must not cause rows to jump under the user's
cursor.

Example:

score null → 82

must not automatically move the Lead from row 20 to row 3 while the user is
working with the table.

During live background updates preserve the currently rendered order.

Reapply sorting when one of these occurs:

- user explicitly changes sort;
- user changes primary view/filter;
- explicit refresh;
- another deliberate controlled refresh boundary.

Do not continuously reorder rows because scores/statuses change.


## RADAR COMPONENT IDENTITY MUST BE STABLE

Do not remount:

- Radar page;
- Lead table;
- Lead rows unnecessarily;
- selected Lead Detail;
- screenshot viewer;
- Activity Console;
- filters.

Never use changing values such as:

updatedAt
status
score
operationId

as React component keys when the underlying entity identity is still the same.

Entity keys should normally be stable IDs.


## RADAR USER STATE MUST SURVIVE LIVE UPDATES

Background activity must never reset:

- selected Lead;
- search query;
- filters;
- sort choice;
- primary view;
- scroll position;
- expanded sections;
- Desktop/Mobile screenshot selection;
- open artifact tab;
- console expansion state.

A live backend update is not a navigation event.


## SCREENSHOTS MUST NOT FLASH

Once a screenshot is visible:

keep it mounted during unrelated state changes.

Do not temporarily replace it with:

"No screenshot"
loading placeholder
white/empty container.

When replacing an existing screenshot with a newer one:

preload the new image first
then swap the source.


## TABLE LAYOUT MUST NOT SHIFT

Use stable dimensions for:

- columns;
- status badges;
- counters;
- action columns.

Status transitions such as:

Pending → Running → Complete

must not visibly resize the table.

Counters changing:

9 → 10

must not shift surrounding cards/layout.


## ACTIVITY CONSOLE MUST NOT MOVE THE PAGE

Activity Console height must remain bounded.

New log lines scroll inside the console.

They must not continuously increase the page height or move Radar controls.

Console output must not cover qualification/action buttons.


## RADAR PERFORMANCE ACCEPTANCE

For one Lead state transition, expected behavior is:

- no full-page loading state;
- no full table remount;
- unaffected rows remain stable;
- selected Lead remains selected;
- scroll remains stable;
- filters remain stable;
- no visible layout jump.

When modifying Radar live updates, verify with actual browser interaction rather
than only API/unit tests.

A successful backend response is NOT sufficient proof of Radar UX correctness.


## USER SELECTION IS AUTHORITATIVE

The currently selected Lead belongs to the user.

Background events never change `selectedLeadId`.

- Qualification of another Lead must never move or steal the user's selection.
- The Lead currently being qualified must never automatically receive focus.
- An OperationRun target must never automatically receive focus.
- A Lead leaving the current filtered table because of BACKGROUND state
  changes does not justify selecting another Lead — keep `selectedLeadId`,
  keep the detail panel mounted, and show a subtle "no longer in the current
  view" notice. Selection changes only when the user explicitly selects
  another Lead or closes the panel.
- A transient refetch/loading state is never grounds for changing selection.
- Selection is stored as a stable `selectedLeadId`, never as a row index or
  transient object reference.


## USER ACTION != BACKGROUND ACTION

Explicit user actions may deliberately change list membership and selection:

- marking the selected Lead BAD in a filtered view that excludes BAD may move
  selection to the adjacent row (next row first, previous as fallback);
- closing the detail panel clears selection;
- changing view/filter/sort is a deliberate refresh boundary and may apply
  the authoritative server ordering.

Background reconciliation may NOT do any of the above. If the selected Lead
still exists in the reconciled dataset, keep it selected and keep it in its
displayed position.


## CURRENT TABLE IS A STABLE VIEW SNAPSHOT

The rendered table is a UI snapshot, not a live mirror of the server query.

- CURRENT TABLE = STABLE UI SNAPSHOT.
- SERVER QUERY RESULT = AUTHORITATIVE MEMBERSHIP.
- Background reconciliation updates cell values but does not silently rebuild
  the snapshot: rows are patched in place, new rows append at the end, and
  rows absent from a background payload are NOT removed mid-session.
- A row that no longer matches the current view (patched data fails the
  filter, or the row was absent from the last background payload) is marked
  stale — dimmed + a compact "Moved out of current view" note — while
  remaining in place with stable geometry, unchanged `selectedLeadId`, and
  unchanged scrollTop.
- Absence from a backend payload implies stale membership only when that
  payload is known to be a complete authoritative result for the current
  query scope (e.g. `items.length === meta.total`). If the payload is
  paginated or otherwise partial, absence proves nothing — only patched row
  data may mark staleness in that case.
- Membership/order is rebuilt only at explicit boundaries: user refresh,
  view/filter change, sort change, or navigation away and back.


## TABLE GEOMETRY IS UI STATE

Live server updates may change cell values.

They must not unexpectedly change:

- displayed row order;
- row height;
- column width;
- scroll position;
- selected-row position;
- table mounting state.

A technically correct rerender that makes the table jump is a UX regression.

Concrete rules:

- the leads table uses `table-layout: fixed` with explicit column widths —
  cell content can never resize a column;
- status/score badges have stable dimensions (`w-full` inside their cell,
  truncated text) so "Pending → Audited" never shifts layout;
- score cells use `tabular-nums` so "— → 82" never shifts layout;
- background reconciliation patches rows in place, appends new rows at the
  end, and never removes rows — removal happens only at explicit refresh
  boundaries;
- the scroll container uses `scrollbar-gutter: stable` so a
  appearing/disappearing scrollbar never shifts geometry;
- transient indicators (e.g. "Updating…") reserve permanent space instead of
  mounting/unmounting.


## EVENT ROUTING MUST BE TARGETED

An event from one WLA domain must not broadly invalidate unrelated UI
domains.

- Console/log events are not data invalidation events.
- DISCOVERY / FACTORY / SYSTEM events without a leadId never refetch the
  Radar lead list.
- A lead-scoped event (leadId present) may trigger a debounced quiet
  reconciliation of the lead list.
- Polling is a slow fallback, not the primary update path.


## BROWSER BEHAVIOR OVERRIDES UNIT ASSUMPTIONS

For live Radar UX issues, passing unit tests are not sufficient.

Real browser observation, Playwright video/trace, and layout measurements
(bounding boxes, scrollTop) are required before declaring the issue fixed.


## TESTS MUST NOT BYPASS REAL USER INTERACTION FAILURES

If Playwright reports that another element intercepts a click, treat it as a
UI bug — not a test problem.

Do not use:

- `force: true`
- `dispatchEvent()`
- DOM `click()` via `evaluate`

to make a user-facing acceptance test pass. Those tests must use normal
browser actionability (`locator.click()`); an interception means a real user
could not click the control either. Fix the layout/z-index/geometry instead.

Programmatic events are allowed only when the test explicitly targets
low-level DOM behavior, not user flows.


## BACKGROUND FETCH MUST PRESERVE PARENT GEOMETRY

After initial render, background fetching must not remove, replace or
collapse already rendered dashboard sections — KPI blocks, filter bars,
tables, detail panels.

Stale values remain visible until fresh values arrive. Never toggle a
rendered section back into a loading/empty state during a background poll.

Beware stale closures: a `setInterval`/`setTimeout` callback created in a
`useEffect` captures the state from the render that created it — a guard
like `if (stats === null) setLoading(true)` inside such a closure stays
`true` forever and silently defeats the stale-while-revalidate intent.
Derive loading/empty render branches from current state (e.g.
`stats === null`), or read live state via refs.

Layout-stability tests must measure ABSOLUTE viewport geometry
(getBoundingClientRect of the stats container, filter bar, table, detail
panel), not only relative row geometry — a table whose rows stay internally
aligned but whose entire parent moves is still a UX regression.


## OVERLAYS MUST NOT COVER UNRELATED CONTROLS

Fixed/absolute panels must not intercept clicks on unrelated UI — headers,
filters, row actions, navigation, or scrollbars. Prefer real layout space
(flex/grid columns, sticky positioning) over overlays; if an overlay is
required, the underlying content must explicitly reserve its footprint.


## HUMAN REVIEW MAY PRECEDE AUTOMATED QUALIFICATION

Human judgment does not need to wait for automation.

- GOOD / UNSURE / BAD review controls must be available before
  READY_FOR_REVIEW — including while Audit, Lighthouse, AI or Scoring are
  pending or running.
- Early review controls render muted/lower-emphasis but clearly clickable;
  they must not look disabled.
- A subtle "Early review" indication (badge/tooltip) must communicate that
  qualification is still running.
- Once READY_FOR_REVIEW is reached, the same controls return to normal
  emphasis — they are not replaced by a different component.
- Human review status and automated qualification status are independent
  concepts; never overload one enum for both.
- Early GOOD must not bypass automated generation-readiness gates: a Lead is
  not Ready for Generation until qualification completes successfully.
- Early UNSURE persists while qualification continues; the human may revise
  after automated results arrive.
- Automated scoring/qualification must never silently overwrite a human
  review decision (never reset reviewStatus back to UNREVIEWED).
- A human review decision must survive SSE updates, polling, refetches and
  page reloads.


## HUMAN REJECTION SHOULD SAVE COMPUTE

- If a Lead is manually marked BAD before qualification completes, do not
  start unnecessary later Audit/Lighthouse/AI/Scoring stages.
- Cancel queued work for that Lead.
- A running stage may only be interrupted through safe existing cancellation
  mechanisms (cooperative cancellation flag); it may finish, but no later
  stages may be scheduled.
- Never kill shared browser/worker infrastructure unsafely.
- Never report CANCELLED for work that is still running — use accurate
  intermediate states (e.g. CANCEL_REQUESTED) and mark CANCELLED only once
  the run has actually stopped.
- Early GOOD/UNSURE must not hide or stop automated results: Audit,
  Lighthouse, AI and Scoring continue to populate normally.


# PLAYWRIGHT / BROWSER RUNTIME INVARIANTS

Browser availability must be deterministic.

WLA must NOT depend on an accidental local Playwright browser cache.


## NEVER ASSUME PLAYWRIGHT CACHE EXISTS

Do not assume:

~/.cache/ms-playwright

or any developer-specific browser cache exists.

A new machine/container must be able to determine exactly which Chromium/Chrome
binary will be used.


## BROWSER PATH MUST BE EXPLICITLY RESOLVABLE

Browser-heavy components must support a configured executable path.

Preferred resolution order:

1. explicit configured browser path such as PLAYWRIGHT_CHROMIUM_PATH;
2. packaged/container browser path;
3. known supported system Chrome/Chromium;
4. Playwright-managed browser only if explicitly provisioned.

Do not silently rely on whichever browser happens to exist.


## DO NOT DOWNLOAD BROWSERS DURING NORMAL APPLICATION RUNTIME

Normal Radar/Audit/Factory operation must not suddenly execute browser downloads.

Do not solve runtime browser failures by calling:

npx playwright install

inside request handling or background operation execution.

Browser provisioning belongs to:

- setup;
- Docker image build;
- deployment;
- explicit developer setup.

Runtime should fail clearly if no supported browser exists.


## ADD A BROWSER PREFLIGHT

WLA should have one reusable browser-runtime check.

It should report:

- resolved browser executable;
- whether the file exists/is executable;
- browser version;
- Playwright launch result where appropriate.

Use the same resolver from:

crawler
screenshots
audit
other Playwright operations.

Do not implement separate browser-discovery logic in multiple subsystems.


## PLAYWRIGHT FAILURE MUST NOT CRASH CORE

Treat browser automation as untrusted heavy work.

Allowed:

browser crashes
page crashes
timeouts
navigation failures
missing browser
individual operation failure.

Not allowed:

CORE process exits because Playwright/Chrome failed.


## BROWSER PROCESS CLEANUP IS MANDATORY

Every browser operation must clean up:

- browser;
- contexts;
- pages;
- temporary processes/resources

on:

success
failure
timeout
cancellation.

Do not leave stale Chrome processes after operations.


## DO NOT FIX BROWSER ISSUES WITH MACHINE-SPECIFIC HACKS

Forbidden production fixes include:

hardcoded paths such as:

/home/aleks/...
/Users/<developer>/...
specific CI runner cache paths.

Developer-specific overrides may exist in local configuration only.

Production/runtime code must remain portable.


## CONTAINER / NEW HOST ACCEPTANCE

A clean WLA environment must be able to start from:

source code
configuration
database
artifact storage

without relying on hidden files from the previous workstation.

Acceptance test:

fresh environment
→ resolve browser
→ perform one Playwright page load
→ capture screenshot
→ perform one audit/crawl
→ cleanly exit
→ zero leaked browser processes.


# AI IMPLEMENTATION RULES

Before claiming any Radar or browser-runtime task complete, AI agents must verify:

1. Did this change introduce a full query/list replacement?
2. Can a live event cause table row reordering?
3. Can existing UI disappear while fetching?
4. Can selected Lead/filter/scroll state reset?
5. Does a log event trigger unnecessary Radar refetch?
6. Does browser resolution depend on a developer cache?
7. Will this work on a clean machine/container?
8. Can browser failure terminate CORE?
9. Are browser processes cleaned after failure?
10. Was behavior tested in a real browser, not only through API/tests?

If any answer is uncertain, the task is not complete.


# FINAL UX PRINCIPLE

WLA should continuously update without looking like it is continuously
refreshing.

The user should notice:

"the Lighthouse stage completed"

not:

"the entire Radar just refreshed."


# FINAL RUNTIME PRINCIPLE

Browser automation is infrastructure.

Its installation/location must be deterministic and reproducible.

A developer's local Playwright cache is not infrastructure.

# GENERATION V2 — SEMANTIC FACT GATE (Phase 2A.3)

Regex/DOM extraction produces FactCandidates. Only validated candidates
become business facts — UNKNOWN is better than WRONG.

- Phones: reject year ranges, bare 9-digit numbers, registration IDs,
  bank accounts, >15-digit runs, concatenated numbers, letter-fused strings.
- Emails: reject numeric-only local parts, image filenames, placeholder
  domains; clean phone-tail prefixes glued to local parts.
- Addresses: accept only schema.org/labelled/street-token+digit evidence;
  never catalogue ranges, opening hours, bank details, or phone lines.
- Employee count 0 (counter default) is rejected without explicit evidence.
- Registration/tax IDs keep their own fact type (UNP) and never become phones.
- Every rejection is recorded in graph.rejectedFacts with a typed reason.
- Gemini classification is async, bounded (semaphore=2), batched per page,
  cached by input+model+prompt hash, and never writes to CMS (shadow mode).


# GENERATION V2 — COVERAGE & EVALUATION INVARIANTS (Phase 2A.4)

### MISSING EVIDENCE IS NOT A SEMANTIC ERROR

A semantic classifier cannot be blamed for a page or collection that the
crawler/source layer never provided. Coverage and semantic accuracy are
measured separately: page coverage, then structure coverage conditioned on
the parent page being covered.

### CRAWLER PRIORITY IS STRUCTURAL, NOT SEMANTIC

The crawler may prioritize navigation prominence, sitemap, hub ancestors,
and short path depth. It must never encode customer-, language-, or
domain-specific classifications — the crawler decides WHICH URL to fetch,
the semantic layer decides WHAT it means.

### A/B INPUTS MUST BE FROZEN

Rule and AI semantic providers are compared against byte-identical
SourceDocuments. Never recrawl between providers. The frozen corpus is
pinned by semantic-corpus-manifest.json (paths + SHA256 + commit).

### HOMEPAGE IS RESOLVED, NOT INFERRED

A page is HOME only when its URL canonically equals the resolved site root.
A failed root yields homepageStatus UNKNOWN — an internal page is never
promoted to HOME to fill the gap.

### INCOMPLETE AI RUNS ARE NOT A/B RESULTS

When quota/circuit-breaker limits a hybrid run, report HYBRID QUALITY NOT
MEASURED. Fallback-equal-to-rule output is not a semantic comparison.


### GENERATION V2: PRESENTATION LAYER

- SiteContentPlan V2 carries `experience` (archetype, brand, presentation copy,
  composition, stylePresets). Rendering is deterministic from the plan —
  no semantic reclassification downstream.
- Brand identity rejects generic logo-alt text ("logo", "logotip") and pure
  SEO descriptors; domain-derived fallback is allowed.
- Card copy uses `cardSummary` — nav/CTA/phone/process fragments stripped.
  Missing copy stays empty (UNKNOWN > WRONG), never raw scraped dumps.
- Entity media prefers the entity's own document images, then filename↔slug
  matching (transliteration + consonant skeleton), then graph association.
  Logos, icons, SVGs, tiny thumbs, and site-wide chrome images are rejected.
- Exactly 3 DemoVariants per site with distinct dark-safe style presets;
  exactly one `isPreferred`. A site is not DEMO_READY without a captured,
  linked screenshot and a passing visual/content gate.

### IMPLEMENTER DOES NOT SELF-APPROVE VISUAL QUALITY

The agent that generates or modifies a Showcase may verify objective defects,
but it does not decide whether the redesign is client-ready. Generation ends at
AWAITING_HUMAN_REVIEW when there are no technical blockers; only an explicit
human action (scripts/approve-showcase.mjs) transitions to DEMO_READY. Gemini
visual QA is advisory evidence; quota exhaustion must never block human review
(AI_VISUAL_QA = QUOTA_UNAVAILABLE → still AWAITING_HUMAN_REVIEW).

### PRODUCT PAGES MUST EXPOSE GROUNDED PRODUCT VALUE

If structured Product attributes exist in the reviewed generation input, the
renderer must not discard them and render only title/image. "Что входит?"
completion levels, area/floor/spec data and floor plans are surfaced on cards
and detail pages. Floor plans are detail media — never the primary card image
when an exterior render exists.

### RESPONSIVE TYPOGRAPHY MUST FOLLOW CONTENT

Do not force arbitrary word-per-line layouts. Headline composition adapts to
actual copy length and viewport (≤3 lines desktop, ≤4 mobile, balanced wraps).
A hero may not claim prices/discounts the page cannot show.

### VISIBLE ENTITY MUST EXIST IN CMS

Every generated Service, Project, Product, News item or other independently
addressable content entity must be independently editable in CMS (list +
edit UI + API). Renderer-only entities are forbidden: if the Showcase shows a
detail route or card, the CMS must expose that record. The generated site's
visible content model and the CMS editing model must match 1:1.

### LINKS ARE SEMANTIC CONTRACTS

Link labels never determine routing. Every generated link carries an explicit
semantic target (HOME / HOME_SECTION / COLLECTION / CONTENT_DETAIL / PAGE /
EXTERNAL_URL), resolved by one central resolver to a canonical route. An
unresolvable target returns empty — the CTA is omitted, never silently
rerouted to an unrelated valid page (e.g. Contacts).

### COLLECTION != HOME SECTION

A homepage preview section and a collection page are separate valid targets:
HOME_SECTION(PROJECTS) → #projects; COLLECTION(PROJECTS) → /projects. Header
nav may scroll to a section; "Все проекты / Смотреть проекты" CTAs resolve to
the collection route. They are never interchangeable.

### EMPTY CONTACT FIELDS ARE OMITTED

A missing email/phone/address/secondary channel must not render its label or
an empty row — the entire label+value row is omitted.

### HUB PREVIEW IS VERSIONED

The Hub/Forge thumbnail URL must encode the preferred variant + capture time
(?v=variantId-timestamp) and the screenshot endpoint must be no-cache.
A regenerated preferred variant can never display a stale screenshot.
