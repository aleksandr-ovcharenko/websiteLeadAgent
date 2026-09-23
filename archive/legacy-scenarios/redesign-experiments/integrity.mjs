import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { ArtifactType, Severity } from './types.mjs';
import { createArtifactRef } from './manifest.mjs';

/**
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {object} IntegrityFinding
 * @property {string} severity
 * @property {string} category
 * @property {string} description
 * @property {string} [evidence]
 */

/**
 * @typedef {object} IntegrityReport
 * @property {string} source
 * @property {string} url
 * @property {IntegrityFinding[]} findings
 * @property {number} findingCount
 */

const TRUNCATED_RE = /\.\.\.$|…$/;
const PLACEHOLDER_RE = /lorem ipsum|placeholder|sample text|internet provider|insert here/i;
const ENGLISH_UI_RE = /\b(home|services|projects|about|contact|catalog|menu|search|close)\b/i;

/**
 * Detect truncated strings and mixed/incorrect content.
 * @param {string} value
 * @param {string} label
 * @param {IntegrityFinding[]} findings
 */
function checkString(value, label, findings) {
  if (!value) return;
  if (TRUNCATED_RE.test(value)) {
    findings.push({
      severity: Severity.MEDIUM,
      category: 'TRUNCATED_TEXT',
      description: `${label} appears truncated`,
      evidence: value.slice(0, 120),
    });
  }
  if (PLACEHOLDER_RE.test(value)) {
    findings.push({
      severity: Severity.HIGH,
      category: 'PLACEHOLDER_OR_INCORRECT_CONTENT',
      description: `${label} contains placeholder or incorrect content`,
      evidence: value.slice(0, 120),
    });
  }
}

/**
 * Check generated content for common defects.
 * @param {string} contentPath
 * @param {string} sourceUrl
 * @returns {Promise<IntegrityReport>}
 */
export async function checkGeneratedContent(contentPath, sourceUrl) {
  const findings = [];
  if (!existsSync(contentPath)) {
    findings.push({
      severity: Severity.CRITICAL,
      category: 'MISSING_CONTENT',
      description: `Content file not found: ${contentPath}`,
    });
    return buildReport('generated', sourceUrl, findings);
  }

  const raw = await readFile(contentPath, 'utf8');
  const content = JSON.parse(raw);

  // Hero checks
  const hero = content.hero || {};
  if (!hero.title) {
    findings.push({ severity: Severity.HIGH, category: 'EMPTY_HERO_HEADLINE', description: 'Hero title is missing' });
  } else {
    checkString(hero.title, 'Hero title', findings);
  }
  if (hero.subtitle) checkString(hero.subtitle, 'Hero subtitle', findings);
  if (hero.buttonLabel) checkString(hero.buttonLabel, 'Hero CTA label', findings);
  if (!hero.buttonLabel) {
    findings.push({ severity: Severity.MEDIUM, category: 'MISSING_HERO_CTA', description: 'Hero button label is missing' });
  }

  // MAPID-specific incorrect labels
  if (hero.industry === 'Internet provider' || /internet provider/i.test(hero.subtitle || '')) {
    findings.push({
      severity: Severity.HIGH,
      category: 'INCORRECT_BUSINESS_CLASSIFICATION',
      description: 'Generated content misclassifies MAPID as "Internet provider"',
      evidence: JSON.stringify({ industry: hero.industry, subtitle: hero.subtitle }),
    });
  }

  if (hero.secondaryCtaLabel === 'Смотреть каталог' || /catalog/i.test(hero.secondaryCtaLabel || '')) {
    findings.push({
      severity: Severity.HIGH,
      category: 'INCORRECT_CATALOG_CTA',
      description: 'Generated CTA suggests a product catalog for a corporate construction site',
      evidence: hero.secondaryCtaLabel,
    });
  }

  // Navigation language
  const navigation = content.navigation || [];
  const navLabels = navigation.map((n) => n.label).filter(Boolean);
  const englishLabels = navLabels.filter((l) => ENGLISH_UI_RE.test(l));
  if (englishLabels.length && /[а-яё]/i.test(JSON.stringify(content))) {
    findings.push({
      severity: Severity.MEDIUM,
      category: 'MIXED_UI_LANGUAGE',
      description: 'Navigation labels are in English while site content is Russian',
      evidence: englishLabels.slice(0, 5).join(', '),
    });
  }
  if (navLabels.length === 0) {
    findings.push({ severity: Severity.HIGH, category: 'MISSING_PRIMARY_NAVIGATION', description: 'No primary navigation found' });
  }

  // Missing contact path
  const hasContact = navLabels.some((l) => /контакт|contact/i.test(l));
  const contacts = content.contacts || {};
  if (!hasContact && !contacts.email && !contacts.phone) {
    findings.push({ severity: Severity.MEDIUM, category: 'MISSING_CONTACT_PATH', description: 'No contact page or contact details found' });
  }

  // Empty/duplicate sections
  const sections = content.homepageSections || [];
  const headings = [];
  for (const [i, section] of sections.entries()) {
    const heading = section.heading || section.title || '';
    if (heading) {
      if (headings.includes(heading)) {
        findings.push({ severity: Severity.LOW, category: 'DUPLICATE_SECTION_HEADING', description: `Duplicate section heading: "${heading}"`, evidence: `index ${i}` });
      }
      headings.push(heading);
    }
    if (!heading && (!section.items || section.items.length === 0)) {
      findings.push({ severity: Severity.LOW, category: 'EMPTY_SECTION', description: `Empty homepage section at index ${i}` });
    }
  }

  // Media overuse / small images
  const media = content.media || [];
  const urls = media.map((m) => m.url || m.src || m.id).filter(Boolean);
  const counts = {};
  for (const u of urls) counts[u] = (counts[u] || 0) + 1;
  for (const [url, count] of Object.entries(counts)) {
    if (count > 3) {
      findings.push({ severity: Severity.LOW, category: 'DUPLICATE_MEDIA_OVERUSE', description: `Image used ${count} times`, evidence: url });
    }
  }

  return buildReport('generated', sourceUrl, findings);
}

