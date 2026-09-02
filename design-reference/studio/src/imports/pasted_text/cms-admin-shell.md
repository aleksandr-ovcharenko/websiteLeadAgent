Modify ONLY the product shell / top-level navigation of the existing CMS Admin.

CRITICAL:

DO NOT redesign, remove, simplify or recreate the existing CMS.

The current CMS functionality and all existing screens MUST remain intact.

Preserve exactly:

Dashboard

Pages
Page Editor

News
News Editor

Projects
Project Editor

Services
Service Editor

Vacancies
Vacancy Editor

Media

Navigation

Contacts

Site Settings

Users

The existing CMS sidebar, editors, tables, forms and content layouts are already approved.

==================================================
GOAL
==================================================

The CMS is now called:

STUDIO

Studio is one module inside the larger WebsiteLeadAgent product.

We need to ADD a shared WebsiteLeadAgent product navigation layer
without replacing the existing CMS navigation.

Think of two navigation levels:

LEVEL 1 — WebsiteLeadAgent product

LEVEL 2 — Studio / CMS navigation

==================================================
GLOBAL PRODUCT HEADER
==================================================

Add a compact global header ABOVE the current CMS application.

Height approximately:

48–52px

Use the same strict admin visual style.

LEFT:

simple WLA logo

WLA

WebsiteLeadAgent

The logo must be clickable.

Clicking it conceptually returns SUPER_ADMIN to:

HUB

==================================================
SUPER ADMIN PRODUCT NAVIGATION
==================================================

For SUPER_ADMIN show:

Radar

Factory

Forge

These are global product areas.

Do NOT add all CMS pages into this header.

Do NOT remove the existing Studio sidebar.

Conceptually:

┌─────────────────────────────────────────────────────────────┐
│ [WLA] WebsiteLeadAgent    Radar    Factory    Forge         │
├─────────────────────────────────────────────────────────────┤
│ STUDIO SIDEBAR │ EXISTING CMS CONTENT                       │
│                │                                            │
└─────────────────────────────────────────────────────────────┘

==================================================
STUDIO CONTEXT
==================================================

Clearly indicate that the current area is:

Studio

Do this subtly.

For example:

WLA / Studio

or a small Studio label near the site context.

Do not rename:

Pages
News
Projects
Services
etc.

==================================================
CURRENT SITE CONTEXT
==================================================

Keep the existing current-site selector visual concept.

But treat its content as DYNAMIC.

Do not imply that these sites are permanently hardcoded:

ГАРАНТ КАЧЕСТВА
Строй Инвест

They are example Site records only.

Conceptually the selector will receive:

currentSite
availableSites

from the application.

==================================================
SUPER ADMIN BACK NAVIGATION
==================================================

For SUPER_ADMIN provide an obvious:

← Forge

or:

Back to Forge

action near the Site context.

The normal flow is:

Forge
→ Open Studio
→ edit website

==================================================
SHOWCASE
==================================================

Rename / clarify:

Open preview

as:

Open Showcase ↗

This represents the generated website preview.

Keep it in the current top area.

Do not embed Showcase inside Studio.

==================================================
CUSTOMER USERS
==================================================

SITE_ADMIN and EDITOR must NOT see global:

Radar
Factory
Forge

For them keep:

WLA logo
Studio
their current Site

and the normal CMS sidebar.

If they have only one assigned Site,
do not force a global multi-site selection workflow.

==================================================
IMPORTANT
==================================================

DO NOT create:

a new Hub page inside this CMS Make

a Factory dashboard inside this CMS Make

a Forge dashboard inside this CMS Make

a Radar dashboard inside this CMS Make

Those are separate WebsiteLeadAgent modules.

Only create the common navigation / shell necessary to link them.

==================================================
DO NOT CHANGE
==================================================

Do NOT change:

CMS Dashboard layout

Content overview

Recent changes

Quick actions

Pages UI

Editors

Projects UI

News UI

Services UI

Vacancies UI

Media UI

Navigation editor

Contacts UI

Site Settings

Users UI

CMS sidebar structure

Existing typography

Existing density

Existing visual style

==================================================
QUALITY CHECK
==================================================

After the change verify:

Can I still access every existing CMS screen?

Did the existing CMS sidebar remain intact?

Did any editor disappear?

Did any CMS functionality disappear?

Does Studio now clearly feel like part of WebsiteLeadAgent?

Is there an obvious way back to Forge?

Is the WLA logo always visible and does it represent a link to Hub?

Is Open Showcase clearly available?

If any CMS functionality was lost,
restore it before finishing.