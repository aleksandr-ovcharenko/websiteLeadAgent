import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { requireAuth } from '../auth.js';
import { requirePermission } from './authz.js';
import { SecurityAuditService } from './audit.js';
import { evaluateSecurityGate } from './gate.js';
import { SecurityEventService } from './event.js';

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

interface SecurityApiOptions {
  prisma: PrismaClient;
  repoRoot: string;
}

export async function seedSecurityScannerConfigs(prisma: PrismaClient): Promise<void> {
  const configs = [
    { scanner: 'npm-audit', category: 'dependency', enabled: true, schedule: 'every-pr', config: { path: 'package-lock.json' } },
    { scanner: 'osv-scanner', category: 'dependency', enabled: false, schedule: 'hourly', config: { batchSize: 100 } },
    { scanner: 'detect-secrets', category: 'secrets', enabled: true, schedule: 'every-pr', config: {} },
    { scanner: 'wla-sast', category: 'sast', enabled: true, schedule: 'every-pr', config: {} },
    { scanner: 'trivy', category: 'container', enabled: false, schedule: 'on-deploy', config: {} },
  ];
  for (const c of configs) {
    await prisma.securityScannerConfig.upsert({
      where: { scanner: c.scanner },
      update: {},
      create: c,
    });
  }
}

