// V3.7.4 Phase 6 — duplicate/semantic content detection inside blocks.
//
// Adjacent-block dedupe is not enough: responsive/Tilda copies live INSIDE a
// single flattened block as repeated sentence sequences. These detectors find
// repeated sentences, repeated n-gram runs, summary duplication and glued
// headings — and record exactly which copies were removed.

export interface DuplicateFinding {
  kind:
    | 'repeated-sentence'
    | 'repeated-sequence'
    | 'summary-duplicated'
    | 'heading-duplicated'
    | 'glued-heading'
    | 'repeated-list-item';
  text: string;
  occurrences: number;
  detail?: string;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
// Split on raw newlines/sentence punctuation FIRST — norm() would collapse
// the \n boundaries that separate responsive copies of the same fact.
const sentSplit = (s: string) =>
  s.split(/\n+|(?<=[.!?…])\s+/).map((x) => norm(x)).filter((x) => x.length >= 8);

/** Sentences and contiguous sentence-runs repeated inside one block. */
export function detectIntrablockDuplicates(block: any): DuplicateFinding[] {
  const findings: DuplicateFinding[] = [];
  const texts: string[] = [];
  if (typeof block?.content === 'string') texts.push(block.content);
  if (typeof block?.description === 'string') texts.push(block.description);
  for (const it of block?.items || []) texts.push(typeof it === 'string' ? it : it?.title || it?.content || '');

  for (const text of texts) {
    const sentences = sentSplit(text);
    const seen = new Map<string, number[]>();
    sentences.forEach((s, i) => {
      const k = s.toLowerCase();
      seen.set(k, [...(seen.get(k) || []), i]);
    });
    for (const [s, idx] of seen) {
      // Structural labels ("Комплектация:" before each list) repeat legally;
      // only real content sentences (≥20 chars) or ≥3 occurrences count.
      if (idx.length > 1 && (s.length >= 20 || idx.length >= 3)) {
        findings.push({ kind: 'repeated-sentence', text: s.slice(0, 120), occurrences: idx.length, detail: `positions ${idx.join(',')}` });
      }
    }
    // repeated contiguous runs (e.g. the same 3-sentence fact group 5×)
    for (let runLen = 3; runLen >= 2; runLen--) {
      const runs = new Map<string, number>();
      for (let i = 0; i + runLen <= sentences.length; i++) {
        const key = sentences.slice(i, i + runLen).join(' ').toLowerCase();
        runs.set(key, (runs.get(key) || 0) + 1);
      }
      for (const [run, count] of runs) {
        if (count > 1) {
          findings.push({ kind: 'repeated-sequence', text: run.slice(0, 120), occurrences: count, detail: `${runLen}-sentence run ×${count}` });
          break; // report the longest repeated run only
        }
      }
      if (findings.some((f) => f.kind === 'repeated-sequence')) break;
    }
  }

  // repeated list items inside the same block
  const itemSeen = new Map<string, number>();
  for (const it of block?.items || []) {
    const t = norm(typeof it === 'string' ? it : it?.title || it?.content || '').toLowerCase();
    if (t) itemSeen.set(t, (itemSeen.get(t) || 0) + 1);
  }
  for (const [t, n] of itemSeen) {
    if (n > 1) findings.push({ kind: 'repeated-list-item', text: t.slice(0, 120), occurrences: n });
  }

  // glued heading: lowercase run ending mid-word then capitalised fragment.
  // Tokens with ≥2 internal capitals are intentional compounds/dimensions.
  for (const t of texts) {
    const re = /[а-яёa-z][А-ЯЁA-Z][а-яёa-z]/g;
    const real: string[] = [];
    let mm: RegExpExecArray | null;
    while ((mm = re.exec(t))) {
      // Pure-Latin matches are camelCase brands/jargon ("WhatsApp") — the
      // Cyrillic-only repairer can never fix them, so flagging is a false
      // positive that permanently blocks the gate.
      let a = mm.index, b = mm.index + mm[0].length;
      while (a > 0 && /\S/.test(t[a - 1])) a--;
      while (b < t.length && /\S/.test(t[b])) b++;
      if (!/[а-яёА-ЯЁ]/.test(t.slice(a, b))) continue;
      if (!isCompoundToken(t, mm.index, mm[0].length)) real.push(mm[0]);
    }
    if (real.length >= 2) {
      findings.push({ kind: 'glued-heading', text: real.slice(0, 4).join(' '), occurrences: real.length, detail: 'lowercase→Uppercase→lowercase glue' });
    }
  }
  return findings;
}

/** The entity summary is rendered separately; a first block repeating it
 *  produces the observed "summary shown twice" defect. */
export function detectSummaryDuplication(summary: string | null | undefined, blocks: any[]): DuplicateFinding[] {
  if (!summary || !blocks?.length) return [];
  const s = norm(summary).toLowerCase();
  if (s.length < 12) return [];
  const first = blocks[0];
  const body = norm([first?.content, first?.heading, ...(first?.items || []).map((i: any) => (typeof i === 'string' ? i : i?.title))].filter(Boolean).join(' ')).toLowerCase();
  if (body.length >= 12 && (body.includes(s) || s.includes(body))) {
    return [{ kind: 'summary-duplicated', text: summary.slice(0, 120), occurrences: 2, detail: 'summary text repeated by first content block' }];
  }
  return [];
}

/** Whole-entity check: in-block duplication + summary/first-block. */
export function auditEntityDuplicates(entity: { summary?: string; shortDescription?: string; blocks?: any[] }): DuplicateFinding[] {
  const findings: DuplicateFinding[] = [];
  for (const b of entity?.blocks || []) findings.push(...detectIntrablockDuplicates(b));
  findings.push(...detectSummaryDuplication(entity.summary || entity.shortDescription, entity?.blocks || []));
  return findings;
}

// ─── Repair (V3.7.4 Phase 6/9) ──────────────────────────────────────────────
// Deterministic normalizer: removes repeated lines/sequences inside a block,
// re-joins hyphen-broken heading fragments, and drops a first block that
// verbatim duplicates the entity summary. Every removal is recorded so the
// provenance trail shows which responsive copies were removed.

export interface RepairRecord {
  blockId?: string;
  kind: 'deduped-lines' | 'deduped-items' | 'deduped-sentences' | 'joined-fragments' | 'dropped-duplicate-summary' | 'unglued' | 'rebuilt-summary' | 'stripped-divider';
  detail: string;
  removed?: string[];
}

const isAllCapsFragment = (s: string) => {
  const letters = s.replace(/[^А-ЯЁA-Z]/g, '');
  return letters.length >= 3 && letters.length / s.replace(/\s/g, '').length > 0.6 && s === s.toUpperCase();
};

/** Re-join lines that are fragments of one heading/phrase:
 *  - "Дизайн-\nконцепция" → "Дизайн-концепция"  (hyphen break + lowercase)
 *  - "ДИЗАЙН-КОНЦЕПЦИЯ:\nСОЗДАНИЕ…\nСТИЛЯ" → one heading (colon chain)
 *  - "План\nрасстановки оборудования" → wrapped prose rejoin (no terminal
 *    punctuation + lowercase continuation)
 *  Distinct standalone ALL-CAPS headings are NOT merged — no colon chain.
 */
export function joinFragmentedLines(content: string): { text: string; joined: string[] } {
  const lines = content.split('\n');
  const out: string[] = [];
  const joined: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i];
    const t = cur.replace(/\s+$/, '');
    // 0. orphan colon continuation — "3D-ВИЗУАЛИЗАЦИЯ\n: ФОТОРЕАЛИСТИЧНЫЕ…"
    if (/^\s*:/.test(cur) && out.length) {
      out[out.length - 1] = `${out[out.length - 1]}${cur}`;
      joined.push(`<prev> + ${cur.trim()}`);
      i++; continue;
    }
    const next = lines[i + 1];
    const n = next?.trim();
    if (n) {
      // 1. hyphen break followed by lowercase continuation
      if (/-\s*$/.test(t) && /^[а-яёa-z]/.test(n)) {
        const merged = t.replace(/\s*-\s*$/, '-') + n;
        out.push(merged); joined.push(`${t} + ${n}`);
        i += 2; continue;
      }
      // 2. ALL-CAPS heading fragment ending with ':' — colon chain keeps
      //    merging subsequent ALL-CAPS lines (they're one logical heading).
      if (isAllCapsFragment(t) && /:\s*$/.test(t) && isAllCapsFragment(n)) {
        let merged = t;
        let j = i + 1;
        while (j < lines.length && isAllCapsFragment(lines[j].trim())) {
          merged += ' ' + lines[j].trim();
          j++;
        }
        out.push(merged.replace(/\s{2,}/g, ' ')); joined.push(lines.slice(i, j).map((x) => x.trim()).join(' + '));
        i = j; continue;
      }
      // 3. wrapped fragment: a single token or a dangling preposition/
      //    conjunction followed by lowercase continuation. Distinct short
      //    lines (list items, separate facts) never merge — the current line
      //    must be an obvious fragment.
      const singleToken = /^\S{1,15}$/.test(t);
      const danglingPrep = /\b(в|на|и|для|от|до|по|с|у|о|об|из|к|за|под|над|при|без|или|а|но|что|как|the|of|and|for|to|in|on|with)\s*$/i.test(t);
      if (t && (singleToken || danglingPrep) && !/[.!?…:;,)\]]\s*$/.test(t) && /^[а-яёa-z]/.test(n)) {
        out.push(`${t} ${n}`); joined.push(`${t} + ${n}`);
        i += 2; continue;
      }
    }
    out.push(cur); i++;
  }
  return { text: out.join('\n'), joined };
}

