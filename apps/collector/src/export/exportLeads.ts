import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';

function escapeCsv(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export async function exportLeads(input: { prisma: PrismaClient; outDir: string }) {
  const { prisma, outDir } = input;

  await mkdir(outDir, { recursive: true });

  const leads = await prisma.lead.findMany({
    orderBy: { createdAt: 'desc' },
    include: { queries: true }
  });

  const jsonPath = join(outDir, 'leads.json');
  await writeFile(jsonPath, JSON.stringify(leads, null, 2), 'utf-8');

  const csvPath = join(outDir, 'leads.csv');

  const header = [
    'company_name',
    'address',
    'website',
    'category',
    'business_score',
    'website_score',
    'lead_score',
    'lead_status',
    'performance',
    'seo',
    'accessibility',
    'modernity',
    'mobile_ux',
    'cta_quality',
    'redesign_potential',
    'main_problems'
  ];

  const lines: string[] = [header.join(',')];

  for (const lead of leads) {
    const row = [
      lead.companyName ?? '',
      lead.address ?? '',
      lead.website ?? '',
      (lead.categories?.[0] ?? ''),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      ''
    ].map((v) => escapeCsv(String(v)));

    lines.push(row.join(','));
  }

  await writeFile(csvPath, lines.join('\n'), 'utf-8');
}
