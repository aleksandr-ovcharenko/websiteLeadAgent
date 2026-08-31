import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OperationService } from './OperationService.js';

const makePrisma = () => ({
  operationRun: {
    findFirst: vi.fn(async () => null),
    create: vi.fn(async (args: any) => ({ id: 'new-run', ...args.data })),
    update: vi.fn(async (args: any) => ({ id: args.where.id, status: 'RUNNING' })),
    findUnique: vi.fn(async () => null),
    updateMany: vi.fn(async () => ({ count: 0 })),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
  },
  operationEvent: {
    create: vi.fn(async (args: any) => ({ id: 'evt', ...args.data })),
    findMany: vi.fn(async () => []),
  },
  lead: {
    findUnique: vi.fn(async () => null),
    findMany: vi.fn(async () => []),
    update: vi.fn(async (args: any) => ({ id: args.where.id })),
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  visualAnalysis: {
    updateMany: vi.fn(async () => ({ count: 0 })),
  },
  $transaction: vi.fn(async (queries: any[]) => {
    const results: any[] = [];
    for (const q of queries) results.push(await q);
    return results;
  }),
} as any);

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any);
const makeDiscovery = () => ({} as any);
const makeActivity = () => ({
  log: vi.fn(async (x: any) => ({ id: 'act', ...x })),
  info: vi.fn(async (x: any) => ({ id: 'act', ...x })),
  warn: vi.fn(async (x: any) => ({ id: 'act', ...x })),
  error: vi.fn(async (x: any) => ({ id: 'act', ...x })),
  cleanup: vi.fn(async () => ({ count: 0 })),
} as any);

describe('OperationService', () => {
  let prisma = makePrisma();
  let logger = makeLogger();
  let activity = makeActivity();
  let service: OperationService;

  beforeEach(() => {
    prisma = makePrisma();
    logger = makeLogger();
    activity = makeActivity();
    service = new OperationService({
      prisma,
      logger,
      env: {},
      discovery: makeDiscovery(),
      activity,
    });
  });

  it('rejects duplicate active operations for the same lead', async () => {
    const active = { id: 'existing', operationId: 'RUN_VISUAL_ANALYSIS', leadId: 'lead-1', status: 'RUNNING' };
    prisma.operationRun.findFirst = vi.fn(async () => active);

    const result = await service.execute({
      operationId: 'RUN_VISUAL_ANALYSIS',
      leadId: 'lead-1',
      input: { leadId: 'lead-1' },
    });

    expect(result.run.id).toBe('existing');
    expect(result.alreadyActive).toBe(true);
    expect(prisma.operationRun.create).not.toHaveBeenCalled();
  });

  it('fails orphaned running and pending operations on reconcile', async () => {
    prisma.operationRun.updateMany = vi.fn(async (args: any) => ({ count: 3 }));
    await service.reconcileAll();
    expect(prisma.operationRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { status: { in: ['RUNNING', 'PENDING'] } },
    }));
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ count: 3 }), 'operation.reconcile.interrupted');
  });
});
