import type { SiteContentPlanV2 } from './siteContentPlanV2.js';

const li = (items: string[]) => items.length ? items.map((x) => `- ${x}`).join('\n') : '- (none)';
const ent = (e: { title: string; sourceUrls: string[]; onHomepage: boolean; primaryImage?: string; summary?: string }) =>
  `- **${e.title}** — ${e.sourceUrls.join(', ') || '—'} — home:${e.onHomepage ? 'yes' : 'no'}${e.primaryImage ? ` — img:${e.primaryImage.slice(0, 60)}` : ''}${e.summary ? `\n  > ${e.summary.slice(0, 120)}` : ''}`;

export function buildPlanReportV2(plan: SiteContentPlanV2): string {
  const o: string[] = [`# SiteContentPlan V2 — ${plan.siteKey}`, '',
    `Base: ${plan.baseUrl} | lang: ${plan.language} | generated: ${plan.generatedAt}`,
    `planHash: \`${plan.planHash}\` | sourceGraphHash: \`${plan.sourceGraphHash}\``,
    `Readiness: **${plan.readiness}**${plan.readinessReasons.length ? ` — ${plan.readinessReasons.join('; ')}` : ''}`,
    '', '## Identity',
    `- name: ${plan.siteIdentity.displayName || 'UNKNOWN'}`,
    `- legal: ${plan.siteIdentity.legalName || '—'} | industry: ${plan.siteIdentity.industry || '—'} | unp: ${plan.siteIdentity.unp || '—'}`,
    `- phones: ${plan.contacts.phones.map((x) => x.value).join(', ') || 'none'}`,
    `- emails: ${plan.contacts.emails.map((x) => x.value).join(', ') || 'none'}`,
    `- addresses: ${plan.contacts.addresses.map((x) => x.value).join(', ') || 'none'}`,
    '', '## Planned navigation (internal)', li(plan.plannedNavigation.map((n) => `${n.label} → ${n.route}`)),
    '', '## Planned pages', li(plan.plannedPages.map((p) => `${p.route} [${p.kind}] ${p.title}`)),
    '', '## Source homepage sections', li(plan.homepage.sourceSections.map((s) => `${s.type} — ${s.heading || '—'} — ${s.itemCount} items`)),
    '', '## Planned homepage sections', li(plan.homepage.plannedSections.map((s) => `${s.type} — "${s.heading}" — ${s.entityIds.length} entities — ${s.rationale}`)),
  ];
  for (const t of ['service', 'project', 'product', 'article', 'news', 'vacancy'] as const) {
    const list = plan.entities.filter((e) => e.type === t);
    o.push('', `## ${t.toUpperCase()} (${list.length})`, list.length ? list.map(ent).join('\n') : `(none)`);
  }
  o.push('', `## Dynamic sections (${plan.dynamicSections.length})`,
    li(plan.dynamicSections.map((d) => `${d.kind} — ${d.heading || d.id} — ${d.items.length} items — on ${d.sourcePages.length} page(s)${d.ignoredReason ? ` — IGNORED: ${d.ignoredReason}` : ''}${d.items.length ? ` — e.g. ${d.items.slice(0, 3).map((i) => i.title || i.text).filter(Boolean).join('; ')}` : ''}`)),
    '', '## Media', `- logo: ${plan.media.logo || '—'}`, `- hero: ${plan.media.hero || '—'}`, `- images: ${plan.media.images.length}`,
    '', '## Omitted content', li(plan.omittedContent.map((x) => `${x.what} — ${x.reason}`)),
    '', '## Warnings', li(plan.warnings));
  return o.join('\n') + '\n';
}