/** A line of pure divider punctuation (`______`, `—————`, `=====`, `* * *`)
 *  is a serialized <hr>/decorative artifact — never content, and an
 *  unbreakable ultra-wide token that overflows narrow viewports. */
export const isDividerLine = (l: string): boolean => /^[ _\-–—=~*•·.]{4,}$/.test(l.trim());

/** Remove duplicate lines/sequences inside one content string, keeping first
 *  occurrence order. Handles the 5× responsive-copy pattern. */
export function dedupeLines(content: string): { text: string; removed: string[] } {
  const lines = content.split('\n').map((l) => l.trim());
  const seen = new Set<string>();
  const removed: string[] = [];
  const keep: string[] = [];
  for (const l of lines) {
    const k = l.toLowerCase();
    if (l.length >= 8 && seen.has(k)) { removed.push(l); continue; }
    if (l.length >= 8) seen.add(k);
    keep.push(l);
  }
  // Collapse 3+ blank lines
  return { text: keep.join('\n').replace(/\n{3,}/g, '\n\n').trim(), removed };
}

/** Remove verbatim repeated sentences inside a single content line, keeping
 *  first occurrence order. Source pages sometimes repeat a whole paragraph
 *  inside one element — line-level dedupe cannot see it. Mirrors the audit
 *  threshold: a repeat only counts when the sentence is ≥20 chars or it
 *  occurs ≥3 times. */
