import type { SourceContentGraph } from '../semantic/schema.js';
import type { SourceDocument } from '../types.js';
import type { SiteContentPlan } from './siteContentPlan.js';

const list = (items: string[]) => items.length ? items.map((x) => `  - ${x}`).join('\n') : '  - (none)\n';

function entityBlock(e: { title: string; sourceUrls: string[]; onHomepage: boolean; image?: string; note?: string }) {
  return `  - **${e.title}**\n    - source: ${e.sourceUrls.join(', ') || '—'}\n    - on homepage: ${e.onHomepage ? 'yes' : 'no'}${e.image ? `\n    - image: ${e.image}` : ''}${e.note ? `\n    - note: ${e.note}` : ''}`;
}

/** Human-review report: what WILL be used to generate the site. */
export function buildPlanReport(plan: SiteContentPlan, graph: SourceContentGraph, docs: SourceDocument[]): string {
  const p = plan;
  const out: string[] = [];
  out.push(`# SiteContentPlan review — ${p.siteKey}`);
  out.push(`\nBase URL: ${p.baseUrl}\nGenerated: ${p.generatedAt}\nPlan hash: \`${p.planHash}\``);

  out.push(`\n## Identity`);
  out.push(`- company: ${p.siteIdentity.displayName || 'UNKNOWN'}`);
  if (p.siteIdentity.legalName) out.push(`- legal name: ${p.siteIdentity.legalName}`);
  if (p.siteIdentity.industry) out.push(`- industry: ${p.siteIdentity.industry}`);
  if (p.siteIdentity.unp) out.push(`- UNP: ${p.siteIdentity.unp}`);
  out.push(`- phones: ${p.contacts.phones.map((x) => x.value).join(', ') || 'none'}`);
  out.push(`- emails: ${p.contacts.emails.map((x) => x.value).join(', ') || 'none'}`);
  out.push(`- addresses: ${p.contacts.addresses.map((x) => x.value).join(', ') || 'none'}`);
  out.push(`- social: ${p.contacts.socialLinks.map((x) => `${x.platform}:${x.url}`).join(', ') || 'none'}`);

  out.push(`\n## Crawl summary`);
  out.push(`- SourceDocuments: ${docs.length}`);
  out.push(`- homepage: ${docs.find((d) => d.isHomepage)?.url || 'NOT FOUND'}`);
  out.push(`- page types: ${p.pages.map((x) => x.type).join(', ')}`);

  out.push(`\n## Source homepage sections (discovered)`);
  out.push(list(p.homepage.sourceSections.map((s) => `${s.type} — ${s.heading || '(no heading)'} — ${s.itemCount} items`)));

  out.push(`\n## Planned homepage sections`);
  out.push(list(p.homepage.plannedSections.map((s) => `${s.type} — "${s.heading}" — ${s.entityIds.length} entities — ${s.origin} — ${s.rationale}`)));

  out.push(`\n## Services (${p.services.length})`);
  out.push(p.services.length ? p.services.map(entityBlock).join('\n') : '  (none)');
  out.push(`\n## Projects (${p.projects.length})`);
  out.push(p.projects.length ? p.projects.map(entityBlock).join('\n') : '  (none)');
  out.push(`\n## Products (${p.products.length})`);
  out.push(p.products.length ? p.products.map(entityBlock).join('\n') : '  (none)');
  out.push(`\n## News (${p.news.length})`);
  out.push(p.news.length ? p.news.map(entityBlock).join('\n') : '  NEWS: NONE FOUND');
  out.push(`\n## Vacancies (${p.vacancies.length})`);
  out.push(p.vacancies.length ? p.vacancies.map(entityBlock).join('\n') : '  (none)');

  out.push(`\n## Dynamic / other sections (${p.dynamicSections.length})`);
  out.push(list(p.dynamicSections.map((d) => `${d.kind} — ${d.heading || d.collectionId} on ${d.sourcePage} — ${d.itemCount} items${d.ignoredReason ? ` — IGNORED: ${d.ignoredReason}` : ''}${d.sampleItems.length ? ` — e.g. ${d.sampleItems.slice(0, 3).join('; ')}` : ''}`)));

  out.push(`\n## Corporate content`);
  out.push(list(p.pages.filter((x) => x.role === 'corporate' || x.role === 'contacts').map((x) => `${x.type} — ${x.title} — ${x.url}`)));

  out.push(`\n## Navigation (planned)`);
  out.push(list(p.navigation.map((n) => `${n.order + 1}. ${n.label} → ${n.url || '—'}`)));

  out.push(`\n## Media`);
  out.push(`- logo: ${p.media.logo || 'none'}`);
  out.push(`- hero: ${p.media.hero || 'none'}`);
  out.push(`- images: ${p.media.images.length}`);

  out.push(`\n## Omitted content`);
  out.push(list(p.omittedContent.map((o) => `${o.what} — ${o.reason}${o.sourceUrl ? ` (${o.sourceUrl})` : ''}`)));

  out.push(`\n## Warnings`);
  out.push(list(p.warnings));

  out.push(`\n## Generation readiness: ${p.readiness}`);
  return out.join('\n') + '\n';
}
