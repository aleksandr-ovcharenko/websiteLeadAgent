export const PRESET_IDS = ['manna', 'stykka', 'eindhoven', 'xai', 'yllw', 'foret', 'ember', 'atlas', 'nordic'] as const;

export type PresetId = typeof PRESET_IDS[number];

export function isPresetId(value: string | undefined): value is PresetId {
  return !!value && PRESET_IDS.includes(value as PresetId);
}

function heroOverrides(textColor: string, accent: string, overlay: string, hideGradient: boolean, imageRadius: string) {
  return `
[data-hero="hero"] { background-color: var(--dark) !important; }
[data-hero="hero"] .absolute.inset-0 { ${hideGradient ? 'background: none !important;' : `background: ${overlay} !important;`} }
[data-hero="hero"] .text-white,
[data-hero="hero"] .text-white *,
[data-hero="hero"] .text-\[9\.5px\],
[data-hero="hero"] .text-\[9px\],
[data-hero="hero"] .text-\[11px\],
[data-hero="hero"] .text-sm,
[data-hero="hero"] .text-base,
[data-hero="hero"] h1,
[data-hero="hero"] h1 span,
[data-hero="hero"] p,
[data-hero="hero"] a {
  color: ${textColor} !important;
  -webkit-text-stroke: none !important;
  -webkit-text-fill-color: currentColor !important;
}
[data-hero="hero"] .border-b,
[data-hero="hero"] [style*="borderBottom"] {
  border-color: currentColor !important;
}
[data-hero="hero"] a.inline-flex,
[data-hero="hero"] button {
  color: ${accent} !important;
  background: ${textColor} !important;
  border-color: ${textColor} !important;
  border-radius: ${imageRadius} !important;
}
[data-hero="hero"] a.inline-flex:hover,
[data-hero="hero"] button:hover {
  background: ${accent} !important;
  color: ${textColor} !important;
}
[data-hero="hero"] img {
  border-radius: 0 !important;
}`;
}

