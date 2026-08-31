import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import type { DiscoveryService } from '../discovery/service.js';
import { auditLeadWebsite } from '../../../auditor/src/pipeline/auditLeadWebsite.js';
import { runLighthouseForLead } from '../../../auditor/src/lighthouse/runLighthouse.js';
import { runVisualAnalysisForLead } from '../../../auditor/src/visualAnalysis/runVisualAnalysisForLead.js';
import { GeminiVisualAnalysisProvider } from '../../../auditor/src/visualAnalysis/geminiVisualAnalysisProvider.js';
import { OpenAiVisualAnalysisProvider } from '../../../auditor/src/visualAnalysis/openAiVisualAnalysisProvider.js';
import { computeLeadScoreV2 } from '../../../auditor/src/scoring/scoreLeadV2.js';
import { enrichLeads } from '../../../collector/src/enrichment/enrichLeads.js';
import { generateSite } from '@minsk/redesign-engine';
import type { RunContext } from './OperationService.js';
import { ActivityService } from '../activity/ActivityService.js';

export interface OperationDefinition {
  label: string;
  category: 'discovery' | 'audit' | 'lighthouse' | 'ai' | 'scoring' | 'enrichment' | 'factory' | 'workflow';
  description: string;
  requiredRole: 'SUPER_ADMIN';
  inputSchema: Record<string, 'string' | 'number' | 'boolean' | 'string[]'>;
  supportsCancel: boolean;
  handler: (ctx: RunContext, input: any) => Promise<any>;
}

interface RegistryDeps {
  prisma: PrismaClient;
  logger: pino.Logger;
  env: Record<string, string | undefined>;
  discovery: DiscoveryService;
  activity: ActivityService;
}

function visualProvider(env: Record<string, string | undefined>) {
  if (env.GEMINI_API_KEY && env.GEMINI_MODEL) {
    return new GeminiVisualAnalysisProvider({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, promptVersion: 'v1' });
  }
  if (env.OPENAI_API_KEY && env.OPENAI_MODEL) {
    return new OpenAiVisualAnalysisProvider({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, promptVersion: 'v1' });
  }
  throw new Error('No visual analysis provider configured. Set GEMINI_API_KEY+GEMINI_MODEL or OPENAI_API_KEY+OPENAI_MODEL.');
}

