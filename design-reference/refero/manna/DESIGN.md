# MANNA — Style Reference

> Architecture monograph at golden hour — warm bone pages, rust accent panels, and oversized grotesk display type floating over full-bleed photography.

Source: https://styles.refero.design/style/d83fd0b1-afde-41ff-b970-c622bfed9f59

## Concept

MANNA operates as an architecture monograph laid flat on the screen: expansive photography commands the canvas, typography arrives in two scales (whisper and shout), and the page alternates between warm bone and terracotta rust like rooms in a sunlit house. Almost no UI chrome — no buttons, no cards, no rounded containers. Images sit edge-to-edge, framed by hairline black rules; captions float in the gutter beneath. The palette is disciplined: a single chromatic accent (rust orange) used only for full-bleed section panels; everything else is bone white, black ink, and photography.

## Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Bone | `#f2edde` | `--color-bone` | Primary canvas, page background, footer surface. Warm off-white that reads as paper. |
| Rust | `#af6446` | `--color-rust` | Full-bleed section panels, footer band — terracotta accent. |
| Ink | `#000000` | `--color-ink` | All text, image borders, hairline rules. |

## Typography

Fonts: Scto Grotesk A (display) and Merlo (body). Substitutes: Space Grotesk and Söhne/Inter.

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 14px | 1.29 | — | `--text-caption` |
| body-sm | 16px | 1.5 | — | `--text-body-sm` |
| subheading | 26px | 1.23 | — | `--text-subheading` |
| display | 60px | 1.29 | — | `--text-display` |

Scto Grotesk A: weight 500 at ~60px for monumental section labels; weight 300 for softer subheadings. Merlo: 26px for intro paragraphs, 16px for captions.

## Spacing & Shape

- **Density:** comfortable
- **Element gap:** 12-20px
- **Section gap:** 60px
- **Card padding:** 0px
- **Border radii:** images 0px, buttons 0px, containers 0px
- **Image treatment:** 1px solid #000000 hairline border around every photograph
- **Elevation:** flat — no drop shadows, no blur, no z-depth

## Components

### Full-Bleed Photograph

Primary content unit. Fills its column edge-to-edge, 0px border-radius, surrounded by 1px solid #000000 hairline border. Caption sits below in 14px Merlo, 10px margin-bottom.

### Image Caption

14px Merlo/400, #000000, left-aligned to image edge. 10px margin-bottom from image. No italic, no bold — quiet editorial footnote.

### Display Word Marker

60px Scto Grotesk A/500, #000000, left-aligned at viewport edge. Functions as wayfinding without navigation chrome.

### Rust Section Panel

Full-bleed colored band that divides the page like a room transition. Background #af6446, no padding override, no border. Contains #000000 text. Appears sparingly.

### Bone Section Panel

Default page surface: #f2edde, no border, no radius.

### Horizontal Image Row

3-column or 2-column image grid at section top. Images side-by-side at full height, equal columns, 0px gap. Each image has 1px black border and its own caption.

### Footer Band

Background #f2edde or #af6446, 20px padding on all sides, 16px Merlo text. No dividers, no buttons — plain text links.

## Imagery

Full-bleed architectural photographs dominate every section — tight crops of materials, trees, grasses, interior details, building exteriors. Naturalistic, high-fidelity: no filters, no duotone, no color grading. 70-80% of viewport space; text floats as caption, heading, or section marker.

## Do's and Don'ts

Do use 0px border-radius on every image, container, and surface. Frame every photograph with 1px solid #000000. Set display type at 60px Scto Grotesk A/500 anchored to viewport edge. Apply #af6446 rust only as full-bleed section backgrounds. Maintain 12-20px gaps and 60px section gaps. Let photography be the content.

Do not use rounded corners, use rust as CTA, add drop shadows, mix more than two type sizes, apply letter-spacing to display type, fill icons with rust, or add navigation buttons/overlay UI.