/**
 * Check source content for noise and quality issues.
 * @param {string} contentPath
 * @param {string} sourceUrl
 * @returns {Promise<IntegrityReport>}
 */
export async function checkSourceContent(contentPath, sourceUrl) {
  const findings = [];
  if (!existsSync(contentPath)) {
    findings.push({ severity: Severity.CRITICAL, category: 'MISSING_CONTENT', description: `Source content file not found: ${contentPath}` });
    return buildReport('source', sourceUrl, findings);
  }

  const content = JSON.parse(await readFile(contentPath, 'utf8'));
  const text = JSON.stringify(content).toLowerCase();
  const cyrillic = (text.match(/[\u0400-\u04FF]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;

  if (latin > cyrillic && /[а-яё]/.test(text)) {
    findings.push({
      severity: Severity.LOW,
      category: 'MIXED_SOURCE_LANGUAGE',
      description: 'Source content has more Latin characters than Cyrillic despite Cyrillic content',
    });
  }

  if (text.includes('specialnost')) {
    findings.push({
      severity: Severity.LOW,
      category: 'ACCESSIBILITY_TOOLBAR_LEAK',
      description: 'Accessibility toolbar text appears in extracted source content',
    });
  }

  return buildReport('source', sourceUrl, findings);
}

function buildReport(source, url, findings) {
  return { source, url, findings, findingCount: findings.length };
}

/**
 * Persist an integrity report and return an artifact reference.
 * @param {IntegrityReport} report
 * @param {string} outDir
 * @returns {Promise<ArtifactRef>}
 */
export async function writeIntegrityReport(report, outDir) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  await mkdir(outDir, { recursive: true });
  const id = `integrity-${randomUUID().slice(0, 8)}`;
  const reportPath = join(outDir, `${id}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  return createArtifactRef(ArtifactType.INTEGRITY_REPORT, reportPath, { url: report.url });
}
