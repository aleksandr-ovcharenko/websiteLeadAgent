# Style Preset POC — Refero Architecture on `construction-modern-v1`

## Objective

Prove that the existing `construction-modern-v1` template and a single CMS site can render meaningfully different visual styles by swapping a `StylePreset` reference, without creating new templates or duplicating source websites.

## What was built

### 1. Design references

Stored normalized `DESIGN.md` + `metadata.json` for the five Refero styles in `design-reference/refero/{stykka,eindhoven,manna,xai,yllw}/`:

- Stykka — Scandinavian white-canvas, black hairlines, Inter, 0px image corners, 8/16px radii.
- Eindhoven — editorial brutalism, HelveticaNow, full pill UI, red content accent, 0/9999px radii.
- MANNA — bone/rust architecture monograph, 0px radius, hairline image borders, Space Grotesk.
- xAI — warm cream laboratory, universalSans, pill CTA, 8/16/9999px radii.
- Yllw — Swiss-Bauhaus putty paper, Gd Grio Vf substitute, 2px/6px radii, signal yellow banner.

### 2. Style preset contract (TypeScript)

- `packages/templates/src/construction-modern-v1/stylePresets.ts`
  - `PRESET_IDS`, `PresetId`, `isPresetId(value)`
  - `heroOverrides(...)` helper for hero typography/button overrides
  - `presetCSS(id)` returns the per-style `<style>` block injected at render time

### 3. Renderer wiring

- `packages/templates/src/types.ts` — added `stylePreset?: string` to `RenderContext`.
- `packages/templates/src/construction-modern-v1/index.ts` — reads `ctx.stylePreset`, validates it, injects the CSS block and `data-style` on `<body>`.
- `apps/site-renderer/src/server.ts` — passes `req.query.style` into the renderer.

### 4. Semantic tokens in the template

- `packages/templates/src/construction-modern-v1/index.css` — added `--font-display` / `--font-body` and wired `body` to `var(--font-body)`.
- `packages/templates/src/construction-modern-v1/App.tsx` — `GEO` display font and root `div` body font now use CSS variables instead of hardcoded names; added `data-hero="hero"` hook for preset CSS.

### 5. Temporary style switching

Append `?style=<preset>` to any showcase/preview URL:

```
/showcase/9z3vt653?style=manna
/showcase/9z3vt653?style=stykka
/showcase/9z3vt653?style=eindhoven
/showcase/9z3vt653?style=xai
/showcase/9z3vt653?style=yllw
```

The query param is orthogonal to the CMS route, content, and preview token.

## Screenshots

Desktop and mobile homepage captures for `9z3vt653` are in `docs/style-poc-screenshots/`:

- `default-home-{desktop,mobile}.png`
- `manna-home-{desktop,mobile}.png`
- `stykka-home-{desktop,mobile}.png`
- `eindhoven-home-{desktop,mobile}.png`
- `xai-home-{desktop,mobile}.png`
- `yllw-home-{desktop,mobile}.png`

The generated PNGs demonstrate five different canvas/hero colors, button radii, and font stacks on the same DOM.

## Findings

### Works well

- `?style=` switching is clean and preserves CMS routing/content.
- CSS-variable token injection is a fast, reversible way to re-theme a single template.
- Reference files can be stored without copying Refero assets or content.

### Architectural issues

- `construction-modern-v1` is heavily hardcoded: hero gradients, `text-white`, `color: 'transparent' + WebkitTextStroke`, `CTA` white-on-dark. Preset CSS must fight these with `!important`.
- The `App.tsx` file is 2k+ lines; real variants (editorial split hero, image-first cards, full-bleed MANNA rows) cannot be expressed purely with CSS.
- The current `StylePreset` is a runtime CSS-injection engine. It is not yet a first-class typed contract with `tokens`, `componentVariants`, and `layoutHints` as intended.

### Font substitutions used

- Stykka/Eindhoven/xAI/Yllw → `Inter` / `Helvetica Neue` system stacks.
- MANNA → `Space Grotesk` for display, `Inter` for body.
- No proprietary fonts (Gd Grio Vf, Scto Grotesk A, Merlo, universalSans) are embedded.

## Recommendations for production

1. **Refactor `App.tsx` to consume semantic tokens and `StyleContext`.** Replace hardcoded `text-white`, stroke tricks, and gradient overlays with `var(--hero-ink)`, `var(--hero-overlay)`, and component-variant class maps.
2. **Introduce a `StylePreset` file per style** with `tokens`, `componentVariants`, and `layoutHints` instead of one large CSS string.
3. **Implement real component variants** (e.g., `Hero: FULL_BLEED_IMAGE | EDITORIAL_SPLIT`, `Button: PILL | OUTLINE_RECT`) as conditional JSX controlled by the preset.
4. **Move the CSS into `index.css` or style-specific entry files** compiled by Vite, and only inject a small `<body data-style>` flag, not an entire CSS block.
5. **Store style presets in the CMS/db** so a customer can pick one at site-generation time, not only preview via query param.
6. **Add per-preset headline/eyebrow text transforms** (uppercase, tracking) so the typography is not just font/color changes.

## Conclusion

The POC proves that one template and one CMS site can switch visual styles through a `?style=` query parameter backed by semantic tokens and a small render-time CSS layer. The five Refero styles have been normalized, stored, and applied; screenshots show visible differentiation in canvas, ink, accent, radius, and font. To reach full production quality, `construction-modern-v1` needs component-level refactoring so style presets can control layout and behavior, not only color and radius.
