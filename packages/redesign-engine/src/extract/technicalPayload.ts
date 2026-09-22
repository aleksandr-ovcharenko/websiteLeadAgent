// Deterministic technical-payload detection.
//
// Builder markup leaks machine-readable fragments into what looks like text:
// Tilda form field-config JSON in hidden <textarea>s, dataLayer pushes,
// serialized widget settings, input masks, placeholder contact examples.
// None of it is customer copy — but legitimate prose may contain braces,
// numbers or code-like tokens, so detection requires strong structural
// evidence, never vocabulary alone.

export interface TechnicalPayloadVerdict {
  technical: boolean;
  /** Detector rule id — recorded in diagnostics for every drop. */
  rule?: string;
  confidence: number;
}

const NOT_TECHNICAL: TechnicalPayloadVerdict = { technical: false, confidence: 0 };

/** Whole text is a JSON object/array — serialized widget/form state. */
function isJsonPayload(t: string): boolean {
  if (!/^[\[{][\s\S]*[\]}]$/.test(t) || t.length < 8) return false;
  try { JSON.parse(t); return true; } catch { return false; }
}

/** ≥3 `"key":` pairs inside a bracketed body — unparseable JSON fragments
 *  (truncated configs) still count. */
function isConfigKvDensity(t: string): boolean {
  if (!/^[\[{<]/.test(t)) return false;
  const kv = (t.match(/"[\w.-]+"\s*:/g) || []).length
    + (t.match(/&quot;[\w.-]+&quot;\s*:/g) || []).length;
  return kv >= 3;
}

/** Known form-builder/widget configuration vocabularies. These key names are
 *  machine contracts (Tilda li_*, dataLayer, gtag), not customer prose. */
const CONFIG_KEY_RE = /\b(li_type|li_ph|li_mask|li_nm|li_req|li_parent_id|lid|formservices|dataLayer|gtag|ym\s*\(|_tmr|fbq\s*\(|tildaspec|recid|tn-atom__inputs|data-field-type|data-input-lid)\b/i;

/** Placeholder contact examples emitted by builders/masks. */
const PLACEHOLDER_CONTACT_RE = /(mail@example\.(com|ru|net)|\+375\s*\(99\)\s*999-99-99|\+7\s*\(9\d\d\)\s*9\d\d-\d\d-\d\d|example\.(com|org|net)\/)/i;

/** CSS/JS fragments: rule bodies or JS calls pasted as text. */
const CODE_FRAGMENT_RE = /([.#][\w-]+\s*\{[^}]*:)|(\bfunction\s*\(|\bvar\s+\w+\s*=|\.push\s*\(\s*\{|\}\)\s*;\s*$)/;

export function detectTechnicalPayload(text: string): TechnicalPayloadVerdict {
  const t = (text || '').trim();
  if (t.length < 6) return NOT_TECHNICAL;

  if (isJsonPayload(t)) return { technical: true, rule: 'json-payload', confidence: 0.97 };
  if (isConfigKvDensity(t)) return { technical: true, rule: 'config-kv-density', confidence: 0.9 };
  if (CONFIG_KEY_RE.test(t)) return { technical: true, rule: 'config-key-vocabulary', confidence: 0.9 };
  if (PLACEHOLDER_CONTACT_RE.test(t)) return { technical: true, rule: 'placeholder-contact', confidence: 0.75 };
  if (CODE_FRAGMENT_RE.test(t) && /[{};]/.test(t) && (t.match(/[{}();]/g) || []).length >= 4) {
    return { technical: true, rule: 'code-fragment', confidence: 0.8 };
  }
  return NOT_TECHNICAL;
}

export interface TechnicalPayloadDrop {
  rule: string;
  confidence: number;
  /** Normalized sample (bounded) for the diagnostics report. */
  sample: string;
  domPath?: string;
  context?: string;
}

/** Convenience: drop a text if it is a technical payload, recording evidence. */
export function dropIfTechnical(
  text: string,
  drops: TechnicalPayloadDrop[] | undefined,
  ctx: { domPath?: string; context?: string } = {},
): boolean {
  const v = detectTechnicalPayload(text);
  if (!v.technical) return false;
  drops?.push({ rule: v.rule!, confidence: v.confidence, sample: text.trim().slice(0, 160), ...ctx });
  return true;
}
