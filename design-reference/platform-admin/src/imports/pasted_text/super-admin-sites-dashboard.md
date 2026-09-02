Improve ONLY the SUPER ADMIN “Sites” dashboard.

Do NOT redesign the Site CMS.
Do NOT change the existing platform navigation or permission model.

The current dashboard is structurally good, but it is too table-heavy.

The most important improvement:

SUPER_ADMIN must be able to visually recognize each website immediately.

Right now the dashboard mostly shows text:
site name, domain, status, template, content counts.

Add much stronger WEBSITE VISUALIZATION using real website preview screenshots.

==================================================
MAIN UX GOAL
==================================================

When I open the Sites dashboard, I should immediately be able to answer:

- What does this website look like?
- Which company is this?
- Is the generated design visually complete?
- Is the site active / draft / broken?
- Can I quickly open the CMS or preview?

The dashboard should become a visual control center for generated websites.

Do not turn it into a generic analytics dashboard.

==================================================
1. ADD WEBSITE THUMBNAIL PREVIEWS
==================================================

Every site must have a screenshot preview.

Use a desktop homepage screenshot.

Preferred aspect ratio:

16:10
or
approximately 3:2

The screenshot should show the top portion of the actual homepage:

- header
- hero
- beginning of next section

Do NOT use:
- generic illustration
- logo only
- placeholder gradient
- fake website image

Use real generated-site screenshots.

==================================================
2. CHANGE THE SITE LIST STRUCTURE
==================================================

The current table is too text-centric.

Create a richer “visual table” / “site row” layout.

Each site row should include:

[ WEBSITE THUMBNAIL ]

Site name
Domain
Template

Status

Content summary

Last update

Actions

Example concept:

┌───────────────┬──────────────────────────────┬───────────┬──────────────┬─────────────┐
│               │ ГАРАНТ КАЧЕСТВА             │ ACTIVE    │ Pages 8      │ Open CMS    │
│  WEBSITE      │ garantk.by                   │           │ Projects 14  │ Preview     │
│  PREVIEW      │ construction-modern-v1      │           │ News 6       │ •••         │
│               │                              │           │              │             │
└───────────────┴──────────────────────────────┴───────────┴──────────────┴─────────────┘

Thumbnail width:
approximately 180–240px on desktop.

Row height should be large enough to properly see the website,
but still compact enough to browse many sites.

==================================================
3. ADD VISUAL VIEW MODE
==================================================

Add a view toggle above the list:

[ Table ] [ Visual ]

TABLE:
for operational management and many sites

VISUAL:
for quickly reviewing website designs

Visual view should use a responsive grid of website cards.

Example:

3 cards per row at 1440px.

Each card:

large website screenshot

below screenshot:

ГАРАНТ КАЧЕСТВА
garantk.by

ACTIVE

construction-modern-v1

small content summary

Open CMS
Preview

Do NOT use oversized SaaS cards.

Keep them clean and professional.

==================================================
4. VISUAL CARD DESIGN
==================================================

The screenshot must dominate the card.

Approximately:

65–70% screenshot
30–35% metadata/actions

Do not make metadata larger than the website preview.

Card structure:

┌──────────────────────────────┐
│                              │
│      WEBSITE SCREENSHOT      │
│                              │
│                              │
├──────────────────────────────┤
│ ГАРАНТ КАЧЕСТВА     ACTIVE   │
│ garantk.by                   │
│ construction-modern-v1      │
│                              │
│ Updated 2h ago               │
│                              │
│ Open CMS      Preview   •••  │
└──────────────────────────────┘

Use very subtle border and radius.

No heavy shadows.

==================================================
5. WEBSITE SCREENSHOT STATES
==================================================

The thumbnail itself should help show operational state.

ACTIVE:
normal full-color screenshot

DRAFT:
normal screenshot + subtle Draft badge

DEMO GENERATED:
normal screenshot + Demo Generated badge

DEMO APPROVED:
approved badge

ARCHIVED:
slightly muted screenshot

FAILED BUILD:
keep screenshot visible if available,
but add a restrained warning overlay:

Preview build failed

Do NOT replace the whole screenshot with an error box.

