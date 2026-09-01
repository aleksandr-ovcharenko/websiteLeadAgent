import { setImmediate } from 'node:timers';
import type { PrismaClient } from '@prisma/client';
import type pino from 'pino';
import { getDiscoveryProvider, listDiscoveryProviders } from './registry.js';
import { DISCOVERY_PRESETS } from './presets.js';
import type { DiscoveryRequest, DiscoveryContext } from './types.js';
import { enrichLeads } from '../../../collector/src/enrichment/enrichLeads.js';
import { createRegistry } from '../operations/registry.js';
import { ActivityService } from '../activity/ActivityService.js';
import type { QualificationOrchestrator } from '../qualification/QualificationOrchestrator.js';

export interface DiscoveryServiceInput {
  prisma: PrismaClient;
  logger: pino.Logger;
  env: Record<string, string | undefined>;
  activity: ActivityService;
}

export interface StartDiscoveryInput {
  provider: string;
  query: string;
  topic?: string;
  location?: string;
  limit?: number;
  maxPages?: number;
  providerOptions?: Record<string, any>;
  manualEntries?: string;
  requestedProvider?: string;
}

export class DiscoveryService {
  private prisma: PrismaClient;
  private logger: pino.Logger;
  private env: Record<string, string | undefined>;
  private activity: ActivityService;
  private qualification?: QualificationOrchestrator;

  constructor(input: DiscoveryServiceInput) {
    this.prisma = input.prisma;
    this.logger = input.logger;
    this.env = input.env;
    this.activity = input.activity;
  }

  setQualificationOrchestrator(qualification: QualificationOrchestrator) {
    this.qualification = qualification;
  }

  private resolveRequest(input: StartDiscoveryInput): DiscoveryRequest {
    const preset = input.topic ? DISCOVERY_PRESETS.find((p) => p.id === input.topic) : undefined;

    const provider = input.provider || preset?.defaultProvider || 'dgis';
    const query = input.query ?? preset?.defaultQuery ?? '';
    const limit = input.limit ?? preset?.defaultLimit ?? 50;

    return {
      provider,
      query,
      topic: input.topic,
      location: input.location,
      limit,
      maxPages: input.maxPages,
      providerOptions: input.providerOptions,
      manualEntries: input.manualEntries,
    };
  }

