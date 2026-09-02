Improve the EXISTING WebsiteLeadAgent admin product navigation.

IMPORTANT:

Do NOT redesign the approved screens.

Do NOT change:
- CMS layouts
- tables
- editors
- dashboard cards
- colors
- typography
- spacing
- content structure

This task is ONLY about creating a coherent PRODUCT SHELL and NAVIGATION
shared between all WebsiteLeadAgent administrative areas.

==================================================
PRODUCT MODEL
==================================================

WebsiteLeadAgent is ONE product with these modules:

HUB
Main product entry point.

RADAR
Lead discovery and qualification.

FACTORY
Pipeline execution, generation progress, audit and retries.

FORGE
Generated websites.

STUDIO
CMS for one website.

SHOWCASE
Preview of a generated website.

The flow is:

RADAR
  ↓
FACTORY
  ↓
FORGE
  ↓
STUDIO
  ↓
SHOWCASE

These are not separate unrelated applications.

==================================================
1. CREATE A COMMON PRODUCT HEADER
==================================================

Add a compact common WebsiteLeadAgent product header that can be reused
across:

- Hub
- Radar
- Factory
- Forge
- Studio

Do NOT redesign the existing page below the header.

The header should be restrained and professional.

Suggested height:
48–56px.

==================================================
2. WLA LOGO
==================================================

Create a very simple product logo:

WLA

Do not create an elaborate illustration.

Preferred:

small dark square / subtle rounded square

WLA

next to:

WebsiteLeadAgent

The visual identity should match the existing strict admin design.

Avoid:
- gradients
- startup-style colorful branding
- complex illustrations
- oversized logo

==================================================
3. LOGO BEHAVIOR
==================================================

The WLA logo / WebsiteLeadAgent brand must always be clickable.

For SUPER_ADMIN:

clicking the logo returns to:

HUB

The user should always have an obvious way to return to the main product.

Do not require browser Back.

==================================================
4. COMMON SUPER ADMIN NAVIGATION
==================================================

For SUPER_ADMIN show compact product navigation:

Radar

Factory

Forge

Do not add Studio as a global destination because Studio requires a Site context.

Example:

[ WLA WebsiteLeadAgent ]    Radar    Factory    Forge

Use the existing admin visual language.

Do not use large tab pills.

==================================================
5. STUDIO CONTEXT
==================================================

When SUPER_ADMIN is inside Studio:

show the common WLA header.

Also show contextual navigation such as:

← Forge

or:

Back to Forge

and:

Open Showcase

The structure should conceptually be:

WLA | Studio

[ ← Forge ]    ГАРАНТ КАЧЕСТВА / garantk.by      Open Showcase

Do not hardcode this company.

It represents the CURRENT SITE dynamically.

==================================================
6. CUSTOMER USER BEHAVIOR
==================================================

SITE_ADMIN / EDITOR must NOT see:

Radar
Factory
Forge
all Sites

They may still see the WLA product logo/header,
but global SUPER_ADMIN navigation must be absent.

For customer users Studio should remain focused on their website.

Do not expose global platform data.

==================================================
7. REMOVE HARDCODED SITE SWITCHER CONCEPT
==================================================

The current Studio mockup contains a site switcher with example sites such as:

ГАРАНТ КАЧЕСТВА
Строй Инвест

Do NOT treat this list as static UI.

Redesign this part conceptually so it represents dynamic Site context.

For SUPER_ADMIN:

the current Site may be shown with an optional switch/change action.

For SITE_ADMIN:

show only Sites actually assigned to the user.

If a user has only one Site,
do not force an unnecessary site-switcher interaction.

==================================================
8. STANDARDIZE PRODUCT TERMINOLOGY
==================================================

Replace generic / old platform naming wherever it appears in product navigation.

Use:

Leads
→ RADAR

Sites / Generated
→ FORGE

Pipeline / Queue / Generation / Audit Queue
→ FACTORY

CMS
→ STUDIO

Preview
→ SHOWCASE

Do not rename normal content concepts inside Studio.

Keep:

Pages
Projects
News
Services
Media
Navigation
Contacts
Site Settings
Users

==================================================
9. FACTORY — DEFINE ITS PURPOSE
==================================================

We need a clear Factory screen because pipeline execution must be visible.

Factory is NOT another copy of Forge.

Factory shows RUNS / PROCESSING.

Design a compact professional Factory screen.

Main purpose:

“What is currently happening in the website generation pipeline?”

==================================================
10. FACTORY RUN LIST
==================================================

Design Factory around pipeline runs.

Example columns:

Company / Lead

Run status

Current stage

Progress

Started

Duration

Actions

Example:

ООО Компания

RUNNING

Generating website

4 / 7

12:42

02:31

View →

Possible statuses:

QUEUED
RUNNING
FAILED
COMPLETED

Keep status labels visually restrained.

==================================================
11. FACTORY PIPELINE DETAIL
==================================================

Clicking a run should show pipeline details.

Prefer a side panel or detail page.

Example:

ООО Компания
Generation run #42

✓ Lead selected
✓ Content extraction
✓ Content transformation
✓ CMS import
● Website generation
○ Screenshot
○ Audit
○ Demo ready

For each stage optionally show:

status
duration
started / completed
error if failed

Do not expose excessive low-level logs by default.

==================================================
12. FAILED PIPELINE
==================================================

If a stage fails show:

FAILED

Failed stage:
Website generation

Short error explanation

Actions:

Retry
Open details

Do not make the interface look like developer infrastructure monitoring.

This remains a business/platform administration product.

==================================================
13. RELATIONSHIP FACTORY → FORGE
==================================================

When the pipeline creates a Site,
the Site automatically appears in Forge.

Factory answers:

“What is being processed?”

Forge answers:

“What websites exist?”

Do not duplicate them.

Completed Factory run:

Demo ready ✓

Action:

Open in Forge →

==================================================
14. RELATIONSHIP RADAR → FACTORY
==================================================

Radar is used for lead selection.

Example:

Lead marked GOOD

Generate Demo

        ↓

creates a Factory run.

Radar may show:

Generation started

Open Factory →

Do not show the entire pipeline inside every Radar row.

==================================================
15. RADAR SEARCH HISTORY
==================================================

Prepare Radar for repeated lead discovery runs.

This is important.

Radar should not be only one endless list of Leads.

Introduce the concept:

SEARCH / DISCOVERY RUNS

Examples:

Minsk · Construction
29 Aug 2026
48 leads

Minsk · Renovation
28 Aug 2026
36 leads

Minsk · Engineering
27 Aug 2026
51 leads

The user must be able to switch between previous discovery batches.

==================================================
16. RADAR DISCOVERY RUN UI
==================================================

At the top of Radar provide:

Current discovery run

Example:

Minsk / Строительные компании
29 Aug 2026
48 leads

and an action:

New discovery

Also provide:

History

or a compact run selector.

==================================================
17. NEW DISCOVERY ACTION
==================================================

Design:

+ New discovery

This action will later start the full discovery / analysis process.

Do NOT design a command-line-oriented interface.

Use a simple dialog.

Suggested fields:

City

Search query / business category

Lead limit

Optional advanced settings

Primary action:

Start discovery

The user should never need CLI commands for normal operation.

==================================================
18. DISCOVERY PROGRESS
==================================================

When a new Radar discovery run starts show progress.

Example:

Discovering businesses           ✓
Enriching websites               ✓
Website audit                    ●
Lighthouse                       ○
AI visual analysis               ○
Scoring                          ○

24 / 50 leads processed

Do not block access to previous discovery runs.

==================================================
19. DISCOVERY HISTORY
==================================================

Design a compact History view / dropdown.

Each run should show:

date
city
query/category
lead count
GOOD count
status

Example:

29 Aug
Minsk · Construction
48 leads · 8 GOOD
Completed

28 Aug
Minsk · Renovation
36 leads · 5 GOOD
Completed

Failed/incomplete runs should remain visible with Retry.

==================================================
20. RADAR RUN VS FACTORY RUN
==================================================

Keep these concepts distinct.

RADAR DISCOVERY RUN:

find businesses
enrich
audit original sites
AI analyse
score Leads

FACTORY GENERATION RUN:

take selected Lead
extract content
create CMS
generate redesign
capture screenshot
audit generated website

Do not mix the two progress models.

==================================================
21. HUB
==================================================

Design a minimal HUB screen.

Do NOT build a huge analytics dashboard.

Purpose:

quick entry into the product.

Show:

Radar
Discover & qualify leads

Factory
Generation pipeline

Forge
Generated sites

Optional compact status:

Radar
1 discovery running

Factory
2 sites processing

Forge
12 generated sites

The WLA logo always returns here.

==================================================
22. HEADER CONSISTENCY
==================================================

The common product header must look identical across:

Hub
Radar
Factory
Forge
Studio

Same:

WLA logo
height
typography
spacing
background
border
navigation behavior

Only context-specific actions should change.

==================================================
23. DO NOT DUPLICATE NAVIGATION
==================================================

Avoid having:

one unrelated header in Radar
another in Forge
another in Studio

Create the visual concept of a reusable:

ProductHeader

The existing Studio sidebar remains below it.

==================================================
24. STUDIO SIDEBAR
==================================================

Do NOT redesign the existing Studio sidebar.

Keep:

Dashboard
Pages
News
Projects
Services
Vacancies
Media
Navigation
Contacts
Site Settings
Users

Only integrate the common WLA product navigation above/around it.

==================================================
25. SHOWCASE ACTION
==================================================

For a current Site context provide a clear:

Open Showcase

action.

Use an external/open icon if appropriate.

Showcase is the generated public website preview.

Do not embed the full site into the CMS header.

==================================================
26. BACK NAVIGATION
==================================================

Ensure every deeper context has an obvious return path.

Studio
→ Forge

Factory run detail
→ Factory

Lead detail
→ Radar

Forge site detail
→ Forge

And:

WLA logo
→ Hub

==================================================
27. PRODUCT HIERARCHY
==================================================

Make navigation hierarchy clear:

LEVEL 1
WebsiteLeadAgent product

LEVEL 2
Radar / Factory / Forge

LEVEL 3
specific Site / specific pipeline run

LEVEL 4
Studio content section

Do not mix all these links into one large navigation bar.

==================================================
28. VISUAL STYLE
==================================================

Preserve the approved strict admin style:

- light neutral surfaces
- dark sidebar where already used
- graphite text
- restrained green accent
- subtle borders
- compact typography
- information density

No:
- gradients
- glassmorphism
- giant rounded navigation
- colorful navigation icons

==================================================
29. IMPORTANT — DO NOT REDESIGN EXISTING SCREENS
==================================================

Keep all currently approved Studio screens intact.

Also keep approved Radar / Forge content layouts intact where applicable.

Only improve:

- global navigation
- naming
- Hub
- Factory concept
- Radar discovery-run history / New Discovery flow
- cross-product navigation

==================================================
30. FINAL PRODUCT MODEL
==================================================

The interface should clearly communicate:

HUB
   │
   ├── RADAR
   │     discovery runs
   │       ↓
   │     qualified leads
   │       ↓ Generate Demo
   │
   ├── FACTORY
   │     generation runs / progress / retry
   │       ↓
   │
   └── FORGE
         generated Sites
            ↓
          STUDIO
            ↓
         SHOWCASE

Everything must feel like ONE application.