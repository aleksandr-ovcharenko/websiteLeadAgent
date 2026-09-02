# xAI — Style Reference

> Warm cream laboratory with a black pill.

Source: https://styles.refero.design/style/3b83dfe4-2f53-4a4d-819d-e6045ca5f7dc

## Concept

xAI runs a restrained near-monochrome editorial system on a warm-white canvas. Type leads the visual hierarchy: oversized display headlines at near-100% line-height with tight negative tracking sit above generous breathing room. The single defining interaction is a pill-shaped, pure-black filled button — everything else is ghost, outlined, or surface-toned. Cards are flat, borderless, and warm-cream (#f9f8f6); depth comes from a single hairline ring rather than shadow stacks. Color is rationed: a warm off-white page, cream cards, near-black ink, and the occasional vivid accent used very sparingly.

## Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Jet Ink | `#0a0a0a` | `--color-jet-ink` | Primary text, filled CTA buttons, logo mark. |
| Charcoal | `#151515` | `--color-charcoal` | Dark code/terminal surfaces. |
| Fog | `#858585` | `--color-fog` | Secondary text, icon strokes, inactive nav. |
| Pewter | `#9d9d9d` | `--color-pewter` | Tertiary text, meta labels. |
| Steel | `#545454` | `--color-steel` | Mid-weight body text. |
| Dove | `#d5d9e2` | `--color-dove` | Hairline borders, input rings, button focus. |
| Cream | `#f9f8f6` | `--color-cream` | Card surfaces, secondary panels, tag backgrounds. |
| Paper | `#ffffff` | `--color-paper` | Page background, button text on dark. |
| Sand | `#f2ede5` | `--color-sand` | Warm wash backgrounds, Beta pill. |

## Typography

Fonts: `universalSans` (UI/body), `universalSansDisplay` (H1/H2), `GeistMono` (technical snippets).

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 12px | 20px | -0.12px | `--text-caption` |
| body-sm | 14px | 20px | — | `--text-body-sm` |
| body | 16px | 24px | — | `--text-body` |
| heading-sm | 24px | 32px | -0.6px | `--text-heading-sm` |
| subheading | 30px | 36px | -0.75px | `--text-subheading` |
| heading | 48px | 48px | -1.2px | `--text-heading` |
| heading-lg | 60px | 60px | -1.5px | `--text-heading-lg` |
| display | 72px | 72px | -1.8px | `--text-display` |

Display is weight 400, not bold — authority through size and restraint. universalSans/500 for emphasis. GeistMono for terminal/code/metadata.

## Spacing & Shape

- **Base unit:** 4px
- **Density:** comfortable
- **Element gap:** 12px
- **Section gap:** 80px
- **Card padding:** 40px
- **Page max-width:** 1200px
- **Radii:** cards 16px, pills 9999px, inputs 6px, buttons 9999px
- **Shadows:** single hairline ring (1px) rather than stacks.

## Components

### Filled Primary Button

#0a0a0a background, #ffffff text, 9999px radius, padding 12px 20px, 14px/500 universalSans. Main CTA.

### Ghost Secondary Button

Transparent, #0a0a0a text, 9999px radius, 14px/500. Hover: 1px #d5d9e2 ring.

### Compact Nav Button

#ffffff background, #0a0a0a text, 9999px radius, 6px 12px, 1px #d5d9e2 border.

### Flat Cream Card

#f9f8f6 background, radius 8-16px, padding 0 (media flush), no shadow, no border. Holds product images or code mockups.

### Pricing Tier Card

#f9f8f6, radius 16px, padding 40px. Spacious, weight 500 tier name, weight 400 specs.

### Navigation Link

14px/500 universalSans, #858585 default → #0a0a0a on hover, no underline. Sticky header with backdrop-blur and hairline bottom on scroll.

### News Card

4-column grid. No surface, no border, no radius. Image top, 11px #858585 date, 16px/500 #0a0a0a title.

## Imagery

Product-screenshot driven: chat threads, code editors, voice waveforms. Flat cream containers with no rounded inner edges. Decorative warmth from large radial gradient orbs (peach/coral) blurred at 64px behind code panels. No lifestyle photography, no 3D, no human figures. Icons are stroke-based, 1.5px weight, Fog by default.

## Do's and Don'ts

Do use #0a0a0a for the primary filled button. Do set headlines (24px+) with letter-spacing -0.025em and line-height 1.0-1.33. Do apply 9999px radius to every button, tag, language tab. Do use #f9f8f6 for any surface above the page. Do keep the Beta pill to feature-release moments only.

Don't use chromatic colors for buttons or links. Don't stack shadows. Don't set body text below 14px or above 18px. Don't add background colors to nav links or news cards. Don't use pure black (#000000) — always #0a0a0a.
