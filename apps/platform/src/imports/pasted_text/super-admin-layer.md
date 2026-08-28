Add a new SUPER ADMIN layer to the existing WebsiteLeadAgent CMS design.

IMPORTANT:

Do NOT redesign the existing Site CMS.

The current CMS screens are for managing ONE website.

We now need a separate platform-level dashboard that is accessible ONLY to SUPER_ADMIN users.

Regular client users must never see this screen.

==================================================
PRODUCT STRUCTURE
==================================================

There are now two administration levels:

1. PLATFORM ADMIN
   For WebsiteLeadAgent SUPER_ADMIN only.

2. SITE CMS
   For users managing an individual customer website.

SUPER_ADMIN:

Platform Dashboard
    ↓
Select Site
    ↓
Existing Site CMS

SITE_ADMIN / EDITOR:

Login
    ↓
Their assigned Site CMS directly

They should NOT see the platform dashboard or a global site selector.

==================================================
SUPER ADMIN DASHBOARD
==================================================

Create a new screen:

Sites

This is the main control center for the platform owner.

It should feel operational and professional, not like a marketing dashboard.

Header:

WebsiteLeadAgent

Title:
Sites

Subtitle:
Manage generated customer websites

Primary action:

+ Create site

==================================================
SITE LIST
==================================================

Use a professional data table as the primary view.

Columns:

Site

Domain

Status

Template

Content

Last updated

Actions

Example:

ГАРАНТ КАЧЕСТВА

garantk.by

ACTIVE

construction-modern-v1

Pages 8 · Projects 14 · News 6

Today, 14:32

Open CMS
Preview
•••

==================================================
STATUS
==================================================

Support:

DRAFT
CONTENT_READY
DEMO_GENERATED
DEMO_APPROVED
ACTIVE
ARCHIVED

Use restrained status badges.

Do not use bright rainbow colors.

==================================================
FILTERS
==================================================

Above table:

Search sites

Status filter

Template filter

Sort:

Recently updated
Name
Created

==================================================
SITE ROW ACTIONS
==================================================

Primary:

Open CMS

Secondary:

Preview

More menu:

Site settings
Rebuild
Audit
Archive

Do not expose destructive actions directly.

==================================================
PLATFORM SUMMARY
==================================================

Above the table add a compact summary:

Total sites
Active
Draft
Needs attention

Do NOT make giant KPI cards.

Keep this operational and compact.

==================================================
ATTENTION REQUIRED
==================================================

Optionally show a small section:

Needs attention

Examples:

Preview build failed
Missing domain
CMS import incomplete
Lighthouse audit failed

Only use meaningful operational states.

==================================================
CREATE SITE
==================================================

Design a simple Create Site flow.

Fields:

Company / Site name

Lead
(optional existing lead)

Slug

Template

Default:

construction-modern-v1

Then:

Create Site

Do not expose database fields or internal implementation details.

==================================================
SITE DETAILS
==================================================

Clicking the site name may open a compact platform-level details page.

Show:

Site name
Domain
Status
Template
Created
Last updated

Links:

Open CMS
Open Preview

Operational information:

Last build
Last audit
CMS content status
Media count

Do not duplicate the entire Site CMS here.

==================================================
ACCESS CONTROL
==================================================

This screen is SUPER_ADMIN ONLY.

Do not show:

Sites
Platform
Global site switcher

to:

SITE_ADMIN
EDITOR

A normal site administrator should land directly inside their assigned website CMS.

==================================================
EXISTING CMS
==================================================

When SUPER_ADMIN clicks:

Open CMS

open the existing CMS scoped to the selected site.

Show a small context indicator:

ГАРАНТ КАЧЕСТВА
garantk.by

For SUPER_ADMIN only, optionally provide:

← All sites

This button must not exist for normal customer users.

==================================================
VISUAL STYLE
==================================================

Use the existing CMS design system.

Do not create a second unrelated design language.

Keep:

- neutral background
- white surfaces
- graphite text
- restrained green accent
- subtle borders
- compact tables
- professional typography

Avoid:

- marketing cards
- huge illustrations
- gradients
- colorful analytics
- oversized dashboard widgets

==================================================
IMPORTANT UX PRINCIPLE
==================================================

The Platform Dashboard answers:

Which websites exist?

What state are they in?

Which ones require attention?

How do I open their CMS?

How do I preview them?

It is NOT the place to edit customer content.

==================================================
RESPONSIVE
==================================================

Desktop-first.

Target:
1440px

Also ensure it works well at:
1024px

Mobile support is secondary because this is an internal SUPER_ADMIN tool.

==================================================
DO NOT MODIFY
==================================================

Do not redesign:

Pages editor
Projects editor
News editor
Media
Navigation
Contacts
Site Settings

Only add the new SUPER_ADMIN platform layer and integrate navigation to the existing Site CMS.