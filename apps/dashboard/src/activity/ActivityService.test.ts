import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActivityService } from './ActivityService.js';

const makePrisma = () => ({
  activityEvent: {
    create: vi.fn(async (args: any) => ({ id: 'evt1', ...args.data })),
    findMany: vi.fn(async () => [] as any[]),
    deleteMany: vi.fn(async () => ({ count: 0 })),
    count: vi.fn(async () => 0),
  },
  lead: { findUnique: vi.fn(async () => null) },
  site: { findUnique: vi.fn(async () => null) },
  demoVariant: { findUnique: vi.fn(async () => null) },
} as any);

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any);

describe('ActivityService', () => {
  let prisma = makePrisma();
  let logger = makeLogger();
  let service: ActivityService;

  beforeEach(() => {
    prisma = makePrisma();
    logger = makeLogger();
    service = new ActivityService({ prisma, logger });
  });

  it('logs a normalized event', async () => {
    await service.info({
      module: 'AUDIT',
      eventType: 'AUDIT_STARTED',
      message: 'Auditing website',
      runId: 'run-1',
      leadId: 'lead-1',
      details: { website: 'https://example.com' },
    });

    const call = prisma.activityEvent.create.mock.calls[0][0];
    expect(call.data.module).toBe('AUDIT');
    expect(call.data.eventType).toBe('AUDIT_STARTED');
    expect(call.data.message).toBe('Auditing website');
    expect(call.data.runId).toBe('run-1');
    expect(call.data.leadId).toBe('lead-1');
  });

  it('normalizes Playwright missing browser error', async () => {
    await service.error({
      module: 'AUDIT',
      eventType: 'BROWSER_LAUNCH',
      message: 'Audit failed',
      error: new Error("Executable doesn't exist at /playwright/chromium"),
      runId: 'run-1',
    });

    const call = prisma.activityEvent.create.mock.calls[0][0];
    expect(call.data.errorCode).toBe('PLAYWRIGHT_BROWSER_MISSING');
    expect(call.data.errorMessage).toBe('Chromium browser is not installed.');
    expect(call.data.rawError).toContain("Executable doesn't exist");
  });

  it('emits live events to subscribers', async () => {
    const listener = vi.fn();
    const unsubscribe = service.subscribe(listener);

    await service.info({
      module: 'FACTORY',
      message: 'Site generation completed',
    });

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ module: 'FACTORY' }));
    unsubscribe();
  });
});
