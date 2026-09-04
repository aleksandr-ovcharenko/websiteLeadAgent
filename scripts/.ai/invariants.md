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