==================================================
6. QUICK VISUAL REVIEW SECTION
==================================================

Above the full list add a section:

“Recent websites”

or:

“Recently updated”

Show 3–4 large website previews.

This section is for visual inspection.

Example:

Recently updated

[ Garant screenshot ] [ ArhiStroy screenshot ] [ MegaStroy screenshot ]

Each should show:

company name
status
last update

Clicking the screenshot opens Preview.

Clicking the company name opens CMS.

Do not duplicate the entire metadata from the main table.

==================================================
7. HOVER BEHAVIOR
==================================================

On website screenshot hover:

show subtle overlay:

Open preview →

Optional secondary action:

Open CMS

Keep hover professional and minimal.

Do not add large floating buttons.

==================================================
8. SCREENSHOT FRESHNESS
==================================================

Visually indicate when the screenshot was generated.

For example:

Preview captured:
Today, 14:28

Keep this secondary.

If screenshot is stale compared to latest site update,
show subtle warning:

Preview outdated

This will be useful later when automated workflows rebuild sites.

==================================================
9. MORE USEFUL SITE HEALTH
==================================================

Keep the existing operational information,
but show it more visually.

For each site optionally show compact indicators:

Preview      ● Ready
CMS          ● Ready
Domain       ● Connected

or, only when something is wrong:

⚠ Missing domain
⚠ Preview build failed
⚠ CMS import incomplete

Do not show green health indicators everywhere if everything is fine.

Use progressive disclosure:
normal sites should remain visually clean.

==================================================
10. SITE DETAIL PREVIEW PANEL
==================================================

When clicking a site row or an info action,
allow an optional right-side details panel.

Show:

large website screenshot

Company:
ГАРАНТ КАЧЕСТВА

Domain:
garantk.by

Status:
ACTIVE

Template:
construction-modern-v1

Content:
Pages 8
Projects 14
News 6

Last build:
Successful

Last audit:
...

Actions:

Open CMS
Open website
Open preview

Do not duplicate the full CMS.

This is a platform-level overview only.

==================================================
11. KEEP THE EXISTING OPERATIONAL STRENGTH
==================================================

Preserve:

- Total sites
- Active
- Draft
- Needs attention

Preserve:

- search
- status filter
- template filter
- sorting

Preserve:

- Open CMS
- Preview
- More actions

But visually prioritize:

1. website screenshot
2. company/site name
3. status
4. actions
5. technical metadata

==================================================
12. NEEDS ATTENTION SECTION
==================================================

Keep the existing “Needs attention” section,
but make it slightly more actionable.

Example:

EuroBuild Group
Missing domain
[Fix]

АрхиСтрой
Preview build failed
[Retry]

МегаСтрой Инжиниринг
CMS import incomplete
[Open]

Do not make this section visually dominant unless issues are critical.

==================================================
13. VISUAL CONSISTENCY
==================================================

Use the existing WebsiteLeadAgent CMS design language:

- light neutral background
- white surfaces
- graphite text
- restrained green accent
- subtle borders
- compact professional typography

Do NOT introduce:

- gradients
- glassmorphism
- bright colored cards
- marketing-style illustrations
- giant KPI widgets

==================================================
14. SCALE TO MANY SITES
==================================================

Design for:

10 sites
50 sites
100+ sites

Therefore:

Visual mode
= useful for browsing and design review

Table mode
= useful for operations at scale

Both views should use the same filters and sorting.

==================================================
15. SUPER_ADMIN ONLY
==================================================

This visual multi-site dashboard remains visible ONLY to SUPER_ADMIN.

Normal SITE_ADMIN and EDITOR users must never see:

- all websites
- visual site gallery
- global site filters
- platform-level status

They continue to enter directly into their assigned Site CMS.

==================================================
QUALITY CHECK
==================================================

Before finishing, ask:

Can I visually recognize each generated site without opening it?

Can I immediately see which website design looks incomplete?

Is the screenshot large enough to be useful?

Can I switch between visual review and operational table view?

Does the dashboard still scale to many websites?

Does it feel like a professional website management platform rather than a spreadsheet?

If not, improve it.