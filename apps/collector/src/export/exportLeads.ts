import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';

type ExportLeadRow = {
  id: string;
  companyName: string;
  address: string | null;
  website: string | null;
  websiteDomain: string | null;
  phone: string | null;
  categories: string[];
  leadScore: number | null;
  businessScore: number | null;
  websiteQualityScore: number | null;
  scoreStatus: string;
  scoredAt: Date | null;
  lighthouseReport: null | {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fcp: number | null;
    tbt: number | null;
    reportPath: string;
  };
};

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function exportLeads(input: { prisma: PrismaClient; outDir: string }) {
  const { prisma, outDir } = input;

  await mkdir(outDir, { recursive: true });

  const leads = (await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      companyName: true,
      address: true,
      website: true,
      websiteDomain: true,
      phone: true,
      categories: true,
      leadScore: true,
      businessScore: true,
      websiteQualityScore: true,
      scoreStatus: true,
      scoredAt: true,
      lighthouseReport: {
        select: {
          performance: true,
          seo: true,
          accessibility: true,
          bestPractices: true,
          lcp: true,
          cls: true,
          inp: true,
          fcp: true,
          tbt: true,
          reportPath: true
        }
      }
    }
  })) as ExportLeadRow[];

  const jsonPath = join(outDir, 'leads.json');
  await writeFile(jsonPath, JSON.stringify(leads, null, 2), 'utf-8');

  const csvPath = join(outDir, 'leads.csv');

  const header = [
    'company_name',
    'address',
    'website',
    'website_domain',
    'phone',
    'category',
    'lead_score',
    'business_score',
    'website_quality_score',
    'score_status',
    'performance',
    'seo',
    'accessibility',
    'best_practices',
    'lcp_ms',
    'cls',
    'inp_ms',
    'fcp_ms',
    'tbt_ms',
    'lighthouse_report_path'
  ];

  const lines: string[] = [header.join(',')];

  for (const lead of leads) {
    const row = [
      lead.companyName ?? '',
      lead.address ?? '',
      lead.website ?? '',
      lead.websiteDomain ?? '',
      lead.phone ?? '',
      (lead.categories?.[0] ?? ''),
      lead.leadScore ?? '',
      lead.businessScore ?? '',
      lead.websiteQualityScore ?? '',
      lead.scoreStatus ?? '',
      lead.lighthouseReport?.performance ?? '',
      lead.lighthouseReport?.seo ?? '',
      lead.lighthouseReport?.accessibility ?? '',
      lead.lighthouseReport?.bestPractices ?? '',
      lead.lighthouseReport?.lcp ?? '',
      lead.lighthouseReport?.cls ?? '',
      lead.lighthouseReport?.inp ?? '',
      lead.lighthouseReport?.fcp ?? '',
      lead.lighthouseReport?.tbt ?? '',
      lead.lighthouseReport?.reportPath ?? ''
    ].map((v) => escapeCsv(String(v)));

    lines.push(row.join(','));
  }

  await writeFile(csvPath, lines.join('\n'), 'utf-8');

  const scored = leads
    .filter((l) => l.leadScore != null)
    .sort((a, b) => (b.leadScore ?? 0) - (a.leadScore ?? 0));

  const scoredJsonPath = join(outDir, 'leads_scored.json');
  await writeFile(scoredJsonPath, JSON.stringify(scored, null, 2), 'utf-8');

  const scoredCsvPath = join(outDir, 'leads_scored.csv');
  const scoredLines: string[] = [header.join(',')];
  for (const lead of scored) {
    const row = [
      lead.companyName ?? '',
      lead.address ?? '',
      lead.website ?? '',
      lead.websiteDomain ?? '',
      lead.phone ?? '',
      (lead.categories?.[0] ?? ''),
      lead.leadScore ?? '',
      lead.businessScore ?? '',
      lead.websiteQualityScore ?? '',
      lead.scoreStatus ?? '',
      lead.lighthouseReport?.performance ?? '',
      lead.lighthouseReport?.seo ?? '',
      lead.lighthouseReport?.accessibility ?? '',
      lead.lighthouseReport?.bestPractices ?? '',
      lead.lighthouseReport?.lcp ?? '',
      lead.lighthouseReport?.cls ?? '',
      lead.lighthouseReport?.inp ?? '',
      lead.lighthouseReport?.fcp ?? '',
      lead.lighthouseReport?.tbt ?? '',
      lead.lighthouseReport?.reportPath ?? ''
    ].map((v) => escapeCsv(String(v)));

    scoredLines.push(row.join(','));
  }

  await writeFile(scoredCsvPath, scoredLines.join('\n'), 'utf-8');
}
