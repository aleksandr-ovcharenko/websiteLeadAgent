import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SourceDocument } from '../types.js';
import type { SourceContentGraph, SemanticPage, ImageCandidate } from './schema.js';
import { sourceContentGraphSchema } from './schema.js';
import type { GenerationSemanticProvider } from './provider.js';
import { createSemanticProvider } from './provider.js';

export interface BuildGraphOptions {
  baseUrl: string;
  provider?: GenerationSemanticProvider;
  sourceDocuments: SourceDocument[];
  runId?: string;
}

export async function buildSourceContentGraph({
  sourceDocuments,
  baseUrl,
  provider,
}: BuildGraphOptions): Promise<SourceContentGraph> {
  const p = provider || createSemanticProvider();
  const pageClassifications = new Map<string, SemanticPage['classification']>();
  const sectionClassifications = new Map<string, SemanticPage['sections']>();
  const collectionClassifications = new Map<string, SemanticPage['collections']>();
  const mediaCandidates: ImageCandidate[] = [];
  const warnings: string[] = [];

  // Classify pages
  for (const doc of sourceDocuments) {
    const classification = await p.classifyPage({ sourceDocument: doc, allDocuments: sourceDocuments, baseUrl });
    pageClassifications.set(doc.id, classification);
  }

  // Second pass — index backlink via computed classifications. A page still
  // OTHER that a *_INDEX page links to (collection item or body link) is a
  // detail page of that index's type. This is vocabulary-free: it catches
  // catalog landings whose wording no regex anticipated.
  const detailOfIndex: Record<string, string> = {
    SERVICES_INDEX: 'SERVICE_DETAIL',
    PROJECTS_INDEX: 'PROJECT_DETAIL',
    NEWS_INDEX: 'NEWS_DETAIL',
    VACANCIES_INDEX: 'VACANCY_DETAIL',
    PRODUCTS_INDEX: 'PRODUCT_DETAIL',
    REVIEWS_INDEX: 'REVIEW_DETAIL',
  };
  // Pagination continuations (…/page/N/) inherit the parent listing's type —
  // they are the same index page, chunked, not independent content.
  for (const doc of sourceDocuments) {
    const pc = pageClassifications.get(doc.id)!;
    if (pc.type !== 'OTHER') continue;
    try {
      const m = new URL(doc.url).pathname.replace(/\/+$/, '').match(/^(.*)\/page\/\d+$/);
      if (!m) continue;
      const parent = sourceDocuments.find((d) => {
        try { return new URL(d.url).pathname.replace(/\/+$/, '') === m[1]; } catch { return false; }
      });
      const parentType = parent ? pageClassifications.get(parent.id)?.type : undefined;
      if (!parentType || parentType === 'OTHER') continue;
      pageClassifications.set(doc.id, {
        ...pc,
        type: parentType,
        confidence: 0.6,
        evidence: [...pc.evidence, { type: 'pagination-continuation', value: parent!.url, confidence: 0.6, sourceDocumentId: doc.id }],
      });
    } catch { /* malformed url — leave OTHER */ }
  }

  const samePath = (a?: string, b?: string): boolean => {
    if (!a || !b) return false;
    try {
      const pa = new URL(a).pathname.replace(/\/+$/, '');
      const pb = new URL(b).pathname.replace(/\/+$/, '');
      return pa === pb;
    } catch { return a === b; }
  };
  // A collection whose item set repeats on many pages is site chrome (nav
  // mega-menu, footer link block), not page content — its "items" must not
  // feed backlinks. Same for links whose text is a nav label.
  const colSig = (c: { items: { url?: string; title?: string }[] }) =>
    c.items.map((i) => i.url || i.title || '').join('|');
  const colFreq = new Map<string, number>();
  for (const d of sourceDocuments) {
    for (const c of d.collections || []) {
      const sig = colSig(c);
      if (sig) colFreq.set(sig, (colFreq.get(sig) || 0) + 1);
    }
  }
  const isChromeCollection = (c: { items: { url?: string; title?: string }[] }) =>
    (colFreq.get(colSig(c)) || 0) >= 3;
  const navLabelsOf = (d: (typeof sourceDocuments)[number]): Set<string> => {
    const out = new Set<string>();
    const walk = (nodes?: { label?: string; children?: any[] }[]) => {
      for (const n of nodes || []) {
        if (n.label) out.add(n.label.trim().toLowerCase());
        walk(n.children);
      }
    };
    walk(d.chrome?.nav?.primary);
    walk(d.chrome?.nav?.secondary);
    return out;
  };
  for (const doc of sourceDocuments) {
    const pc = pageClassifications.get(doc.id)!;
    if (pc.type !== 'OTHER') continue;
    for (const other of sourceDocuments) {
      if (other === doc) continue;
      const oc = pageClassifications.get(other.id)!;
      const detail = detailOfIndex[oc.type];
      if (!detail) continue;
      const navLabels = navLabelsOf(other);
      const linked =
        (other.collections || []).some((c) => !isChromeCollection(c) &&
          c.items.some((i) => i.url && !navLabels.has((i.title || '').trim().toLowerCase()) && samePath(i.url, doc.url))) ||
        (other.sections || []).some((s) => (s.links || []).some((l) =>
          l.href && !navLabels.has((l.text || '').trim().toLowerCase()) && samePath(l.href, doc.url)));
      if (!linked) continue;
      pageClassifications.set(doc.id, {
        ...pc,
        type: detail as SemanticPage['classification']['type'],
        confidence: 0.6,
        evidence: [...pc.evidence, { type: 'index-backlink', value: `${oc.type} via ${other.url}`, confidence: 0.6, sourceDocumentId: doc.id }],
      });
      break;
    }
  }

  // Classify collections and sections per page
  for (const doc of sourceDocuments) {
    const pageClass = pageClassifications.get(doc.id)!;
    const pageCollectionClassifications: SemanticPage['collections'] = [];
    const pageSectionClassifications: SemanticPage['sections'] = [];

    const collectionContexts = (doc.collections || []).map((col) => ({ collection: col, sourceDocument: doc, pageClassification: pageClass, baseUrl }));
    if (typeof p.classifyCollections === 'function') {
      const ccs = await p.classifyCollections(collectionContexts);
      pageCollectionClassifications.push(...ccs);
    } else {
      for (const ctx of collectionContexts) {
        const cc = await p.classifyCollection(ctx);
        pageCollectionClassifications.push(cc);
      }
    }

    for (const sec of doc.sections) {
      const sc = await p.classifySection({ section: sec, sourceDocument: doc, pageClassification: pageClass, collectionClassifications: pageCollectionClassifications });
      pageSectionClassifications.push(sc);
    }

    collectionClassifications.set(doc.id, pageCollectionClassifications);
    sectionClassifications.set(doc.id, pageSectionClassifications);

    // Media classification across sections and top-level images
    const imageContexts: { image: typeof doc.images[number]; section?: typeof doc.sections[number]; collection?: typeof doc.collections[number] }[] = [];
    for (const sec of doc.sections) {
      for (const img of sec.images) imageContexts.push({ image: img, section: sec });
    }
    for (const col of doc.collections || []) {
      for (const item of col.items) {
        if (item.image) imageContexts.push({ image: item.image, collection: col });
      }
    }
    for (const img of doc.images) imageContexts.push({ image: img });

    for (const { image, section, collection } of imageContexts) {
      const candidate = await p.classifyMedia({ image, sourceDocument: doc, section, collection, baseUrl });
      mediaCandidates.push(candidate);
    }
  }

  const mediaMap = new Map<string, ImageCandidate>();
  for (const img of mediaCandidates) {
    if (!mediaMap.has(img.src)) mediaMap.set(img.src, img);
  }
  const uniqueMedia = [...mediaMap.values()];

  const ctx = {
    sourceDocuments,
    pageClassifications,
    sectionClassifications,
    collectionClassifications,
    mediaCandidates: uniqueMedia,
    baseUrl,
  };

  const pages: SemanticPage[] = sourceDocuments.map((doc) => {
    const sections = sectionClassifications.get(doc.id) || [];
    const collections = collectionClassifications.get(doc.id) || [];
    const pageClass = pageClassifications.get(doc.id)!;

    const mainText = doc.mainText || '';
    const textCompleteness = Math.min(1, mainText.length / 200);
    const semanticEvidenceStrength = Math.min(1, (sections.length + collections.length + doc.structuredData.length) / 8);
    const contentDensity = Math.min(1, doc.sections.length / 10);

    return {
      sourceDocumentId: doc.id,
      classification: pageClass,
      sections,
      collections,
      insufficientReason: pageClass.type === 'OTHER' && sections.length === 0 ? 'no semantic sections' : undefined,
      quality: {
        textCompleteness,
        semanticEvidenceStrength,
        contentDensity,
      },
    };
  });

  const company = await p.extractCompany(ctx);
  const contacts = await p.extractContacts(ctx);
  const services = await p.extractServices(ctx);
  const projects = await p.extractProjects(ctx);
  const news = await p.extractNews(ctx);
  const vacancies = await p.extractVacancies(ctx);
  const products = await p.extractProducts(ctx);
  const facts = await p.extractFacts(ctx);
  const relationships = await p.extractRelationships(ctx);
  const rejectedFacts = p.drainFactRejections?.() ?? [];

  // Warnings for low confidence classifications
  for (const doc of sourceDocuments) {
    const pc = pageClassifications.get(doc.id)!;
    if (pc.confidence < 0.5) warnings.push(`Low page confidence (${pc.type}, ${(pc.confidence * 100).toFixed(0)}%) for ${doc.url}`);
    if (pc.type === 'OTHER' && doc.sections.length > 3) warnings.push(`Unclassified page with rich content: ${doc.url}`);
  }

  const rejectedCollections = Array.from(collectionClassifications.entries()).flatMap(([docId, ccs]) => {
    return ccs
      .filter((cc) => cc.type === 'ADVERTISEMENT' || cc.type === 'UTILITY' || cc.type === 'LANGUAGE_SWITCHER' || cc.type === 'THEME_WIDGET')
      .map((cc) => ({ collectionId: cc.collectionId, type: cc.type, confidence: cc.confidence, reason: cc.reason }));
  });

  const graph: SourceContentGraph = {
    version: '2.0.0-phase2a',
    generatedAt: new Date().toISOString(),
    provider: { name: p.name, model: p.model, promptVersion: p.promptVersion, temperature: p.temperature, confidenceThresholds: (p as any).confidenceThresholds || { high: 0.85, medium: 0.65, low: 0.4 } },
    sourceDocumentIds: sourceDocuments.map((d) => d.id),
    baseUrl,
    company,
    contacts,
    pages,
    services,
    projects,
    news,
    vacancies,
    products,
    facts,
    media: uniqueMedia,
    relationships,
    rejectedCollections,
    rejectedFacts,
    warnings,
  };

  const parsed = sourceContentGraphSchema.safeParse(graph);
  if (!parsed.success) {
    // Soft-fail: log and still return partial graph with validation warnings
    warnings.push(`Schema validation warnings: ${parsed.error.message.slice(0, 500)}`);
  }

  return graph;
}

export async function writeSourceContentGraph(graph: SourceContentGraph, filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(graph, null, 2), 'utf-8');
}

export async function loadSourceDocuments(filePath: string): Promise<SourceDocument[]> {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw) as SourceDocument[];
}
