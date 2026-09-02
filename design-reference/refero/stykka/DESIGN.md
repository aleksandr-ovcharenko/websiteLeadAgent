# Stykka — Style Reference

> Scandi atelier under white light — a quiet, hand-built showroom where the only voice is the photograph.

Source: https://styles.refero.design/style/b43fdb3c-85e9-4282-9262-1d3deb4b679d  
Brand reference: https://stykka.com

## Concept

A Scandinavian kitchen brand that treats the interface like a museum catalog: pure white canvas, black hairline borders, and full-bleed photography that carries every ounce of warmth, color, and craft. The UI is deliberately invisible — there is no accent color, no decoration, no shadow stack — so that the kitchens in the imagery feel like the only subject on screen. Typography does the talking: Inter at tight negative tracking on large display sizes, uppercase tracked labels for section openers. Spacing is compact and editorial, with 10px gaps between elements and generous white space at the section level.

## Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Press Black | `#000000` | `--color-press-black` | Primary text, 1px hairlines, icon strokes, outlined button borders. |
| Gallery White | `#ffffff` | `--color-gallery-white` | Page canvas, card surfaces, button text on dark surfaces, inverse overlay backgrounds. |
| Plate Gray | `#b8b8b8` | `--color-plate-gray` | Subtle disabled state, placeholder fill, secondary metadata. |

## Typography

Font stack: `Inter` primary, `Azeret Mono` for one editorial line, `system-ui` for micro labels.

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 11px | 1.2 | +0.23px | `--text-caption` |
| body-sm | 14px | 1.25 | +0.29px | `--text-body-sm` |
| body | 16px | 1.5 | -0.37px | `--text-body` |
| subheading | 22px | 1.2 | -0.79px | `--text-subheading` |
| heading-sm | 24px | 1.2 | -0.89px | `--text-heading-sm` |
| heading | 30px | 1.1 | -1.2px | `--text-heading` |
| display | 46px | 1.05 | -1.93px | `--text-display` |

Weight 400 carries body and nav; weight 500 lifts labels, button text, and uppercase section openers. Display sizes use aggressive negative tracking.

## Spacing & Shape

- **Density:** compact
- **Element gap:** 10px
- **Section gap:** 60-80px
- **Page max-width:** 1280px
- **Border radii:** tags 8px, cards 16px, buttons 8px, image containers 0px
- **Elevation:** zero shadow vocabulary. Structure via 1px hairline borders in #000000 and whitespace.

## Components

### Transparent Top Nav

Full-width, position-absolute over hero, no background. Left: nav links in Inter 16px/400 with 20px spacing. Center: wordmark in Inter 22-24px/500. Right: language selector and outlined button. 20px vertical padding. No border, no shadow, no background.

### Outlined CTA Button

Inter 16px/500, 1px solid #000 border, 8px radius, padding ~10px 18px, transparent fill. Hover inverts to fill #000000, text #ffffff.

### Hero Section (Full-Bleed)

100vw × ~100vh image, no overlay, no gradient. Text block in the lower-left third, aligned to the 10px grid, padded from viewport edge. Contains a tracked uppercase label, a display headline, and a single CTA.

### Hero Overlay Label

Inter 14px/500, #ffffff over photography, letter-spacing +0.29px, uppercase. Flips to #000000 on white backgrounds.

### Display Headline

Inter 46px/400, #ffffff on hero / #000000 on white sections, line-height 1.05, letter-spacing -1.93px. Weight 400 is the signature.

### Feature Grid Card

4-column editorial card. Image on top (full-bleed, 0px corners, 4:3 or 3:4 aspect). 10px row gap to title (14-16px/500 uppercase). 10px gap to body (16px/400). No card surface, no border, no shadow.

### Section Header Block

Stack: tracked uppercase label (14px) → display or heading headline (30-46px) → optional supporting paragraph (16px, max-width ~60ch). Vertically centered or left-aligned to the 10px grid. 60-80px section gap.

### Image Grid

2- or 3-column grid of hard-edged images, 10-15px gutters, no captions, no borders.

### Footer Block

Full-width #000000 background, #ffffff text. 20px internal padding. Wordmark, link list, copyright.

## Imagery

Full-bleed, hard 0px corners, no rounded masking, no drop-shadow, no duotone. Warm, natural-light, editorial interior photography.

## Do's and Don'ts

Do use #000000 for every text and 1px border. Do set display headlines at weight 400 with tight tracking. Do use the 14px uppercase tracked label as every section opener. Do use the outlined CTA. Do let photography fill the viewport. Do hold element gaps to 10px and section gaps to 60-80px. Do use 16px card radius on text-bearing surfaces.

Don't introduce accent colors, drop-shadows, filled/ghost buttons, positive tracking above 16px, or 16px radius on images.
