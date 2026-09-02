# Eindhoven Design District — Style Reference

> Editorial brutalism on white paper — a municipal design manifesto rendered in oversized type, sparse photographs, and absolute restraint.

Source: https://styles.refero.design/style/c90b584e-de5b-4971-9e13-8ab991bd96c0

## Concept

A near-monochrome canvas where typography does the heavy lifting and photography earns its space through scale and asymmetric placement. Black-on-white does 95% of the work. The only chromatic note is a single vivid red used as a content accent (article category labels) — never as UI chrome. Components are deliberately flat: pill-shaped ghost buttons, image-top article cards, hairline borders, zero shadows or gradients. The result reads as a printed design journal that happens to be interactive.

## Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Charcoal Ink | `#000000` | `--color-charcoal-ink` | All text, borders, icon strokes, nav links, button outlines. |
| Paper White | `#ffffff` | `--color-paper-white` | Primary page canvas, card surfaces, button fills, inverted text on dark. |
| Newsprint Gray | `#e8e8e8` | `--color-newsprint-gray` | Section background for content bands and footer areas. |
| Pewter | `#bfbfbf` | `--color-pewter` | Muted helper text, list dividers, secondary link borders. |
| Signal Red | `#ff0000` | `--color-signal-red` | Red outline accent for tags, dividers, focused UI edges. |

## Typography

Font: HelveticaNow. Substitute: Helvetica Neue, Inter, Neue Haas Grotesk.

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 14px | 1.4 | +0.21px | `--text-caption` |
| body-sm | 16px | 1.4 | +0.08px | `--text-body-sm` |
| body | 18px | 1.31 | -0.07px | `--text-body` |
| subheading | 23px | 1.2 | -0.39px | `--text-subheading` |
| heading-sm | 35px | 1.15 | -0.7px | `--text-heading-sm` |
| heading | 46px | 1.0 | -1.38px | `--text-heading` |
| heading-lg | 50px | 1.0 | -1.5px | `--text-heading-lg` |
| display | 150px | 0.93 | -7.5px | `--text-display` |

Weights: 400 (body, nav, display), 600 (headlines, button labels, card titles). Display is always weight 400 at extreme scale — the restraint is the signature.

## Spacing & Shape

- **Density:** spacious
- **Element gap:** 20px
- **Section gap:** 80px
- **Page max-width:** 1200px
- **Card padding:** 20px
- **Border radii:** tags 500px (pill), cards 0px, inputs 0px, buttons 500px (pill)
- **Elevation:** shadowless. Elevation via tonal contrast and whitespace, not shadows.

## Components

### Navigation Bar

Top of page, non-sticky, white background. Logo left ('Eindhoven / Design District' in two lines, 14px/400). Right: language pill, search circle (40px, 1px border, magnifier), 'Menu' pill button. 14-16px/400.

### Pill Ghost Button

1px solid #000000 border, 500px radius, #ffffff background, #000000 text, 16px/400, padding 10px 15px (compact) or 16px 20px (standard). No fill, no shadow.

### Pill Filled Button

#000000 background, #ffffff text, 500px radius. Solid black pill with white text for stronger commitment.

### Display Headline

150px+ HelveticaNow/400, #000000, line-height 0.93, letter-spacing -0.05em. Can be horizontal or rotated 90° for architectural compositions.

### Hero Composition

Full-viewport white canvas. Oversized display headline (150px+) split into two words — one horizontal, one rotated 90° vertical. Subtitle 19px/400 below. Photographs in loose collage grid, 300-400px, no borders, no rounded corners, integrated into the type composition.

### Article Card

#ffffff on #e8e8e8 section. No border, no shadow, no radius. Full-bleed photo top. Label 14px/400 #ff0000, title 19px/600 #000000, excerpt 16px/400 #000000 truncated.

### Intro Paragraph Block

Max-width ~600px. 18px/400, line-height 1.31, letter-spacing -0.004em. #000000 on #ffffff.

## Imagery

Documentary and editorial: architecture, designers, makers, objects. No filters, no duotone. Rectangular crops, no border, no radius. Placed with deliberate asymmetry, often abutting or overlapping typography.

## Do's and Don'ts

Do use HelveticaNow/400 for display above 50px. Do set border-radius to 500px for buttons, tags, language selector. Do maintain black/white/#e8e8e8 trichromatic discipline. Do use #ff0000 only for editorial category labels. Do alternate #ffffff and #e8e8e8 section backgrounds. Do place photographs as rectangular crops with no border, radius, or shadow.

Don't use weight 600 for display above 50px. Don't add drop shadows, gradients, or glass effects. Don't use border-radius values other than 0px or 500px. Don't use red for interactive states.
