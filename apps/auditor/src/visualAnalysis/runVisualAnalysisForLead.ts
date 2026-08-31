import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { visualAnalysisResultSchema } from './visualAnalysisSchema.js';
import type { VisualAnalysisProvider } from './visualAnalysisProvider.js';
import { computeLeadScoreV2 } from '../scoring/scoreLeadV2.js';

function normalizeSummary(input: { summary: string; maxLen: number }) {
  const raw = (input.summary ?? '').trim().replaceAll(/\s+/g, ' ');
  if (raw.length <= input.maxLen) {
    return { summary: raw, truncated: false, originalLength: raw.length, finalLength: raw.length };
  }

  const hard = Math.max(0, input.maxLen - 1);
  const head = raw.slice(0, hard);
  const lastSentence = Math.max(head.lastIndexOf('. '), head.lastIndexOf('! '), head.lastIndexOf('? '));
  const lastWord = head.lastIndexOf(' ');
  const cut = Math.max(lastSentence > 30 ? lastSentence + 1 : -1, lastWord > 30 ? lastWord : -1);
  const sliced = (cut > 0 ? head.slice(0, cut) : head).trimEnd();
  const final = `${sliced}…`;
  return { summary: final, truncated: true, originalLength: raw.length, finalLength: final.length };
}

function toBase64(buf: Buffer) {
  return buf.toString('base64');
}

function formatVisualError(err: any): { message: string; details?: any } {
  if (err?.issues && Array.isArray(err.issues)) {
    const numeric = err.issues
      .filter((issue: any) => ['modernity', 'visualQuality', 'mobileUX', 'trust', 'ctaQuality', 'contentStructure', 'visualHierarchy', 'brandConsistency', 'redesignPotential'].includes(issue.path?.[0]))
      .map((issue: any) => ({ field: issue.path?.[0], message: issue.message }));
    if (numeric.length > 0) {
      return {
        message: `AI response validation failed: expected numeric scores but received invalid values for ${numeric.map((n: any) => n.field).join(', ')}.`,
        details: { fields: numeric }
      };
    }
    return {
      message: `AI response validation failed: ${err.issues.map((i: any) => `${i.path?.join('.') ?? 'value'}: ${i.message}`).join('; ')}`,
      details: { issues: err.issues }
    };
  }
  return { message: err instanceof Error ? err.message : String(err) };
}