export function dedupeSentences(content: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  const lines = content.split('\n');
  const lineSents = lines.map((l) => sentSplit(l));
  const counts = new Map<string, number>();
  for (const ss of lineSents) {
    for (const s of ss) {
      const k = s.toLowerCase();
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  // Flat stream — runs may span line boundaries (audit splits the whole field).
  const flat: string[] = [];
  lineSents.forEach((ss) => ss.forEach((s) => flat.push(s.toLowerCase())));
  const dropIdx = new Set<number>();
  for (const runLen of [3, 2]) {
    const runsSeen = new Map<string, number[]>();
    for (let i = 0; i + runLen <= flat.length; i++) {
      const key = flat.slice(i, i + runLen).join('|');
      const arr = runsSeen.get(key) ?? [];
      arr.push(i);
      runsSeen.set(key, arr);
    }
    for (const starts of runsSeen.values()) {
      if (starts.length > 1) for (const st of starts.slice(1)) for (let j = 0; j < runLen; j++) dropIdx.add(st + j);
    }
  }
  const seen = new Set<string>();
  let gi = 0;
  const out = lineSents.map((sentences, li) => {
    if (!sentences.length) return lines[li];
    const keep: string[] = [];
    for (const s of sentences) {
      const idx = gi++;
      const k = s.toLowerCase();
      const total = counts.get(k) || 0;
      if (dropIdx.has(idx) || (seen.has(k) && (s.length >= 20 || total >= 3))) { removed.push(s); continue; }
      seen.add(k);
      keep.push(s);
    }
    return keep.join(' ');
  });
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), removed };
}