export function securityRouter(opts: SecurityApiOptions): Router {
  const { prisma, repoRoot } = opts;
  const audit = new SecurityAuditService({ prisma, logger, repoRoot });
  const events = new SecurityEventService(prisma);

  const r = Router();
  const canReadSecurity = requirePermission(prisma, 'security.read');
  const canManageSecurity = requirePermission(prisma, 'security.manage');

  r.use(requireAuth);

  r.get('/overview', canReadSecurity, async (_req: Request, res: Response) => {
    const [counts, gate, products, recentAudits] = await Promise.all([
      prisma.securityFinding.groupBy({
        by: ['severity', 'status'],
        _count: { id: true },
      }),
      prisma.securityGate.findFirst({ orderBy: { evaluatedAt: 'desc' } }),
      prisma.securityFinding.groupBy({ by: ['product'], _count: { id: true } }),
      prisma.securityAudit.findMany({ take: 5, orderBy: { startedAt: 'desc' }, select: { id: true, scanner: true, status: true, startedAt: true, completedAt: true } }),
    ]);
    res.json({ counts, products, gate, recentAudits });
  });

  r.get('/gate', canReadSecurity, async (_req: Request, res: Response) => {
    const gate = await prisma.securityGate.findFirst({ orderBy: { evaluatedAt: 'desc' } });
    res.json(gate || { status: 'HEALTHY' });
  });

  r.get('/audits', canReadSecurity, async (req: Request, res: Response) => {
    const take = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const skip = parseInt(req.query.offset as string) || 0;
    const where: any = {};
    if (req.query.scanner) where.scanner = req.query.scanner as string;
    if (req.query.category) where.category = req.query.category as string;
    const [items, total] = await Promise.all([
      prisma.securityAudit.findMany({ where, skip, take, orderBy: { startedAt: 'desc' } }),
      prisma.securityAudit.count({ where }),
    ]);
    res.json({ items, total });
  });

  r.post('/audits/run', canManageSecurity, async (req: Request, res: Response) => {
    const { scanner, category } = req.body || {};
    try {
      const { results, gate } = await audit.runAll({ scanner, category, commitSha: '' });
      await events.log({
        level: 'MEDIUM',
        category: 'audit_run',
        source: 'manual',
        actorType: 'user',
        actorId: (req as any).user?.id,
        target: 'security-audit',
        message: `Manual security audit run completed with ${results.length} scanner(s)`,
        details: { scanner, category, gate },
      });
      res.json({ results: results.map((r: any) => ({ id: r.id, scanner: r.scanner, status: r.status, completedAt: r.completedAt })), gate });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  r.get('/findings', canReadSecurity, async (req: Request, res: Response) => {
    const take = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const skip = parseInt(req.query.offset as string) || 0;
    const where: any = {};
    if (req.query.severity) where.severity = req.query.severity;
    if (req.query.status) where.status = req.query.status;
    if (req.query.category) where.category = req.query.category;
    if (req.query.product) where.product = req.query.product;
    if (req.query.scanner) where.scanner = req.query.scanner;
    if (req.query.cve) where.cve = { contains: req.query.cve as string };
    const [items, total] = await Promise.all([
      prisma.securityFinding.findMany({ where, skip, take, orderBy: { lastDetectedAt: 'desc' }, include: { dependency: true, affects: { take: 20 } } }),
      prisma.securityFinding.count({ where }),
    ]);
    res.json({ items, total });
  });

  r.get('/findings/:id', canReadSecurity, async (req: Request, res: Response) => {
    const finding = await prisma.securityFinding.findUnique({
      where: { id: req.params.id },
      include: { dependency: true, affects: true, audit: true },
    });
    if (!finding) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(finding);
  });

  r.patch('/findings/:id', canManageSecurity, async (req: Request, res: Response) => {
    const { status, remediationNote, acceptedBy, assignedTo } = req.body || {};
    if (!status) { res.status(400).json({ error: 'missing_status' }); return; }
    const data: any = { status, remediationNote, assignedTo };
    if (status === 'ACCEPTEDRISK') {
      data.acceptedBy = acceptedBy || (req as any).user?.email;
      data.acceptedAt = new Date();
    }
    const finding = await prisma.securityFinding.update({ where: { id: req.params.id }, data });
    await events.log({
      level: 'MEDIUM',
      category: 'finding_status_change',
      source: 'security-center',
      actorType: 'user',
      actorId: (req as any).user?.id,
      target: finding.id,
      message: `Finding marked ${status}`,
      details: { status },
    });
    res.json(finding);
  });

  r.get('/dependencies', canReadSecurity, async (req: Request, res: Response) => {
    const take = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const skip = parseInt(req.query.offset as string) || 0;
    const where: any = {};
    if (req.query.name) where.name = { contains: req.query.name as string };
    if (req.query.ecosystem) where.ecosystem = req.query.ecosystem;
    const [items, total] = await Promise.all([
      prisma.securityDependency.findMany({ where, skip, take, orderBy: { lastCheckedAt: 'desc' }, include: { _count: { select: { findings: true } } } }),
      prisma.securityDependency.count({ where }),
    ]);
    res.json({ items, total });
  });

  r.get('/dependencies/:id', canReadSecurity, async (req: Request, res: Response) => {
    const dep = await prisma.securityDependency.findUnique({
      where: { id: req.params.id },
      include: { findings: { include: { affects: true } }, snapshots: { include: { snapshot: true } } },
    });
    if (!dep) { res.status(404).json({ error: 'not_found' }); return; }
    res.json(dep);
  });

  r.get('/events', canReadSecurity, async (req: Request, res: Response) => {
    const take = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const skip = parseInt(req.query.offset as string) || 0;
    const where: any = {};
    if (req.query.category) where.category = req.query.category;
    if (req.query.level) where.level = req.query.level;
    const [items, total] = await Promise.all([
      prisma.securityEvent.findMany({ where, skip, take, orderBy: { timestamp: 'desc' } }),
      prisma.securityEvent.count({ where }),
    ]);
    res.json({ items, total });
  });

  r.get('/scanner-configs', canReadSecurity, async (_req: Request, res: Response) => {
    const items = await prisma.securityScannerConfig.findMany({ orderBy: { scanner: 'asc' } });
    res.json(items);
  });

  r.patch('/scanner-configs/:id', canManageSecurity, async (req: Request, res: Response) => {
    const { enabled, schedule, config } = req.body || {};
    const item = await prisma.securityScannerConfig.update({
      where: { id: req.params.id },
      data: { enabled, schedule, config },
    });
    res.json(item);
  });

  return r;
}
