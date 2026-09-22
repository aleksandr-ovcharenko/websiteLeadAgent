// V3.7.4 Phase 2/7/8 — revision store contract.
//
//   Site (one canonical client/CMS) → DesignVariant (visual style)
//     → SiteRevision (immutable build).
//
// Rules enforced here:
//   - retry continues the SAME revision (never a new Site, never a new version);
//   - regeneration creates the NEXT version of the same variant;
//   - REVIEW_READY/PUBLISHED promotion is atomic and requires DB-backed
//     screenshots for every required route;
//   - a failed revision never replaces the variant's activeRevisionId.

export type RevisionStatus = 'GENERATING' | 'QA_FAILED' | 'REVIEW_READY' | 'PUBLISHED' | 'ARCHIVED';

export interface RevisionRecord {
  id: string;
  siteId: string;
  variantId: string;
  version: number;
  basedOnRevisionId?: string | null;
  generatedByRunId?: string | null;
  contentHash?: string | null;
  status: RevisionStatus;
  failureReason?: string | null;
  currentStage?: string | null;
  stageCheckpoints?: { stage: string; startedAt: string; completedAt?: string; durationMs?: number }[];
  screenshots: { route: string; viewport: string }[];
  startedAt: string;
  completedAt?: string | null;
}

export interface RevisionStore {
  createOrResume(o: {
    siteId: string; variantId: string; runId: string; templateId: string;
    templateVersion?: string; resume?: boolean;
  }): Promise<{ revision: RevisionRecord; resumed: boolean; siteId: string }>;
  /** Heartbeat/checkpoint per stage; retry-safe (upsert by stage). */
  checkpoint(revisionId: string, stage: string, durationMs?: number): Promise<void>;
  fail(revisionId: string, reason: string, stage?: string): Promise<void>;
  addScreenshot(revisionId: string, shot: { route: string; viewport: string; storagePath: string; contentHash?: string }): Promise<void>;
  /** Atomic promotion — only when `requiredRoutes` have screenshots. */
  promote(revisionId: string, status: 'REVIEW_READY' | 'PUBLISHED', requiredRoutes?: string[]): Promise<RevisionRecord>;
  get(revisionId: string): Promise<RevisionRecord | null>;
}

const REQUIRED_VIEWPORTS = ['1440x900', '390x844'];

function assertScreenshotCoverage(rev: RevisionRecord, requiredRoutes: string[]) {
  // REVIEW_READY always requires at least the homepage at both viewports;
  // callers pass the full route manifest for complete coverage.
  const routes = requiredRoutes.length ? requiredRoutes : ['/'];
  const have = new Set((rev.screenshots || []).map((s) => `${s.route}@${s.viewport}`));
  const missing: string[] = [];
  for (const route of routes) {
    for (const vw of REQUIRED_VIEWPORTS) {
      if (!have.has(`${route}@${vw}`)) missing.push(`${route}@${vw}`);
    }
  }
  if (missing.length) {
    throw new Error(`REVIEW_READY requires DB screenshots; missing: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? ` +${missing.length - 6} more` : ''}`);
  }
}

/** In-memory store implementing the real contract — used by tests and as the
 *  reference implementation for the Prisma-backed store. */
export function createInMemoryRevisionStore(): RevisionStore & { revisions: Map<string, RevisionRecord> } {
  const revisions = new Map<string, RevisionRecord>();
  let seq = 0;
  const byVariant = (variantId: string) => [...revisions.values()].filter((r) => r.variantId === variantId).sort((a, b) => b.version - a.version);

  const store: RevisionStore & { revisions: Map<string, RevisionRecord> } = {
    revisions,
    async createOrResume(o) {
      // Retry semantics: same run + resume → continue the latest GENERATING
      // (or QA_FAILED) revision of this variant instead of making a new one.
      if (o.resume) {
        const latest = byVariant(o.variantId).find((r) => r.generatedByRunId === o.runId)
          || byVariant(o.variantId).find((r) => r.status === 'GENERATING' || r.status === 'QA_FAILED');
        if (latest) return { revision: latest, resumed: true, siteId: latest.siteId };
      }
      const prev = byVariant(o.variantId)[0];
      const rev: RevisionRecord = {
        id: `rev-${++seq}`,
        siteId: o.siteId,
        variantId: o.variantId,
        version: (prev?.version || 0) + 1,
        basedOnRevisionId: prev?.id || null,
        generatedByRunId: o.runId,
        status: 'GENERATING',
        stageCheckpoints: [],
        screenshots: [],
        startedAt: new Date().toISOString(),
      };
      revisions.set(rev.id, rev);
      return { revision: rev, resumed: false, siteId: o.siteId };
    },
    async checkpoint(revisionId, stage, durationMs) {
      const r = revisions.get(revisionId);
      if (!r) throw new Error(`revision ${revisionId} not found`);
      r.currentStage = stage;
      const cps = r.stageCheckpoints || (r.stageCheckpoints = []);
      const existing = cps.find((c) => c.stage === stage);
      if (existing) { existing.completedAt = new Date().toISOString(); existing.durationMs = durationMs; }
      else cps.push({ stage, startedAt: new Date().toISOString(), durationMs });
    },
    async fail(revisionId, reason, stage) {
      const r = revisions.get(revisionId);
      if (!r) throw new Error(`revision ${revisionId} not found`);
      r.status = 'QA_FAILED';
      r.failureReason = reason;
      if (stage) r.currentStage = stage;
      r.completedAt = new Date().toISOString();
    },
    async addScreenshot(revisionId, shot) {
      const r = revisions.get(revisionId);
      if (!r) throw new Error(`revision ${revisionId} not found`);
      r.screenshots.push({ route: shot.route, viewport: shot.viewport });
    },
    async promote(revisionId, status, requiredRoutes = []) {
      const r = revisions.get(revisionId);
      if (!r) throw new Error(`revision ${revisionId} not found`);
      if (r.status === 'QA_FAILED') throw new Error(`cannot promote QA_FAILED revision ${revisionId}`);
      if (status === 'REVIEW_READY' || status === 'PUBLISHED') assertScreenshotCoverage(r, requiredRoutes);
      r.status = status;
      r.completedAt = r.completedAt || new Date().toISOString();
      return r;
    },
    async get(revisionId) { return revisions.get(revisionId) || null; },
  };
  return store;
}

