Fix ONLY the product-level navigation wiring.

Do NOT redesign anything.
Do NOT change Studio screens.
Do NOT change Radar, Factory, Forge or Hub layouts.

The current Make already contains:

Hub.tsx
Radar.tsx
Factory.tsx
Forge.tsx
Studio / CMS screens
ProductHeader.tsx

The visual design is approved.

The problem is that global navigation is not wired.

==================================================
1. INTRODUCE PRODUCT-LEVEL NAVIGATION STATE
==================================================

App.tsx must support these product areas:

hub
radar
factory
forge
studio

Use a ProductArea state or lightweight internal router.

Example concept:

const [productArea, setProductArea] =
  useState<ProductArea>('studio')

Do not replace the existing Studio `screen` state.

Studio still needs its own internal navigation:

dashboard
pages
news
projects
services
vacancies
media
navigation
contacts
settings
users

There are TWO navigation levels:

ProductArea
+
Studio Screen

==================================================
2. WLA LOGO → HUB
==================================================

Make the WLA logo / WebsiteLeadAgent brand clickable.

Click:

WLA / WebsiteLeadAgent
→ Hub

Do not use href="#" with preventDefault and no action.

==================================================
3. PRODUCT HEADER LINKS
==================================================

Wire:

Radar
→ productArea = 'radar'

Factory
→ productArea = 'factory'

Forge
→ productArea = 'forge'

The links should show an active state for the current product area.

Do not create new screens.

Use the existing:

Radar.tsx
Factory.tsx
Forge.tsx

==================================================
4. HUB
==================================================

Render existing:

Hub.tsx

when:

productArea === 'hub'

Its cards already call onNavigate(ProductArea).

Connect them to the same product-level navigation.

==================================================
5. FORGE → STUDIO
==================================================

Existing Forge action:

Studio

must:

1. select the clicked Site
2. set productArea = 'studio'
3. open Studio Dashboard

Use existing SiteContext.

Do not recreate Studio.

==================================================
6. STUDIO → FORGE
==================================================

The existing:

← Forge

button in ProductHeader currently has an empty onClick.

Wire it to:

productArea = 'forge'

==================================================
7. OPEN SHOWCASE
==================================================

Keep the current Open Showcase visual button.

For the Make prototype it may use a mock preview action,
but it must not remain an empty onClick.

At minimum show a clear prototype behavior / navigation state.

Do not redesign it.

==================================================
8. RADAR NAVIGATION
==================================================

Existing Radar already calls:

onNavigate('forge')

and:

onNavigate('factory')

Connect these to the same ProductArea state.

Do not duplicate Radar.

==================================================
9. FACTORY / FORGE
==================================================

Ensure all existing internal cross-links use the SAME:

onNavigate(ProductArea)

mechanism.

Examples:

Radar
→ Factory

Radar
→ Forge

Forge
→ Factory

Hub
→ Radar / Factory / Forge

Studio
→ Forge

WLA logo
→ Hub

==================================================
10. PRODUCT HEADER VISIBILITY
==================================================

Use the same ProductHeader on:

Hub
Radar
Factory
Forge
Studio

For SUPER_ADMIN.

When inside Studio keep:

Site context
Back to Forge
Open Showcase

For Hub / Radar / Factory / Forge,
do not show irrelevant Studio-only site controls if they are not needed.

Keep the header visually identical.

==================================================
11. CUSTOMER ROLES
==================================================

SITE_ADMIN / EDITOR:

must remain inside Studio.

Do not expose:

Hub
Radar
Factory
Forge

to those roles.

Their WLA branding may remain,
but product-level navigation must remain hidden.

==================================================
12. DO NOT BREAK STUDIO
==================================================

This is critical.

After wiring product navigation verify all Studio screens still work:

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

Do not remove or simplify CMS functionality.

==================================================
13. ACCEPTANCE TEST
==================================================

Starting in Studio:

WLA logo
→ Hub

Hub → Radar
works

Radar → Factory
works

Radar → Forge
works

Forge → Factory
works

Forge → Studio
works and selects Site

Studio → ← Forge
works

Header Radar / Factory / Forge links
all work

No control should use:

href="#"
+
preventDefault()

without real navigation.

No important navigation button should have:

onClick={() => {}}

==================================================
FINAL RULE
==================================================

Do not redesign anything.

This task is ONLY:

WIRE THE EXISTING PRODUCT SCREENS TOGETHER.