export function createRegistry(deps: RegistryDeps): Record<string, OperationDefinition> {
  return {
    TEST_PROVIDER: {
      label: 'Test provider',
      category: 'discovery',
      description: 'Validate a discovery provider configuration with a safe test search.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { providerId: 'string' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        await ctx.stage('config', `Testing provider ${input.providerId}`);
        const result = await deps.discovery.testProvider(input.providerId);
        await ctx.success(result.message);
        return result;
      },
    },

    DISCOVER_BUSINESSES: {
      label: 'Discover businesses',
      category: 'discovery',
      description: 'Run a discovery search and persist new leads.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { provider: 'string', query: 'string', location: 'string', limit: 'number', maxPages: 'number', topic: 'string' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        await ctx.stage('resolve', 'Resolving provider and query');
        const provider = input.provider || 'dgis';
        const query = input.query || '';
        const location = input.location || '';
        await ctx.stage('search', `Searching ${provider} for "${query}" in "${location}"`);
        const onProgress = (message: string, metadata?: Record<string, any>) => ctx.info(message, { stage: 'page', metadata });
        const { run, warning } = await deps.discovery.start(input, onProgress);
        await ctx.success(
          `Found ${run.collected} results (${run.createdCount} new, ${run.duplicateCount} duplicates)`,
          { stage: 'persist', metadata: { runId: run.id, created: run.createdCount, duplicates: run.duplicateCount } }
        );
        if (warning) await ctx.warn(warning);
        if (run.collected > 0) {
          await ctx.info(`Enrichment started in background for ${run.collected} candidate(s)`, { stage: 'enrich' });
        } else {
          await ctx.info('Skipping enrichment: no candidates found', { stage: 'enrich' });
        }
        return { discoveryRunId: run.id, collected: run.collected, created: run.createdCount, duplicates: run.duplicateCount };
      },
    },

    ENRICH_LEAD: {
      label: 'Enrich lead',
      category: 'enrichment',
      description: 'Try to find website/phone for one or more leads.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { leadId: 'string' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        const leadIds = input.leadIds || (input.leadId ? [input.leadId] : []);
        if (!leadIds.length) throw new Error('No leadIds provided');
        await ctx.stage('enrich', `Enriching ${leadIds.length} lead(s)`);
        await enrichLeads({ prisma: deps.prisma, logger: deps.logger, runId: ctx.runId, leadIds });
        await ctx.success('Enrichment finished');
        return { enriched: leadIds.length };
      },
    },

    AUDIT_WEBSITE: {
      label: 'Audit website',
      category: 'audit',
      description: 'Open the lead website, capture desktop/mobile screenshots and crawl metadata.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { leadId: 'string', website: 'string' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        const lead = await deps.prisma.lead.findUnique({
          where: { id: input.leadId },
          select: { id: true, website: true },
        });
        if (!lead) throw new Error('Lead not found');
        const website = input.website || lead.website;
        if (!website) throw new Error('Lead has no website to audit');
        await ctx.stage('browser', 'Launching browser');
        await auditLeadWebsite({
          prisma: deps.prisma,
          logger: deps.logger,
          runId: ctx.runId,
          leadId: lead.id,
          website,
          onActivity: async (event) => {
            await deps.activity.log({
              level: event.level ?? 'INFO',
              module: 'AUDIT',
              eventType: event.eventType,
              message: event.message,
              runId: ctx.runId,
              leadId: lead.id,
              details: event.details,
            });
          },
        });
        await ctx.success('Audit complete', { stage: 'audit', metadata: { leadId: lead.id } });
        return { leadId: lead.id, website };
      },
    },

    RUN_LIGHTHOUSE: {
      label: 'Run Lighthouse',
      category: 'lighthouse',
      description: 'Run a Lighthouse performance/accessibility/SEO audit.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { leadId: 'string', url: 'string' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        const lead = await deps.prisma.lead.findUnique({
          where: { id: input.leadId },
          select: { id: true, website: true, websiteDomain: true },
        });
        if (!lead) throw new Error('Lead not found');
        const url = input.url || lead.website;
        if (!url) throw new Error('Lead has no URL for Lighthouse');
        await ctx.stage('lighthouse', `Running Lighthouse on ${url}`);
        const { reportPath, summary } = await runLighthouseForLead({ leadId: lead.id, url });
        await deps.prisma.lighthouseReport.upsert({
          where: { leadId: lead.id },
          create: { leadId: lead.id, reportPath, ...summary },
          update: { reportPath, ...summary },
        });
        await ctx.success(
          `Lighthouse: performance ${summary.performance}, accessibility ${summary.accessibility}, seo ${summary.seo}, best-practices ${summary.bestPractices}`,
          { stage: 'lighthouse', metadata: { summary } }
        );
        return { leadId: lead.id, summary };
      },
    },

    RUN_VISUAL_ANALYSIS: {
      label: 'Run AI visual analysis',
      category: 'ai',
      description: 'Analyze screenshots with a vision model and score visual quality/redesign potential.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { leadId: 'string', force: 'boolean' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        const lead = await deps.prisma.lead.findUnique({
          where: { id: input.leadId },
          select: { id: true, website: true, auditStatus: true },
        });
        if (!lead) throw new Error('Lead not found');
        if (!lead.website || lead.auditStatus !== 'SUCCESS') {
          throw new Error('Lead must have a website and a successful audit before visual analysis');
        }
        const provider = visualProvider(deps.env);
        await ctx.stage('visual', 'Running AI visual analysis');
        const { status } = await runVisualAnalysisForLead({
          prisma: deps.prisma,
          logger: deps.logger,
          provider,
          promptVersion: 'v1',
          runId: ctx.runId,
          leadId: lead.id,
          force: input.force ?? false,
        });
        if (status === 'SKIPPED') await ctx.warn('Visual analysis skipped — already completed or not ready');
        else await ctx.success('Visual analysis complete', { stage: 'visual' });
        return { leadId: lead.id, status };
      },
    },

    RECALCULATE_SCORE: {
      label: 'Recalculate lead score',
      category: 'scoring',
      description: 'Recompute the lead score from available sub-scores.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { leadId: 'string' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        try {
          const lead = await deps.prisma.lead.findUnique({
            where: { id: input.leadId },
            select: {
              id: true,
              businessScore: true,
              businessConfidenceScore: true,
              websiteQualityScore: true,
              technicalQualityScore: true,
              visualQualityScore: true,
            },
          });
          if (!lead) throw new Error('Lead not found');
          const visual = await (deps.prisma as any).visualAnalysis.findUnique({
            where: { leadId: lead.id },
            select: { redesignPotential: true, visualQuality: true, trust: true },
          });
          const lighthouse = await deps.prisma.lighthouseReport.findUnique({
            where: { leadId: lead.id },
            select: { performance: true, accessibility: true, seo: true, bestPractices: true },
          });
          const redesignPotentialNormalized = Math.max(0, Math.min(100, (visual?.redesignPotential ?? 0) * 10));
          const technicalQualityScore = Math.round(
            (lighthouse
              ? (lighthouse.performance + lighthouse.accessibility + lighthouse.seo + lighthouse.bestPractices) / 4
              : lead.technicalQualityScore) ?? 0
          );
          const visualQualityScore = Math.round(
            visual?.visualQuality != null ? visual.visualQuality * 10 : lead.visualQualityScore ?? 0
          );
          const businessConfidenceScore = Math.round(
            visual?.trust != null ? visual.trust * 10 : lead.businessConfidenceScore ?? lead.businessScore ?? 0
          );
          const v2 = computeLeadScoreV2({
            scores: {
              technicalQualityScore,
              visualQualityScore,
              businessConfidenceScore,
              redesignPotentialNormalized,
            },
          });
          const scoreDetailsV2 = {
            ...(lead as any).scoreDetailsV2 || {},
            inputs: { technicalQualityScore, visualQualityScore, businessConfidenceScore, redesignPotentialNormalized },
            parts: v2.parts,
            reasons: v2.reasons,
          } as any;
          await deps.prisma.lead.update({
            where: { id: lead.id },
            data: {
              technicalQualityScore,
              visualQualityScore,
              businessConfidenceScore,
              leadScoreV2: v2.leadScoreV2,
              scoreDetailsV2,
              scoreStatus: 'SUCCESS',
            },
          });
          await ctx.success(`Score recalculated: ${v2.leadScoreV2}`, { stage: 'scoring', metadata: { v2 } });
          return { leadId: lead.id, score: v2.leadScoreV2 };
        } catch (err: any) {
          await deps.prisma.lead.update({
            where: { id: input.leadId },
            data: { scoreStatus: 'FAILED', scoreDetailsV2: { error: err?.message || 'score_failed' } },
          });
          throw err;
        }
      },
    },

    RUN_FULL_QUALIFICATION: {
      label: 'Run full qualification',
      category: 'workflow',
      description: 'Enrich, audit, run Lighthouse, run visual analysis and recalculate the lead score in one flow.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { leadId: 'string', force: 'boolean' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        const force = input.force ?? false;
        const lead = await deps.prisma.lead.findUnique({
          where: { id: input.leadId },
          select: {
            id: true,
            website: true,
            websiteDomain: true,
            auditStatus: true,
            lighthouseReport: true,
          },
        });
        if (!lead) throw new Error('Lead not found');

        if ((!lead.website || force) && !input.skipEnrich) {
          await ctx.stage('enrich', 'Enriching lead contact data');
          await enrichLeads({ prisma: deps.prisma, logger: deps.logger, runId: ctx.runId, leadIds: [lead.id] });
        } else {
          await ctx.info('Skipping enrichment', { stage: 'enrich' });
        }

        if (lead.auditStatus !== 'SUCCESS' || force) {
          await ctx.stage('audit', 'Auditing website');
          const refreshed = await deps.prisma.lead.findUnique({ where: { id: lead.id }, select: { website: true } });
          if (!refreshed?.website) throw new Error('No website available for audit');
          await auditLeadWebsite({
            prisma: deps.prisma,
            logger: deps.logger,
            runId: ctx.runId,
            leadId: lead.id,
            website: refreshed.website,
          });
          const afterAudit = await deps.prisma.lead.findUnique({ where: { id: lead.id }, select: { auditStatus: true } });
          if (afterAudit?.auditStatus !== 'SUCCESS') {
            throw new Error(`Audit did not complete successfully for ${lead.id}`);
          }
        } else {
          await ctx.info('Skipping audit', { stage: 'audit' });
        }

        if (!lead.lighthouseReport || force) {
          await ctx.stage('lighthouse', 'Running Lighthouse');
          const refreshed = await deps.prisma.lead.findUnique({ where: { id: lead.id }, select: { website: true } });
          if (!refreshed?.website) throw new Error('No website for Lighthouse');
          const { reportPath, summary } = await runLighthouseForLead({ leadId: lead.id, url: refreshed.website });
          await deps.prisma.lighthouseReport.upsert({
            where: { leadId: lead.id },
            create: { leadId: lead.id, reportPath, ...summary },
            update: { reportPath, ...summary },
          });
        } else {
          await ctx.info('Skipping Lighthouse', { stage: 'lighthouse' });
        }

        await ctx.stage('visual', 'Running visual analysis');
        const provider = visualProvider(deps.env);
        const { status } = await runVisualAnalysisForLead({
          prisma: deps.prisma,
          logger: deps.logger,
          provider,
          promptVersion: 'v1',
          runId: ctx.runId,
          leadId: lead.id,
          force,
        });
        if (status === 'SKIPPED') await ctx.warn('Visual analysis skipped');
        else await ctx.success('Visual analysis complete');

        await ctx.stage('scoring', 'Recalculating lead score');
        const result = await createRegistry(deps).RECALCULATE_SCORE.handler(ctx, { leadId: lead.id });

        await ctx.success('Full qualification complete', { stage: 'complete' });
        return { leadId: lead.id, score: result.score };
      },
    },

    GENERATE_SITE: {
      label: 'Generate site',
      category: 'factory',
      description: 'Run the redesign pipeline: crawl, extract, transform, import and render.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { leadId: 'string', force: 'boolean' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        await ctx.stage('select', `Starting site generation for ${input.leadId}`);
        const result = await generateSite({
          leadId: input.leadId,
          force: input.force ?? false,
          prisma: deps.prisma,
        });
        await ctx.success(`Site generated: ${result.previewSlug}`, { stage: 'site_rendered', metadata: result });
        return result;
      },
    },

    QUALIFY_DISCOVERY_RUN: {
      label: 'Qualify discovery run',
      category: 'workflow',
      description: 'Run full qualification (audit, Lighthouse, AI, score) for eligible leads from a discovery run.',
      requiredRole: 'SUPER_ADMIN',
      inputSchema: { discoveryRunId: 'string', concurrency: 'number' },
      supportsCancel: false,
      handler: async (ctx, input) => {
        const run = await deps.prisma.discoveryRun.findUnique({ where: { id: input.discoveryRunId } });
        if (!run) throw new Error('Discovery run not found');
        const ids = run.leadIds ?? [];
        const concurrency = Math.max(1, Math.min(5, Math.floor(Number(input.concurrency ?? 2))));

        const all = await deps.prisma.lead.findMany({
          where: { id: { in: ids } },
          select: { id: true, website: true, websiteDomain: true, websiteStatus: true, auditStatus: true, lighthouseReport: true, visualAnalysis: true, leadScoreV2: true }
        });

        const eligible = all.filter((l: any) => {
          if (l.websiteStatus !== 'FOUND' && l.websiteStatus !== 'UNKNOWN') return false;
          if (!l.website) return false;
          if (!l.websiteDomain) return false;
          return true;
        });

        if (eligible.length === 0) {
          await ctx.warn('No eligible leads with usable websites found');
          return { qualified: 0, skipped: all.length };
        }

        const already = all.filter((l: any) => l.leadScoreV2 != null).length;
        const todo = eligible.filter((l: any) => l.leadScoreV2 == null);

        await ctx.info(`Discovery run has ${all.length} leads, ${eligible.length} with websites. Qualifying ${todo.length} unqualified with concurrency ${concurrency}.`, { stage: 'eligibility' });

        const registry = createRegistry(deps);
        const qualify = registry.RUN_FULL_QUALIFICATION.handler;

        let index = 0;
        const workers = Array.from({ length: concurrency }, async () => {
          while (index < todo.length) {
            const i = index++;
            const lead = todo[i];
            try {
              await qualify(ctx, { leadId: lead.id, force: false, skipEnrich: true });
              await ctx.info(`Qualified ${i + 1}/${todo.length}: ${lead.id}`, { stage: 'progress' });
            } catch (err: any) {
              await ctx.warn(`Qualification failed for ${lead.id}: ${err.message}`, { stage: 'progress' });
            }
          }
        });

        await Promise.all(workers);
        await ctx.success(`Discovery run qualified ${todo.length} eligible leads`, { stage: 'complete', metadata: { total: all.length, eligible: eligible.length, qualified: todo.length, alreadyQualified: already } });
        return { total: all.length, eligible: eligible.length, qualified: todo.length, already };
      },
    },
  };
}
