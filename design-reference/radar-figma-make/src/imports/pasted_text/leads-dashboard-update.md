Improve ONLY the existing Leads / Opportunities dashboard.

Do NOT redesign the product from scratch.
Do NOT change the current lead-scoring logic.
Do NOT change the information architecture.
Do NOT remove existing useful fields.

The current dashboard is functionally correct.
The goal is to make it visually cleaner, more modern, and consistent with the approved WebsiteLeadAgent Super Admin design.

==================================================
GOAL
==================================================

This screen is used by SUPER_ADMIN to review discovered business leads before website generation.

It should feel like part of the same product as the new Super Admin “Sites” dashboard.

Use the same design system:

- light neutral background
- white surfaces
- graphite text
- restrained green accent
- subtle borders
- compact professional typography
- clean tables / rows
- low visual noise

Do NOT make it look like a marketing site or colorful analytics dashboard.

==================================================
KEEP EXISTING FUNCTIONALITY
==================================================

Preserve all existing lead information and actions, including where currently available:

- company name
- website / domain
- business category
- current website screenshot
- website quality score
- business score
- lead score
- AI visual analysis
- redesign potential
- technical / visual quality
- manual review status
- GOOD / BAD / UNSURE
- audit status
- Lighthouse data
- actions
- links to original website
- screenshots
- generation/select action if present

Do not invent new scoring rules.

==================================================
MAIN IMPROVEMENT — VISUAL LEAD REVIEW
==================================================

The current website screenshot should become more visually important.

Each lead should be easy to evaluate without opening the website.

Use a richer row layout:

[ CURRENT WEBSITE SCREENSHOT ]

Company name
domain
category

Scores

Review status

Actions

Suggested structure:

┌───────────────┬──────────────────────────────┬──────────────┬──────────────┐
│               │ ООО Компания                │ Lead 82      │ GOOD         │
│ CURRENT SITE  │ company.by                  │ Visual 32    │              │
│ SCREENSHOT    │ Строительство               │ Business 85  │ Generate     │
│               │                              │ Redesign 9/10│ Open site    │
└───────────────┴──────────────────────────────┴──────────────┴──────────────┘

The screenshot should be large enough to judge the website.

==================================================
SCORES
==================================================

Make scores easier to scan.

Do NOT create giant KPI cards for every score.

Use compact score groups such as:

Lead score     82
Business       85
Technical      44
Visual         32
Redesign       9/10

Lead score should have the strongest emphasis.

Use restrained visual indicators:

- small progress bars
- compact score chips
- subtle color hierarchy

Avoid rainbow colors.

Green should mean positive / strong lead.

Muted gray for neutral values.

Warning colors only when genuinely needed.

==================================================
AI VISUAL ANALYSIS
==================================================

The AI analysis should not dominate the table.

Show a short summary such as:

“Outdated visual style, weak mobile hierarchy, strong business credibility.”

Then allow:

View analysis →

to open a side panel or expandable details.

Detailed fields may include:

Modernity
Visual quality
Mobile UX
Trust
CTA quality
Content structure
Redesign potential

Do not display every AI metric permanently in the main row.

==================================================
MANUAL REVIEW
==================================================

Make manual review status very clear.

Statuses:

UNREVIEWED
GOOD
BAD
UNSURE

Actions should be easy:

✓ Good
? Unsure
× Bad

But keep them visually professional.

Do not use oversized colorful buttons.

Selected status should be clearly visible.

==================================================
PRIMARY ACTION
==================================================

For GOOD leads, make the next action obvious:

Generate demo

or:

Select for redesign

depending on the existing pipeline state.

This should be the strongest row action.

Secondary actions:

Open original site
View audit
View screenshots
More

==================================================
FILTER BAR
==================================================

Improve the current filters.

Include:

Search leads

Review status

Lead score range / minimum

Category

Audit status

Sort:

Highest lead score
Highest redesign potential
Recently discovered
Recently reviewed

Keep the filter bar compact.

==================================================
TOP SUMMARY
==================================================

Add a compact summary similar to the Super Admin Sites dashboard:

Total leads
Unreviewed
Good
Unsure
Selected for redesign

Do not use giant dashboard cards.

==================================================
VIEW MODES
==================================================

Optional but preferred:

[ Review ] [ Table ]

Review mode:
larger screenshots and richer lead rows

Table mode:
compact operational view for many leads

The Review view should be the default for manual qualification.

==================================================
SIDE PANEL
==================================================

When clicking a lead, optionally open a right-side detail panel.

Show:

large current website screenshot

Company name
domain
category

Scores

AI summary

Problems
Strengths

Lighthouse summary

Manual review status

Actions:

Open original website
Good
Unsure
Bad
Generate demo

Do not navigate away for every detail.

==================================================
SCREENSHOTS
==================================================

If desktop and mobile screenshots exist, support both.

In details:

Desktop | Mobile

Do not show all full-size screenshots in the main table.

==================================================
EMPTY / ERROR STATES
==================================================

Keep them simple:

No leads found
No GOOD leads
Audit failed
Screenshot unavailable

Do not add illustrations.

==================================================
CONSISTENCY WITH SUPER ADMIN
==================================================

The Leads dashboard must clearly belong to the same product as:

Super Admin → Sites

Reuse the same:

- sidebar
- top bar
- buttons
- table styling
- badges
- spacing
- typography
- filters
- dropdowns

Do not introduce a separate visual language.

==================================================
DO NOT CHANGE
==================================================

Do NOT modify:

- lead scoring formulas
- AI pipeline
- database model
- generation workflow
- CMS
- Sites dashboard
- public websites

This task is visual/UX refinement only.

==================================================
QUALITY CHECK
==================================================

Before finishing, ask:

Can I evaluate a lead in 5–10 seconds?

Is the current website screenshot prominent enough?

Is Lead Score easy to find?

Can I quickly mark GOOD / BAD / UNSURE?

Is Generate Demo obvious for a GOOD lead?

Does the screen visually match the new Super Admin design system?

Does it still work with 50–100 leads?

If not, improve it.