export function dedupeItems(items: any[]): { items: any[]; removed: any[] } {
  const seen = new Set<string>();
  const removed: any[] = [];
  const keep: any[] = [];
  for (const it of items || []) {
    const k = norm(typeof it === 'string' ? it : it?.title || it?.question || it?.content || JSON.stringify(it)).toLowerCase();
    if (k && seen.has(k)) { removed.push(it); continue; }
    if (k) seen.add(k);
    keep.push(it);
  }
  return { items: keep, removed };
}

/** Unglue flattened-DOM joins:
 *  - "словоПродолжение" → "слово Продолжение" (lost sentence break)
 *  - "…прилавок)Осуществлена" → "…прилавок). Осуществлена"
 *  A single lowercase char after the capital is enough ("холодомПеренесено").
 */
/** A token with ≥2 internal capitals is an intentional compound name or
 *  abbreviation ("СанЭпидемСтанции", "ВхШхГ" dimension notation), not a
 *  flattened-DOM join — glue repairs must leave it untouched. */
function isCompoundToken(s: string, matchStart: number, matchLen: number): boolean {
  let a = matchStart, b = matchStart + matchLen;
  while (a > 0 && /\S/.test(s[a - 1])) a--;
  while (b < s.length && /\S/.test(s[b])) b++;
  const word = s.slice(a, b);
  const caps = word.slice(1).replace(/[^А-ЯЁA-Z]/g, '');
  return caps.length >= 2;
}

export function unglueText(s: string, opts: { sentenceBreaks?: boolean } = {}): { text: string; fixed: string[] } {
  const fixed: string[] = [];
  const sep = opts.sentenceBreaks ? '. ' : ' ';
  // Cyrillic-only boundaries: a Latin lower→Upper rule would corrupt
  // legitimate camelCase brands ("YouTube", "iPhone").
  const text = s
    .replace(/([а-яё])([А-ЯЁ][а-яё]+)/g, (m, a, b, off) => {
      if (isCompoundToken(s, off, m.length)) return m;
      fixed.push(m); return `${a}${sep}${b}`;
    })
    .replace(/([)»”])([А-ЯЁ][а-яё]+)/g, (m, a, b) => { fixed.push(m); return `${a}${sep}${b}`; })
    // Lost space after a sentence-end punctuation: "оборудования.План" →
    // "оборудования. План". Cyrillic capital+lowercase avoids decimals,
    // abbreviations (т.д.) and Latin compounds; initials (С.Пушкин →
    // С. Пушкин) are still correct output.
    .replace(/([.!?…])([А-ЯЁ][а-яё]+)/g, (m, a, b) => { fixed.push(m); return `${a} ${b}`; });
  return { text, fixed };
}

/** Remove a normalized substring from raw text at any position: builds the
 *  normalized form with a per-char index map back into the raw string, finds
 *  the needle, and excises its raw span. Covers prefix, mid-content and
 *  trailing duplication. Returns null when the needle is absent. */
function removeNormSubstring(raw: string, normSub: string): string | null {
  const needle = normSub.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!needle) return null;
  const map: number[] = [];
  let normStr = '';
  let pendingSpace = false;
  for (let i = 0; i < raw.length; i++) {
    if (/\s/.test(raw[i])) { if (normStr.length) pendingSpace = true; continue; }
    if (pendingSpace) { normStr += ' '; map.push(i); pendingSpace = false; }
    normStr += raw[i].toLowerCase();
    map.push(i);
  }
  const idx = normStr.indexOf(needle);
  if (idx === -1) return null;
  const rawStart = map[idx];
  const rawEnd = map[idx + needle.length - 1] + 1;
  return (raw.slice(0, rawStart) + '\n' + raw.slice(rawEnd)).replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Normalize one entity's blocks + title. Returns the repaired entity payload
 * and the provenance log of every removed/repaired copy.
 */
