# WebsiteLeadAgent Platform — Global Dark Mode

## Summary
Implemented a global, data-theme driven dark mode for the platform UI. Three modes are supported: **Light**, **Dark**, and **System**.

## Key changes
- **FOUC prevention** — `apps/platform/index.html` now sets `data-theme` on `<html>` before React renders.
- **Theme state** — `apps/platform/src/theme/ThemeContext.tsx` provides `ThemeProvider`/`useTheme`, persists the preference under `wla-theme`, and listens to system scheme changes.
- **Theme toggle** — `apps/platform/src/theme/ThemeToggle.tsx` is embedded in `ProductHeader` for one-click switching.
- **Semantic tokens** — `apps/platform/src/index.css` defines `@theme` variables (e.g. `--color-bg`, `--color-surface`, `--color-text`, `--color-accent`) with a complete `html[data-theme='dark']` override.
- **Codemod** — `scripts/apply-wla-theme.mjs` automated replacement of bracket color classes and generic Tailwind color utilities with semantic token classes.
- **Manual tokenization** — remaining hard-coded colors and runtime color helpers in `Radar.tsx`, `LeadDetail.tsx`, `RadarScoreRing.tsx`, `Hub.tsx`, `App.tsx`, `Media.tsx`, `Pages.tsx`, `cms/ui.tsx`, `ActivityConsole.tsx`, and `qualification.ts` were converted to semantic tokens.
- **Type fixes** — minor pre-existing TypeScript issues in `App.tsx`, `NewDiscovery.tsx`, and `qualification.ts` were fixed so the platform builds cleanly.

## Verification
- `npm run build -w apps/platform` ✅
- `npx tsc --noEmit -p apps/platform/tsconfig.json` ✅
- `npx vitest run apps/platform/src/theme/theme.test.ts` ✅ (7 tests)
- Playwright screenshot script `scripts/capture-theme-screenshots.mjs` captured:
  - `apps/platform/screenshots/light-*.png`
  - `apps/platform/screenshots/dark-*.png`
  - `apps/platform/screenshots/system-dark-*.png`

## Notes
- Requires Node.js 22 (project engine). The default Node 18 in the environment cannot run Vite 8; use `~/.nvm/versions/node/v22.23.2/bin/node`.
- The full `npx vitest run` suite still has pre-existing failures in `tests/platform-auth.spec.ts` and `apps/platform/src/radar/qualification.test.ts` unrelated to the theme work.
- Showcase routes open in a separate window/tab (`/showcase/{previewToken}`) and are not styled by the platform theme tokens, so they remain unaffected.