const CSS: Record<PresetId, string> = {
  manna: `body[data-style="manna"] {
  --bg: #f2edde;
  --fg: #000000;
  --dark: #f2edde;
  --brass: #000000;
  --brass-light: #000000;
  --muted: #6b6055;
  --border: #000000;
  --card-bg: #f2edde;
  --overlay: rgba(242, 237, 222, 0.85);
  --font-display: 'Space Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
body[data-style="manna"] img,
body[data-style="manna"] .rounded,
body[data-style="manna"] [class*="rounded"] {
  border-radius: 0 !important;
}
body[data-style="manna"] button,
body[data-style="manna"] a.inline-flex {
  border-radius: 0 !important;
}
${heroOverrides('#000000', '#f2edde', 'rgba(242,237,222,0.45)', true, '0px')}`,

  stykka: `body[data-style="stykka"] {
  --bg: #ffffff;
  --fg: #000000;
  --dark: #ffffff;
  --brass: #000000;
  --brass-light: #000000;
  --muted: #888888;
  --border: #000000;
  --card-bg: #ffffff;
  --overlay: rgba(255, 255, 255, 0.55);
  --font-display: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
body[data-style="stykka"] img,
body[data-style="stykka"] .rounded,
body[data-style="stykka"] [class*="rounded"] {
  border-radius: 0 !important;
}
body[data-style="stykka"] button,
body[data-style="stykka"] a.inline-flex {
  border-radius: 8px !important;
  background-color: transparent !important;
  color: #000000 !important;
  border: 1px solid #000000 !important;
}
body[data-style="stykka"] button:hover,
body[data-style="stykka"] a.inline-flex:hover {
  background-color: #000000 !important;
  color: #ffffff !important;
}
${heroOverrides('#000000', '#ffffff', 'rgba(255,255,255,0.25)', true, '8px')}`,

  eindhoven: `body[data-style="eindhoven"] {
  --bg: #ffffff;
  --fg: #000000;
  --dark: #ffffff;
  --brass: #000000;
  --brass-light: #ff0000;
  --muted: #bfbfbf;
  --border: #000000;
  --card-bg: #e8e8e8;
  --overlay: rgba(255, 255, 255, 0.25);
  --font-display: 'Helvetica Neue', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-body: 'Helvetica Neue', 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
body[data-style="eindhoven"] img,
body[data-style="eindhoven"] .rounded,
body[data-style="eindhoven"] [class*="rounded"] {
  border-radius: 0 !important;
}
body[data-style="eindhoven"] button,
body[data-style="eindhoven"] a.inline-flex {
  border-radius: 9999px !important;
  background-color: transparent !important;
  color: #000000 !important;
  border: 1px solid #000000 !important;
}
body[data-style="eindhoven"] button:hover,
body[data-style="eindhoven"] a.inline-flex:hover {
  background-color: #000000 !important;
  color: #ffffff !important;
}
${heroOverrides('#000000', '#ffffff', 'rgba(255,255,255,0.15)', true, '9999px')}`,

  xai: `body[data-style="xai"] {
  --bg: #ffffff;
  --fg: #0a0a0a;
  --dark: #f9f8f6;
  --brass: #0a0a0a;
  --brass-light: #0a0a0a;
  --muted: #858585;
  --border: #d5d9e2;
  --card-bg: #f9f8f6;
  --overlay: rgba(249, 248, 246, 0.7);
  --font-display: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
body[data-style="xai"] img,
body[data-style="xai"] .rounded,
body[data-style="xai"] [class*="rounded"] {
  border-radius: 8px !important;
}
body[data-style="xai"] button,
body[data-style="xai"] a.inline-flex {
  border-radius: 9999px !important;
  background-color: #0a0a0a !important;
  color: #ffffff !important;
  border: none !important;
}
${heroOverrides('#0a0a0a', '#ffffff', 'rgba(249,248,246,0.5)', true, '9999px')}`,

  yllw: `body[data-style="yllw"] {
  --bg: #cac7b4;
  --fg: #000000;
  --dark: #cac7b4;
  --brass: #000000;
  --brass-light: #ffdd00;
  --muted: #555555;
  --border: #000000;
  --card-bg: #ffffff;
  --overlay: rgba(202, 199, 180, 0.75);
  --font-display: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
body[data-style="yllw"] img,
body[data-style="yllw"] .rounded,
body[data-style="yllw"] [class*="rounded"] {
  border-radius: 2px !important;
}
body[data-style="yllw"] button,
body[data-style="yllw"] a.inline-flex {
  border-radius: 2px !important;
  background-color: #cac7b4 !important;
  color: #000000 !important;
  border: 1px inset #000000 !important;
}
body[data-style="yllw"] button:hover,
body[data-style="yllw"] a.inline-flex:hover {
  background-color: #b8b5a3 !important;
}
${heroOverrides('#000000', '#000000', 'rgba(202,199,180,0.35)', true, '2px')}`,

  // ── Dark-safe presets: keep --dark dark so hardcoded light-on-dark copy stays
  // legible; variants differ through accent, paper tone, radius and font.
  nordic: `body[data-style="nordic"] {
  --bg: #f6f4ef;
  --fg: #1d1b16;
  --dark: #1f1c17;
  --brass: #8a6a48;
  --brass-light: #a9885f;
  --muted: #6f6a5e;
  --border: #ddd6c9;
  --card-bg: #ffffff;
  --overlay: rgba(31, 28, 23, 0.45);
  --font-display: 'Geologica', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
/* nordic: light warm-neutral architectural language — airy spacing, soft
   radius, white cards, quiet borders */
body[data-style="nordic"] img { border-radius: 10px !important; }
body[data-style="nordic"] [class*="rounded"] { border-radius: 10px !important; }
body[data-style="nordic"] button,
body[data-style="nordic"] a.inline-flex { border-radius: 8px !important; }
body[data-style="nordic"] section { border-top: none !important; }
body[data-style="nordic"] article { border-radius: 12px !important; overflow: hidden; }
body[data-style="nordic"] [data-hero] { min-height: 78svh !important; }
body[data-style="nordic"] [data-hero] h1 { letter-spacing: -0.01em !important; }`,
  foret: `body[data-style="foret"] {
  --bg: #f4f1e8;
  --fg: #161d18;
  --dark: #14201a;
  --brass: #c8742c;
  --brass-light: #e0954f;
  --muted: #5d6b60;
  --border: #c8c2b2;
  --card-bg: #ece7d8;
  --overlay: rgba(20, 32, 26, 0.55);
  --font-display: 'Space Grotesk', 'Geologica', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
body[data-style="foret"] img,
body[data-style="foret"] [class*="rounded"] { border-radius: 0 !important; }
/* foret: editorial full-bleed hero, square edges, grotesk display */
body[data-style="foret"] [data-hero] h1 { letter-spacing: -0.02em !important; }
body[data-style="foret"] section { border-top: 1px solid rgba(0,0,0,0.08) !important; }`,

  ember: `body[data-style="ember"] {
  --bg: #efece9;
  --fg: #1a1512;
  --dark: #1c1410;
  --brass: #b04a2e;
  --brass-light: #d4755a;
  --muted: #6e6258;
  --border: #cfc5bb;
  --card-bg: #e7e1d9;
  --overlay: rgba(28, 20, 16, 0.55);
  --font-display: 'Geologica', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
body[data-style="ember"] img,
body[data-style="ember"] [class*="rounded"] { border-radius: 4px !important; }
body[data-style="ember"] button,
body[data-style="ember"] a.inline-flex { border-radius: 9999px !important; }
/* ember: centered composition, warm pill CTAs, tighter rhythm */
body[data-style="ember"] [data-hero] { min-height: 72svh !important; }
body[data-style="ember"] [data-hero] .absolute.bottom-0 {
  inset: 0 !important; bottom: 0 !important; padding-bottom: 0 !important;
  display: flex !important; flex-direction: column !important;
  align-items: center !important; justify-content: center !important;
  text-align: center !important;
}
body[data-style="ember"] [data-hero] .absolute.bottom-0 > .flex { justify-content: center !important; }
body[data-style="ember"] [data-hero] .absolute.bottom-0 .flex-wrap { justify-content: center !important; }
body[data-style="ember"] [data-hero] .absolute.inset-0:not(div:first-of-type) {
  background: radial-gradient(ellipse 70% 60% at 50% 100%, rgba(28,20,16,0.88), rgba(28,20,16,0.45) 60%, rgba(28,20,16,0.25)) !important;
}
body[data-style="ember"] section h2 { letter-spacing: -0.02em !important; }`,

  atlas: `body[data-style="atlas"] {
  --bg: #eef1f4;
  --fg: #0f1a24;
  --dark: #0e1b26;
  --brass: #1f6f9e;
  --brass-light: #4b9cc9;
  --muted: #55636e;
  --border: #c3ccd4;
  --card-bg: #e2e8ee;
  --overlay: rgba(14, 27, 38, 0.55);
  --font-display: 'Inter', 'Geologica', ui-sans-serif, system-ui, sans-serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
  background-color: var(--bg);
  color: var(--fg);
}
body[data-style="atlas"] img,
body[data-style="atlas"] [class*="rounded"] { border-radius: 10px !important; }
body[data-style="atlas"] button,
body[data-style="atlas"] a.inline-flex { border-radius: 6px !important; }`
};

export function presetCSS(id: PresetId): string {
  return `<style data-preset="${id}">${CSS[id]}</style>`;
}