async function readJsonIfExists(path: string): Promise<unknown | null> {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function runVisualAnalysisForLead(input: {
  prisma: PrismaClient;
  logger: pino.Logger;
  provider: VisualAnalysisProvider;
  promptVersion: string;
  runId: string;
  leadId: string;
  force: boolean;
}) {
  const { prisma, logger, provider, promptVersion, runId, leadId, force } = input;

  const lead = (await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      companyName: true,
      categories: true,
      website: true,
      auditStatus: true,
      businessScore: true,
      websiteQualityScore: true,
      lighthouseReport: {
        select: {
          performance: true,
          seo: true,
          accessibility: true,
          bestPractices: true,
          lcp: true,
          cls: true,
          inp: true
        }
      }
    }
  })) as any;

  if (!lead) throw new Error(`Lead not found: ${leadId}`);
  if (lead.auditStatus !== 'SUCCESS' || !lead.website) {
    logger.info({ runId, leadId }, 'visual.skip.not_audited');
    return { status: 'SKIPPED' as const };
  }

  const existing = await (prisma as any).visualAnalysis.findUnique({ where: { leadId } });
  if (!force && existing?.status === 'SUCCESS') {
    logger.info({ runId, leadId }, 'visual.skip.already_success');
    return { status: 'SKIPPED' as const };
  }

  await (prisma as any).visualAnalysis.upsert({
    where: { leadId },
    create: {
      leadId,
      status: 'PENDING',
      modernity: 1,
      visualQuality: 1,
      mobileUX: 1,
      trust: 1,
      ctaQuality: 1,
      contentStructure: 1,
      visualHierarchy: 1,
      brandConsistency: 1,
      redesignPotential: 1,
      problems: [],
      strengths: [],
      summary: '',
      model: '',
      promptVersion
    },
    update: {
      status: 'PENDING',
      errorMessage: null,
      promptVersion
    }
  });

  const auditDir = join('data', 'audit', leadId);
  const desktopPng = await readFile(join(auditDir, 'desktop.png'));
  const mobilePng = await readFile(join(auditDir, 'mobile.png'));

  const crawlPayload = await readJsonIfExists(join(auditDir, 'crawl.json'));

  const lh = lead.lighthouseReport
    ? {
        performance: lead.lighthouseReport.performance,
        seo: lead.lighthouseReport.seo,
        accessibility: lead.lighthouseReport.accessibility,
        bestPractices: lead.lighthouseReport.bestPractices,
        lcp: lead.lighthouseReport.lcp ?? null,
        cls: lead.lighthouseReport.cls ?? null,
        inp: lead.lighthouseReport.inp ?? null
      }
    : null;

  const maxAttempts = 2;
  const attemptErrors: { message: string; details?: any; attempt: number }[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { result, model, usage } = await provider.analyze({
        leadId,
        companyName: lead.companyName,
        categories: lead.categories,
        url: lead.website,
        crawl: crawlPayload,
        lighthouse: lh,
        images: {
          desktopPngBase64: toBase64(desktopPng),
          mobilePngBase64: toBase64(mobilePng)
        }
      });

      const norm = normalizeSummary({ summary: result.summary, maxLen: 300 });
      if (norm.truncated) {
        logger.info(
          { leadId, originalLength: norm.originalLength, finalLength: norm.finalLength },
          'visual.summary.truncated'
        );
      }

      // strict validation after safe normalization
      const normalizedResult = { ...result, summary: norm.summary };
      const validated = visualAnalysisResultSchema.parse(normalizedResult);

      await (prisma as any).visualAnalysis.update({
        where: { leadId },
        data: {
          status: 'SUCCESS',
          modernity: validated.modernity,
          visualQuality: validated.visualQuality,
          mobileUX: validated.mobileUX,
          trust: validated.trust,
          ctaQuality: validated.ctaQuality,
          contentStructure: validated.contentStructure,
          visualHierarchy: validated.visualHierarchy,
          brandConsistency: validated.brandConsistency,
          redesignPotential: validated.redesignPotential,
          problems: validated.problems,
          strengths: validated.strengths,
          summary: validated.summary,
          model,
          promptVersion,
          usage,
          errorMessage: null
        }
      });

      const technicalQualityScore = typeof (lead as any).websiteQualityScore === 'number' ? (lead as any).websiteQualityScore : 0;

      const visualQualityScore = Math.max(
        0,
        Math.min(
          100,
          Math.round(
            (
              (validated.visualQuality +
                validated.modernity +
                validated.mobileUX +
                validated.visualHierarchy +
                validated.ctaQuality +
                validated.contentStructure +
                validated.trust +
                validated.brandConsistency) /
                8) *
              10
          )
        )
      );

      const businessConfidenceScore = typeof (lead as any).businessScore === 'number' ? (lead as any).businessScore : 0;
      const redesignPotentialNormalized = Math.max(0, Math.min(100, validated.redesignPotential * 10));

      const v2 = computeLeadScoreV2({
        scores: {
          technicalQualityScore,
          visualQualityScore,
          businessConfidenceScore,
          redesignPotentialNormalized
        }
      });

      await prisma.lead.update({
        where: { id: leadId },
        data: {
          technicalQualityScore,
          visualQualityScore,
          businessConfidenceScore,
          leadScoreV2: v2.leadScoreV2,
          scoreDetailsV2: {
            version: 'v1',
            promptVersion,
            ai: {
              modernity: validated.modernity,
              visualQuality: validated.visualQuality,
              mobileUX: validated.mobileUX,
              trust: validated.trust,
              ctaQuality: validated.ctaQuality,
              contentStructure: validated.contentStructure,
              visualHierarchy: validated.visualHierarchy,
              brandConsistency: validated.brandConsistency,
              redesignPotential: validated.redesignPotential
            },
            normalized: {
              technicalQualityScore,
              visualQualityScore,
              businessConfidenceScore,
              redesignPotentialNormalized
            },
            parts: v2.parts,
            reasons: v2.reasons,
            problems: validated.problems,
            strengths: validated.strengths,
            summary: validated.summary
          }
        }
      });

      logger.info({ runId, leadId, attempt }, 'visual.success');
      return { status: 'SUCCESS' as const };
    } catch (err) {
      const formatted = formatVisualError(err);
      attemptErrors.push({ ...formatted, attempt });
      logger.warn({ runId, leadId, attempt, error: formatted.message }, 'visual.attempt_failed');
      if (attempt === maxAttempts) {
        const summary = attemptErrors.map((a) => `Attempt ${a.attempt}: ${a.message}`).join(' | ');
        await (prisma as any).visualAnalysis.update({
          where: { leadId },
          data: {
            status: 'FAILED',
            errorMessage: summary,
            model: 'unknown',
            promptVersion
          }
        });

        return { status: 'FAILED' as const, error: summary, attempts: attemptErrors };
      }
    }
  }

  return { status: 'FAILED' as const, error: attemptErrors.map((a) => a.message).join(' | '), attempts: attemptErrors };
}