  async start(input: StartDiscoveryInput, onProgress?: DiscoveryContext['onProgress']) {
    const request = this.resolveRequest(input);
    const provider = getDiscoveryProvider(request.provider);

    if (!provider) {
      throw new Error(`Unknown discovery provider: ${request.provider}`);
    }

    if (!provider.isConfigured(this.env)) {
      throw new Error(`${provider.meta.name} is not configured. ${provider.meta.config.helpText || ''}`);
    }

    const run = await this.prisma.discoveryRun.create({
      data: {
        provider: request.provider,
        requestedProvider: input.requestedProvider ?? request.provider,
        query: request.query,
        topic: request.topic,
        location: request.location,
        limit: request.limit,
        maxPages: request.maxPages,
        providerOptions: request.providerOptions ?? {},
        status: 'DISCOVERING',
        leadIds: [],
        collected: 0,
        createdCount: 0,
        duplicateCount: 0,
      },
    });

    try {
      const result = await provider.search(request, {
        prisma: this.prisma,
        logger: this.logger,
        env: this.env,
        onProgress,
      });

      const leadIds: string[] = [];
      let created = 0;
      let duplicates = 0;

      for (const candidate of result.candidates) {
        const existing = await this.prisma.lead.findUnique({
          where: { source_sourceId: { source: candidate.data.source, sourceId: candidate.sourceId } },
          select: { id: true },
        });

        const lead = await this.prisma.lead.upsert({
          where: { source_sourceId: { source: candidate.data.source, sourceId: candidate.sourceId } },
          create: candidate.data,
          update: candidate.data,
          select: { id: true },
        });

        leadIds.push(lead.id);

        if (existing) duplicates++;
        else created++;

        await this.prisma.leadQuery.upsert({
          where: { leadId_query: { leadId: lead.id, query: request.query } },
          create: { leadId: lead.id, query: request.query },
          update: {},
        });
      }

      await this.prisma.discoveryRun.update({
        where: { id: run.id },
        data: {
          status: 'ENRICHING',
          leadIds,
          collected: leadIds.length,
          createdCount: created,
          duplicateCount: duplicates,
          errorMessage: result.warning || null,
        },
      });

      if (leadIds.length) {
        await enrichLeads({ prisma: this.prisma, logger: this.logger, runId: run.id, leadIds });
      }

      await this.prisma.discoveryRun.update({
        where: { id: run.id },
        data: { status: 'QUALIFYING' },
      });

      await this.qualifyRun(run.id, 2, onProgress);

      const completed = await this.prisma.discoveryRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          errorMessage: result.warning || null,
        },
      });

      return { run: completed, warning: result.warning };
    } catch (err: any) {
      const failed = await this.prisma.discoveryRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', errorMessage: err?.message || 'Unknown discovery error' },
      });
      throw { run: failed, error: err?.message || 'Unknown discovery error' };
    }
  }

  private async qualifyRun(runId: string, concurrency: number, onProgress?: DiscoveryContext['onProgress']) {
    const run = await this.prisma.discoveryRun.findUnique({ where: { id: runId } });
    if (!run) return;
    if (!this.qualification) {
      throw new Error('Qualification orchestrator not set on DiscoveryService');
    }
    const registry = createRegistry({
      prisma: this.prisma,
      logger: this.logger,
      env: this.env,
      discovery: this,
      activity: this.activity,
      qualification: this.qualification,
    });
    const ctx: any = {
      runId,
      prisma: this.prisma,
      logger: this.logger,
      env: this.env,
      currentStage: null as string | null,
      stage: async (name: string, message?: string) => {
        ctx.currentStage = name;
        this.logger.info({ runId, stage: name }, message ?? name);
        onProgress?.(message ?? name, { stage: name });
      },
      info: async (message: string, options?: any) => {
        this.logger.info({ runId, ...options?.metadata, stage: options?.stage ?? ctx.currentStage }, message);
        onProgress?.(message, options);
      },
      warn: async (message: string, options?: any) => {
        this.logger.warn({ runId, ...options?.metadata, stage: options?.stage ?? ctx.currentStage }, message);
        onProgress?.(message, options);
      },
      success: async (message: string, options?: any) => {
        this.logger.info({ runId, ...options?.metadata, stage: options?.stage ?? ctx.currentStage }, message);
        onProgress?.(message, options);
      },
      error: async (message: string, options?: any) => {
        this.logger.error({ runId, ...options?.metadata, stage: options?.stage ?? ctx.currentStage }, message);
        onProgress?.(message, options);
      },
      log: async (level: string, message: string, options?: any) => {
        (this.logger as any)[level.toLowerCase()]({ runId, ...options?.metadata, stage: options?.stage ?? ctx.currentStage }, message);
      },
      result: () => {},
      fail: (e: any) => { throw e; },
      cancelled: () => false,
    };
    await registry.QUALIFY_DISCOVERY_RUN.handler(ctx, { discoveryRunId: runId, concurrency });
  }

  async getRun(id: string) {
    return this.prisma.discoveryRun.findUnique({ where: { id } });
  }

  async listRuns(take = 50, skip = 0) {
    const [items, count] = await Promise.all([
      this.prisma.discoveryRun.findMany({ orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.discoveryRun.count(),
    ]);
    return { items, count };
  }

  private registry = { list: listDiscoveryProviders, get: getDiscoveryProvider };

  async ensureProviderConfigs() {
    const existing = await this.prisma.discoveryProviderConfig.findMany({ select: { providerId: true } });
    const existingSet = new Set(existing.map((c) => c.providerId));
    const defaults = this.registry.list().map((p) => ({
      providerId: p.meta.id,
      enabled: true,
      defaults: {},
    }));
    for (const d of defaults) {
      if (!existingSet.has(d.providerId)) {
        await this.prisma.discoveryProviderConfig.create({ data: d });
      }
    }
  }

  async listProviders() {
    await this.ensureProviderConfigs();
    const configs = await this.prisma.discoveryProviderConfig.findMany();
    const configById = new Map(configs.map((c) => [c.providerId, c]));
    const recentRuns = await this.prisma.discoveryRun.groupBy({
      by: ['provider'],
      _count: { provider: true },
      where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    });
    const runCounts = new Map(recentRuns.map((r) => [r.provider, r._count.provider]));

    return this.registry.list().map((p) => {
      const config = configById.get(p.meta.id);
      const configured = p.isConfigured(this.env);
      const status = config?.enabled === false ? 'DISABLED' : configured ? 'READY' : 'NOT_CONFIGURED';
      return {
        ...p.meta,
        enabled: config?.enabled ?? true,
        status,
        configured,
        defaults: (config?.defaults as Record<string, any>) || {},
        lastTestAt: config?.lastTestAt ? config.lastTestAt.toISOString() : null,
        lastTestStatus: config?.lastTestStatus || null,
        lastTestMessage: config?.lastTestMessage || null,
        recentRunsCount: runCounts.get(p.meta.id) || 0,
      };
    });
  }

  async updateProviderConfig(providerId: string, input: { enabled?: boolean; defaults?: Record<string, any> }) {
    const provider = this.registry.get(providerId);
    if (!provider) throw new Error('Unknown provider');
    await this.ensureProviderConfigs();
    const data: any = {};
    if (typeof input.enabled === 'boolean') data.enabled = input.enabled;
    if (input.defaults) data.defaults = input.defaults;
    const updated = await this.prisma.discoveryProviderConfig.upsert({
      where: { providerId },
      update: data,
      create: { providerId, ...data },
    });
    return updated;
  }

  async testProvider(providerId: string) {
    const provider = this.registry.get(providerId);
    if (!provider) throw new Error('Unknown provider');
    if (!provider.isConfigured(this.env)) {
      await this.updateLastTest(providerId, 'NOT_CONFIGURED', 'Provider is not configured');
      throw new Error('Provider is not configured');
    }

    const request: DiscoveryRequest = {
      provider: providerId,
      query: 'строительные компании',
      location: 'Минск',
      limit: 5,
      maxPages: 1,
      providerOptions: {},
    };

    try {
      const result = await provider.search(request, { prisma: this.prisma, logger: this.logger, env: this.env });
      const message = result.warning || `Found ${result.candidates.length} candidate(s)`;
      await this.updateLastTest(providerId, 'SUCCESS', message);
      return { status: 'SUCCESS', message };
    } catch (err: any) {
      const message = err?.message || 'Provider test failed';
      await this.updateLastTest(providerId, 'ERROR', message);
      throw new Error(message);
    }
  }

  private async updateLastTest(providerId: string, status: string, message: string) {
    await this.ensureProviderConfigs();
    await this.prisma.discoveryProviderConfig.update({
      where: { providerId },
      data: { lastTestAt: new Date(), lastTestStatus: status, lastTestMessage: message },
    });
  }

  private async ensurePresets() {
    const count = await this.prisma.discoveryPreset.count();
    if (count > 0) return;
    for (const p of DISCOVERY_PRESETS) {
      await this.prisma.discoveryPreset.create({
        data: {
          name: p.name,
          category: p.category,
          enabled: p.enabled,
          defaultProvider: p.defaultProvider,
          query: p.defaultQuery,
          queries: [p.defaultQuery],
          defaultLimit: p.defaultLimit,
          defaultMaxPages: 5,
        },
      });
    }
  }

  async listPresets() {
    await this.ensurePresets();
    const items = await this.prisma.discoveryPreset.findMany({ orderBy: { createdAt: 'desc' } });
    return items.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      enabled: p.enabled,
      defaultProvider: p.defaultProvider,
      defaultQuery: p.query,
      queries: p.queries,
      defaultLocation: p.defaultLocation,
      defaultLimit: p.defaultLimit,
      defaultMaxPages: p.defaultMaxPages,
    }));
  }

  async createPreset(data: any) {
    return this.prisma.discoveryPreset.create({
      data: {
        name: data.name,
        category: data.category || '',
        enabled: data.enabled ?? true,
        defaultProvider: data.defaultProvider || 'dgis',
        query: data.defaultQuery || data.query || data.name,
        queries: data.queries || [data.defaultQuery || data.query || data.name],
        defaultLocation: data.defaultLocation,
        defaultLimit: data.defaultLimit ?? 50,
        defaultMaxPages: data.defaultMaxPages ?? 5,
      },
    });
  }

  async updatePreset(id: string, data: any) {
    return this.prisma.discoveryPreset.update({
      where: { id },
      data: {
        name: data.name,
        category: data.category,
        enabled: data.enabled,
        defaultProvider: data.defaultProvider,
        query: data.defaultQuery ?? data.query,
        queries: data.queries,
        defaultLocation: data.defaultLocation,
        defaultLimit: data.defaultLimit,
        defaultMaxPages: data.defaultMaxPages,
      },
    });
  }

  async deletePreset(id: string) {
    return this.prisma.discoveryPreset.delete({ where: { id } });
  }

  async getSettings() {
    const row = await this.prisma.discoverySetting.findUnique({ where: { id: 'global' } });
    return (row?.value as Record<string, any>) || {
      defaultProvider: 'dgis',
      defaultLocation: 'Минск',
      defaultLimit: 50,
      defaultMaxPages: 5,
      defaultTopic: '',
    };
  }

  async setSettings(value: Record<string, any>) {
    await this.prisma.discoverySetting.upsert({
      where: { id: 'global' },
      update: { value },
      create: { id: 'global', value },
    });
    return value;
  }

  async getRunFunnel(runId: string) {
    const run = await this.prisma.discoveryRun.findUnique({ where: { id: runId } });
    if (!run) return null;
    const ids = run.leadIds ?? [];
    const where: any = ids.length ? { id: { in: ids } } : { id: { in: [] } };
    const [
      total,
      withWebsite,
      withoutWebsite,
      noWebsite,
      aggregator,
      directory,
      government,
      social,
      marketplace,
      mapProvider,
      otherIneligible,
      enriched,
      audited,
      lighthoused,
      aiAnalyzed,
      scored,
      good,
      selected,
      generated,
      failed
    ] = await Promise.all([
      this.prisma.lead.count({ where }),
      this.prisma.lead.count({ where: { ...where, websiteStatus: 'FOUND' } }),
      this.prisma.lead.count({ where: { ...where, websiteStatus: { not: 'FOUND' } } }),
      this.prisma.lead.count({ where: { ...where, websiteIneligibilityReason: 'NO_WEBSITE' } }),
      this.prisma.lead.count({ where: { ...where, websiteIneligibilityReason: 'AGGREGATOR' } }),
      this.prisma.lead.count({ where: { ...where, websiteIneligibilityReason: 'DIRECTORY' } }),
      this.prisma.lead.count({ where: { ...where, websiteIneligibilityReason: 'GOVERNMENT' } }),
      this.prisma.lead.count({ where: { ...where, websiteIneligibilityReason: 'SOCIAL_NETWORK' } }),
      this.prisma.lead.count({ where: { ...where, websiteIneligibilityReason: 'MARKETPLACE' } }),
      this.prisma.lead.count({ where: { ...where, websiteIneligibilityReason: 'MAP_PROVIDER' } }),
      this.prisma.lead.count({ where: { ...where, websiteIneligibilityReason: { in: ['BLACKLISTED_DOMAIN', 'OTHER_NON_COMPANY_SITE', 'INVALID_URL', 'SEARCH_ENGINE'] } } }),
      this.prisma.lead.count({ where: { ...where, enrichmentStatus: 'SUCCESS' } }),
      this.prisma.lead.count({ where: { ...where, auditStatus: 'SUCCESS' } }),
      this.prisma.lead.count({ where: { ...where, lighthouseReport: { isNot: null } } }),
      this.prisma.lead.count({ where: { ...where, visualAnalysis: { status: 'SUCCESS' } } }),
      this.prisma.lead.count({ where: { ...where, leadScoreV2: { not: null } } }),
      this.prisma.lead.count({ where: { ...where, manualReviewStatus: 'GOOD' } }),
      this.prisma.lead.count({ where: { ...where, redesignStage: 'SELECTED_FOR_REDESIGN' } }),
      this.prisma.lead.count({ where: { ...where, site: { isNot: null } } }),
      this.prisma.lead.count({ where: { ...where, auditStatus: 'FAILED' } })
    ]);
    return {
      runId: run.id,
      provider: run.provider,
      query: run.query,
      location: run.location,
      limit: run.limit,
      collected: run.collected,
      createdCount: run.createdCount,
      duplicateCount: run.duplicateCount,
      newLeadCount: run.createdCount,
      reusedLeadCount: run.duplicateCount,
      total,
      withWebsite,
      withoutWebsite,
      exclusions: {
        noWebsite,
        aggregator,
        directory,
        government,
        social,
        marketplace,
        mapProvider,
        otherIneligible,
      },
      enriched,
      audited,
      lighthoused,
      aiAnalyzed,
      scored,
      good,
      selected,
      generated,
      failed
    };
  }
}