// ─── Prisma-backed store ────────────────────────────────────────────────────
// Same contract over SiteRevision/RevisionScreenshot. Promotion is atomic:
// REVIEW_READY requires screenshot rows covering the route manifest at both
// required viewports, and flips variant.activeRevisionId in one transaction.

export function createPrismaRevisionStore(prisma: any): RevisionStore {
  const nextVersion = async (variantId: string) =>
    ((await prisma.siteRevision.findFirst({ where: { variantId }, orderBy: { version: 'desc' }, select: { version: true } }))?.version || 0) + 1;

  return {
    async createOrResume(o) {
      if (o.resume) {
        const latest = await prisma.siteRevision.findFirst({
          where: { variantId: o.variantId, OR: [{ generatedByRunId: o.runId }, { status: { in: ['GENERATING', 'QA_FAILED'] } }] },
          orderBy: { version: 'desc' },
          include: { screenshots: true },
        });
        if (latest) {
          await prisma.siteRevision.update({
            where: { id: latest.id },
            data: { status: 'GENERATING', failureReason: null, completedAt: null, generatedByRunId: o.runId },
          });
          return { revision: latest, resumed: true, siteId: latest.siteId };
        }
      }
      const prev = await prisma.siteRevision.findFirst({ where: { variantId: o.variantId }, orderBy: { version: 'desc' }, select: { id: true, version: true } });
      const rev = await prisma.siteRevision.create({
        data: {
          siteId: o.siteId, variantId: o.variantId,
          version: (prev?.version || 0) + 1,
          basedOnRevisionId: prev?.id || null,
          generatedByRunId: o.runId,
          templateId: o.templateId, templateVersion: o.templateVersion || null,
          status: 'GENERATING',
        },
        include: { screenshots: true },
      });
      return { revision: rev, resumed: false, siteId: rev.siteId };
    },
    async checkpoint(revisionId, stage, durationMs) {
      const r = await prisma.siteRevision.findUnique({ where: { id: revisionId }, select: { stageCheckpoints: true } });
      const cps: any[] = Array.isArray(r?.stageCheckpoints) ? [...(r!.stageCheckpoints as any[])] : [];
      const existing = cps.find((c) => c.stage === stage);
      if (existing) { existing.completedAt = new Date().toISOString(); if (durationMs != null) existing.durationMs = durationMs; }
      else cps.push({ stage, startedAt: new Date().toISOString(), ...(durationMs != null ? { durationMs } : {}) });
      await prisma.siteRevision.update({ where: { id: revisionId }, data: { currentStage: stage as any, stageCheckpoints: cps } });
    },
    async fail(revisionId, reason, stage) {
      await prisma.siteRevision.update({
        where: { id: revisionId },
        data: { status: 'QA_FAILED', failureReason: reason, ...(stage ? { currentStage: stage as any } : {}), completedAt: new Date() },
      });
    },
    async addScreenshot(revisionId, shot) {
      await prisma.revisionScreenshot.create({
        data: {
          revisionId, route: shot.route, viewport: shot.viewport,
          storagePath: shot.storagePath, url: (shot as any).url || null,
          contentHash: shot.contentHash || null, buildId: (shot as any).buildId || null,
        },
      });
    },
    async promote(revisionId, status, requiredRoutes = []) {
      const rev = await prisma.siteRevision.findUnique({ where: { id: revisionId }, include: { screenshots: true } });
      if (!rev) throw new Error(`revision ${revisionId} not found`);
      if (rev.status === 'QA_FAILED') throw new Error(`cannot promote QA_FAILED revision ${revisionId}`);
      assertScreenshotCoverage(rev as any, requiredRoutes);
      // Atomic: revision status + variant.activeRevisionId in one transaction.
      const [updated] = await prisma.$transaction([
        prisma.siteRevision.update({ where: { id: revisionId }, data: { status, completedAt: rev.completedAt || new Date() }, include: { screenshots: true } }),
        prisma.demoVariant.update({ where: { id: rev.variantId }, data: { activeRevisionId: revisionId } }),
      ]);
      return updated as any;
    },
    async get(revisionId) {
      return prisma.siteRevision.findUnique({ where: { id: revisionId }, include: { screenshots: true } });
    },
  };
}