export function normalizeEntityContent(entity: { title?: string; summary?: string; shortDescription?: string; excerpt?: string; metaDescription?: string; blocks?: any[] }): { entity: any; repairs: RepairRecord[] } {
  const repairs: RepairRecord[] = [];
  const out: any = { ...entity };

  // Title unglue ("Дизайн-проектпродуктового" → "Дизайн-проект продуктового")
  if (typeof out.title === 'string') {
    const u = unglueText(out.title);
    if (u.fixed.length) { repairs.push({ kind: 'unglued', detail: `title: "${out.title}" → "${u.text}"`, removed: u.fixed }); out.title = u.text; }
  }

  // A summary that is a bare list fragment ("· разрешения…") is an extraction
  // artifact — it can never be a good lead-in and will always flag as a
  // mid-list duplication. Rebuild it from the first real sentence.
  let summary = norm(out.summary || out.shortDescription || out.excerpt || '');
  if (/^[·•\-—*]\s*\S/.test(summary)) {
    // Prefer the source page's metaDescription — a content-derived summary
    // will always duplicate the block it came from.
    const meta = norm(entity.metaDescription || '');
    const firstText = (entity.blocks || []).map((b: any) => b?.content).find((c: any) => typeof c === 'string' && c.trim().length > 40);
    const candidate = meta.length >= 20 ? meta : firstText && sentSplit(firstText).find((s) => s.length >= 40);
    if (candidate) {
      const rebuilt = candidate.slice(0, 220);
      repairs.push({ kind: 'rebuilt-summary', detail: `fragment summary "${summary.slice(0, 60)}" → "${rebuilt.slice(0, 60)}"`, removed: [summary] });
      for (const f of ['excerpt', 'shortDescription', 'summary']) {
        if (out[f] !== undefined) out[f] = rebuilt;
      }
      summary = rebuilt;
    }
  }
  summary = summary.toLowerCase();
  const blocks: any[] = [];
  let summaryDedupeDone = false;
  for (const raw of entity.blocks || []) {
    const b: any = { ...raw };
    // The first SURVIVING block must not repeat the entity summary — it
    // renders twice. Summary is often a glued concat of the page's first
    // sections, so the duplication can be a verbatim block, a prefix, or a
    // mid-content substring. If an earlier block is dropped as a pure echo,
    // the check carries to the next block.
    if (!summaryDedupeDone && summary.length >= 12 && (typeof b.content === 'string' || typeof b.heading === 'string' || b.items?.length)) {
      const bc = norm(b.content || '').toLowerCase();
      const bcRaw = String(b.content || '');
      if (!b.heading && !b.items?.length && bc && (bc === summary || summary.includes(bc) || bc.includes(summary))) {
        repairs.push({ blockId: b.id, kind: 'dropped-duplicate-summary', detail: 'first block verbatim duplicates entity summary', removed: [b.content] });
        continue;
      }
      // Heading that verbatim repeats the summary — renders twice.
      if (b.heading && norm(b.heading).toLowerCase() === summary) {
        repairs.push({ blockId: b.id, kind: 'deduped-lines', detail: 'first block heading duplicates entity summary', removed: [b.heading] });
        delete b.heading;
      }
      if (bc && summary.includes(bc)) {
        // Whole block content lives inside the summary (mid-substring echo).
        repairs.push({ blockId: b.id, kind: 'deduped-lines', detail: 'first block content fully duplicated by summary', removed: [bcRaw] });
        delete b.content;
      } else if (bc && bc.includes(summary)) {
        const stripped = removeNormSubstring(bcRaw, summary);
        if (stripped !== null && (stripped.length >= 12 || b.heading || b.items?.length)) {
          repairs.push({ blockId: b.id, kind: 'deduped-lines', detail: 'duplicated summary span stripped from first block', removed: [bcRaw.slice(0, bcRaw.length - stripped.length)] });
          b.content = stripped;
          if (!b.content) delete b.content;
        }
      }
      if (!b.content && !b.heading && !b.items?.length && b.type === 'richText') {
        repairs.push({ blockId: b.id, kind: 'dropped-duplicate-summary', detail: 'first block empty after summary dedupe', removed: [] });
        continue;
      }
      summaryDedupeDone = true;
    }
    for (const field of ['heading', 'description']) {
      if (typeof b[field] === 'string' && b[field]) {
        if (isDividerLine(b[field])) {
          repairs.push({ blockId: b.id, kind: 'stripped-divider', detail: `${field} is a decorative divider line`, removed: [b[field].trim().slice(0, 40)] });
          delete b[field];
          continue;
        }
        const u = unglueText(b[field]);
        if (u.fixed.length) { repairs.push({ blockId: b.id, kind: 'unglued', detail: `${field}: ${u.fixed.length} glued fragments`, removed: u.fixed.slice(0, 10) }); b[field] = u.text; }
        const s = dedupeSentences(b[field]);
        if (s.removed.length) { repairs.push({ blockId: b.id, kind: 'deduped-sentences', detail: `${field}: ${s.removed.length} repeated sentences removed`, removed: s.removed.slice(0, 20) }); b[field] = s.text; }
      }
    }
    if (typeof b.content === 'string' && b.content) {
      // 0. drop decorative divider lines (serialized <hr> artifacts)
      const divLines: string[] = b.content.split('\n');
      if (divLines.some(isDividerLine)) {
        const dropped = divLines.filter(isDividerLine);
        b.content = divLines.filter((l: string) => !isDividerLine(l)).join('\n');
        repairs.push({ blockId: b.id, kind: 'stripped-divider', detail: `${dropped.length} decorative divider line(s) removed`, removed: dropped.map((l: string) => l.trim().slice(0, 40)) });
      }
      // 1. unglue (sentence breaks in prose), 2. join fragments, 3. dedupe lines, 4. dedupe repeated sentences
      const u = unglueText(b.content, { sentenceBreaks: true });
      if (u.fixed.length >= 2) repairs.push({ blockId: b.id, kind: 'unglued', detail: `${u.fixed.length} glued fragments`, removed: u.fixed.slice(0, 10) });
      const j = joinFragmentedLines(u.text);
      if (j.joined.length) repairs.push({ blockId: b.id, kind: 'joined-fragments', detail: `${j.joined.length} fragment joins`, removed: j.joined.slice(0, 20) });
      const d = dedupeLines(j.text);
      if (d.removed.length) repairs.push({ blockId: b.id, kind: 'deduped-lines', detail: `${d.removed.length} duplicate lines removed`, removed: d.removed.slice(0, 20) });
      const s = dedupeSentences(d.text);
      if (s.removed.length) repairs.push({ blockId: b.id, kind: 'deduped-sentences', detail: `${s.removed.length} repeated sentences removed`, removed: s.removed.slice(0, 20) });
      b.content = s.text;
    }
    if (Array.isArray(b.items)) {
      b.items = b.items.map((it: any) => {
        if (typeof it === 'string') { const u = unglueText(it); if (u.fixed.length) { repairs.push({ blockId: b.id, kind: 'unglued', detail: `item: ${u.fixed.length} glued fragments`, removed: u.fixed.slice(0, 10) }); return u.text; } return it; }
        if (it && typeof it.title === 'string') { const u = unglueText(it.title); if (u.fixed.length) { repairs.push({ blockId: b.id, kind: 'unglued', detail: `item title: ${u.fixed.length} glued fragments`, removed: u.fixed.slice(0, 10) }); return { ...it, title: u.text }; } }
        return it;
      }).filter((it: any) => {
        const t = typeof it === 'string' ? it : it?.title || it?.content || '';
        if (t && isDividerLine(t)) { repairs.push({ blockId: b.id, kind: 'stripped-divider', detail: 'divider item removed', removed: [t.trim().slice(0, 40)] }); return false; }
        return true;
      });
      const d = dedupeItems(b.items);
      if (d.removed.length) repairs.push({ blockId: b.id, kind: 'deduped-items', detail: `${d.removed.length} duplicate items removed`, removed: d.removed.map((x: any) => String(x?.title || x).slice(0, 60)) });
      b.items = d.items;
    }
    blocks.push(b);
  }
  out.blocks = blocks;
  return { entity: out, repairs };
}
