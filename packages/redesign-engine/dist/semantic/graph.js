import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { sourceContentGraphSchema } from './schema.js';
import { createSemanticProvider } from './provider.js';
export function buildSourceContentGraph({ sourceDocuments, baseUrl, provider, }) {
    const p = provider || createSemanticProvider();
    const pageClassifications = new Map();
    const sectionClassifications = new Map();
    const collectionClassifications = new Map();
    const mediaCandidates = [];
    const warnings = [];
    // Classify pages
    for (const doc of sourceDocuments) {
        const classification = p.classifyPage({ sourceDocument: doc, allDocuments: sourceDocuments, baseUrl });
        pageClassifications.set(doc.id, classification);
    }
    // Classify collections and sections per page
    for (const doc of sourceDocuments) {
        const pageClass = pageClassifications.get(doc.id);
        const pageCollectionClassifications = [];
        const pageSectionClassifications = [];
        for (const col of doc.collections || []) {
            const cc = p.classifyCollection({ collection: col, sourceDocument: doc, pageClassification: pageClass, baseUrl });
            pageCollectionClassifications.push(cc);
        }
        for (const sec of doc.sections) {
            const sc = p.classifySection({ section: sec, sourceDocument: doc, pageClassification: pageClass, collectionClassifications: pageCollectionClassifications });
            pageSectionClassifications.push(sc);
        }
        collectionClassifications.set(doc.id, pageCollectionClassifications);
        sectionClassifications.set(doc.id, pageSectionClassifications);
        // Media classification across sections and top-level images
        const imageContexts = [];
        for (const sec of doc.sections) {
            for (const img of sec.images)
                imageContexts.push({ image: img, section: sec });
        }
        for (const col of doc.collections || []) {
            for (const item of col.items) {
                if (item.image)
                    imageContexts.push({ image: item.image, collection: col });
            }
        }
        for (const img of doc.images)
            imageContexts.push({ image: img });
        for (const { image, section, collection } of imageContexts) {
            const candidate = p.classifyMedia({ image, sourceDocument: doc, section, collection, baseUrl });
            mediaCandidates.push(candidate);
        }
    }
    const mediaMap = new Map();
    for (const img of mediaCandidates) {
        if (!mediaMap.has(img.src))
            mediaMap.set(img.src, img);
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
    const pages = sourceDocuments.map((doc) => {
        const sections = sectionClassifications.get(doc.id) || [];
        const collections = collectionClassifications.get(doc.id) || [];
        const pageClass = pageClassifications.get(doc.id);
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
    const company = p.extractCompany(ctx);
    const contacts = p.extractContacts(ctx);
    const services = p.extractServices(ctx);
    const projects = p.extractProjects(ctx);
    const news = p.extractNews(ctx);
    const vacancies = p.extractVacancies(ctx);
    const products = p.extractProducts(ctx);
    const facts = p.extractFacts(ctx);
    const relationships = p.extractRelationships(ctx);
    // Warnings for low confidence classifications
    for (const doc of sourceDocuments) {
        const pc = pageClassifications.get(doc.id);
        if (pc.confidence < 0.5)
            warnings.push(`Low page confidence (${pc.type}, ${(pc.confidence * 100).toFixed(0)}%) for ${doc.url}`);
        if (pc.type === 'OTHER' && doc.sections.length > 3)
            warnings.push(`Unclassified page with rich content: ${doc.url}`);
    }
    const rejectedCollections = Array.from(collectionClassifications.entries()).flatMap(([docId, ccs]) => {
        return ccs
            .filter((cc) => cc.type === 'ADVERTISEMENT' || cc.type === 'UTILITY' || cc.type === 'LANGUAGE_SWITCHER' || cc.type === 'THEME_WIDGET')
            .map((cc) => ({ collectionId: cc.collectionId, type: cc.type, confidence: cc.confidence, reason: cc.reason }));
    });
    const graph = {
        version: '2.0.0-phase2a',
        generatedAt: new Date().toISOString(),
        provider: { name: p.name, model: p.model, promptVersion: p.promptVersion, temperature: p.temperature, confidenceThresholds: p.confidenceThresholds || { high: 0.85, medium: 0.65, low: 0.4 } },
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
        warnings,
    };
    const parsed = sourceContentGraphSchema.safeParse(graph);
    if (!parsed.success) {
        // Soft-fail: log and still return partial graph with validation warnings
        warnings.push(`Schema validation warnings: ${parsed.error.message.slice(0, 500)}`);
    }
    return graph;
}
export async function writeSourceContentGraph(graph, filePath) {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(graph, null, 2), 'utf-8');
}
export async function loadSourceDocuments(filePath) {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
}
