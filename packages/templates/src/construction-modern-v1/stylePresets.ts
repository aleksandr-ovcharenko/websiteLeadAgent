export const PRESET_IDS = ['manna', 'stykka', 'eindhoven', 'xai', 'yllw'] as const;

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
${heroOverrides('#000000', '#000000', 'rgba(202,199,180,0.35)', true, '2px')}`
};

export function presetCSS(id: PresetId): string {
  return `<style data-preset="${id}">${CSS[id]}</style>`;
}
