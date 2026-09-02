# Yllw — Style Reference

> Swiss-Bauhaus print monograph. Oversized Grotesk on warm putty paper, hairline rules, no shadows — architecture rendered as typography.

Source: https://styles.refero.design/style/9483a10e-e098-4f94-ae22-ab5a63702243

## Concept

Yllw is an editorial workspace brand: a single variable font pressed into monumental display sizes, a near-grayscale palette anchored by one warm putty neutral, and borders drawn with 1px inset strokes instead of shadows. The page reads like a Swiss-Bauhaus print artifact dropped onto a web canvas — oversized uppercase headlines (90–216px) with line-heights pulled tight to 0.88, a dominant putty-stone hue that functions as canvas, button, and border, and a single signal-yellow announcement bar as the only chromatic punctuation. Components are deliberately raw: 2px corners, hairline rules, no decorative gradients, no elevation depth.

## Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Putty Stone | `#cac7b4` | `--color-putty-stone` | Light neutral action fill; default page background. |
| Signal Yellow | `#ffdd00` | `--color-signal-yellow` | Announcement bar, occasional high-visibility callout. |
| Ink | `#000000` | `--color-ink` | Primary text, icon strokes, primary borders. |
| Paper | `#ffffff` | `--color-paper` | Inverse surface, card backgrounds on darker sections. |
| Carbon | `#191919` | `--color-carbon` | Secondary dark surface for inverted blocks. |
| Smoke | `#cccccc` | `--color-smoke` | Disabled and divider strokes on light surfaces. |

## Typography

Font: Gd Grio Vf. Substitute: Inter Variable or Söhne. The single variable font covers captions through 216px hero display.

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 13px | 1.28 | -0.08px | `--text-caption` |
| body | 16px | 1.5 | -0.08px | `--text-body` |
| subheading | 18px | 1.28 | — | `--text-subheading` |
| heading-sm | 20px | 1.24 | — | `--text-heading-sm` |
| heading | 26px | 1.18 | -0.156px | `--text-heading` |
| heading-xl | 44px | 1.0 | — | `--text-heading-xl` |
| display-sm | 64px | 0.96 | -0.64px | `--text-display-sm` |
| display | 97px | 0.9 | -1.455px | `--text-display` |
| display-lg | 166px | 0.88 | -3.32px | `--text-display-lg` |
| display-xl | 216px | 0.88 | -5.4px | `--text-display-xl` |

Weights 400-700 used. Display at 500-600 with tight leading. Negative tracking at 64px+.

## Spacing & Shape

- **Base unit:** 8px
- **Density:** comfortable
- **Element gap:** 16-24px
- **Section gap:** 64-96px
- **Card padding:** 24-32px
- **Page max-width:** 1200-1400px
- **Radii:** nav 2px, tags 2px, cards 6px, badges 2px, buttons 2px
- **Shadows:** 1px inset strokes (#000000 or #ffffff) — no drop shadows

## Components

### Announcement Bar

Full-bleed #ffdd00 bar, 32-40px tall. Gd Grio Vf 13-14px/500 #000000, centered. The only chromatic punctuation.

### Primary Navigation

Sticky top nav on #cac7b4 canvas. Logo left ('YLLW' 16px/700, uppercase). Link groups in two clusters. Right: text links + filled button (#cac7b4 bg, #000000 border 1px inset, 2px radius, 14px/500).

### Primary CTA Button (Putty Filled)

#cac7b4 background, #000000 text, 2px radius, 1px inset #000000 stroke. 14px/500 Gd Grio Vf. Hover toward #b8b5a3.

### Secondary Button (White Outlined)

#ffffff background, #000000 text, 2px radius, 1px inset #000000 stroke. Used on putty canvas where filled would disappear.

### Ghost Text Link

No background, no border. 14px/500 #000000, underline on hover.

### Hero Display Headline

116-216px/500, uppercase, #000000, line-height 0.88, letter-spacing -0.015em to -0.025em on #cac7b4 canvas. Text breaks across two lines with a rectangular photograph embedded inline between words.

### Section Heading

40-64px/500-600, uppercase, line-height 0.96, letter-spacing -0.01em. #ffffff on putty/photo, #000000 on putty canvas.

### Service Accordion Row

#ffffff surface with 1px #000000 hairline top and bottom. Left: 14px/400 short label. Right: 20-26px/500 uppercase service name. Far right: '+' glyph. 64-80px height, 24px horizontal padding.

### Info Card

#cac7b4, 6px radius, 1px #000000 hairline, 24-32px padding. Optional 1px inset #ffffff stroke on darker sections. 26-36px/600 headline, 14-16px/400 support.

### Image Tile

Raw rectangular image, no border-radius, no border, no caption. Embedded inline within the text flow, sized to match the x-height of the display headline.

## Imagery

Documentary and unprocessed: office interiors, teamwork, architectural floor plans. No lifestyle staging, no color grading, no duotone. Images rectangular with no radius, embedded inline rather than as standalone hero panels. The floor plan in the carousel is muted near-monochrome blending with the putty canvas. Text-dominant, photography as punctuation.

## Do's and Don'ts

Do set every page background to #cac7b4 unless explicitly inverted. Use Gd Grio Vf for everything including UI. Pull display line-height to 0.88-0.96 at 64px+. Define cards and buttons with 1px inset #000000 strokes. Reserve #ffdd00 for the announcement bar. Apply 2px radius to buttons, tags, badges, nav; 6px only for content cards.

Don't introduce drop shadows, blur, or glow. Don't add a second saturated accent. Don't round above 6px. Don't use line-height above 1.0 for display sizes. Don't apply positive tracking to large type. Don't place black buttons on putty — use white-outlined secondaries.
