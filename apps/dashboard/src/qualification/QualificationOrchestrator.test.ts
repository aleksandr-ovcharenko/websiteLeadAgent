import { describe, it, expect, vi } from 'vitest';
import { QualificationOrchestrator } from './QualificationOrchestrator.js';

function makePrisma(lead: any, active: any[] = []) {
  return {
    lead: { findUnique: vi.fn(async () => lead) },
    operationRun: { findMany: vi.fn(async () => active) },
  } as any;
}

function makeActivity() {
  return { log: vi.fn() } as any;
}

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
}

function makeOperations() {
  return {
    execute: vi.fn(async ({ operationId }: any) => ({ run: { id: `run-${operationId}` }, alreadyActive: false })),
  } as any;
}

const baseLead = {
  id: 'lead-1',
  website: 'https://example.com',
  websiteStatus: 'FOUND',
  auditStatus: 'PENDING',
  scoreStatus: 'PENDING',
  enrichmentStatus: 'PENDING',
  lighthouseReport: null,
  visualAnalysis: null,
};

describe('QualificationOrchestrator', () => {
  it('starts AUDIT_WEBSITE when audit is PENDING and no active operations', async () => {
    const prisma = makePrisma(baseLead);
    const orchestrator = new QualificationOrchestrator({
      operations: makeOperations(),
      prisma,
      logger: makeLogger(),
      activity: makeActivity(),
    });

    const result = await orchestrator.advance('lead-1');
    expect(result.started).not.toBeNull();
    expect(result.started?.operationId).toBe('AUDIT_WEBSITE');
    expect(prisma.lead.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'lead-1' } }));
  });

  it('does nothing when an audit operation is already active', async () => {
    const prisma = makePrisma(baseLead, [{ id: 'op-1', operationId: 'AUDIT_WEBSITE', status: 'RUNNING' }]);
    const ops = makeOperations();
    const orchestrator = new QualificationOrchestrator({ operations: ops, prisma, logger: makeLogger(), activity: makeActivity() });

    const result = await orchestrator.advance('lead-1');
    expect(result.started).toBeNull();
    expect(ops.execute).not.toHaveBeenCalled();
  });

  it('starts RUN_LIGHTHOUSE after successful audit', async () => {
    const lead = { ...baseLead, auditStatus: 'SUCCESS' };
    const prisma = makePrisma(lead);
    const orchestrator = new QualificationOrchestrator({
      operations: makeOperations(),
      prisma,
      logger: makeLogger(),
      activity: makeActivity(),
    });

    const result = await orchestrator.advance('lead-1');
    expect(result.started?.operationId).toBe('RUN_LIGHTHOUSE');
  });

  it('starts RUN_VISUAL_ANALYSIS after lighthouse exists', async () => {
    const lead = { ...baseLead, auditStatus: 'SUCCESS', lighthouseReport: { id: 'lh-1' } };
    const prisma = makePrisma(lead);
    const orchestrator = new QualificationOrchestrator({
      operations: makeOperations(),
      prisma,
      logger: makeLogger(),
      activity: makeActivity(),
    });

    const result = await orchestrator.advance('lead-1');
    expect(result.started?.operationId).toBe('RUN_VISUAL_ANALYSIS');
  });

  it('starts RECALCULATE_SCORE after visual success', async () => {
    const lead = { ...baseLead, auditStatus: 'SUCCESS', lighthouseReport: { id: 'lh-1' }, visualAnalysis: { status: 'SUCCESS' } };
    const prisma = makePrisma(lead);
    const orchestrator = new QualificationOrchestrator({
      operations: makeOperations(),
      prisma,
      logger: makeLogger(),
      activity: makeActivity(),
    });

    const result = await orchestrator.advance('lead-1');
    expect(result.started?.operationId).toBe('RECALCULATE_SCORE');
  });

  it('stops progression on failed audit', async () => {
    const lead = { ...baseLead, auditStatus: 'FAILED' };
    const prisma = makePrisma(lead);
    const ops = makeOperations();
    const orchestrator = new QualificationOrchestrator({ operations: ops, prisma, logger: makeLogger(), activity: makeActivity() });

    const result = await orchestrator.advance('lead-1');
    expect(result.started).toBeNull();
    expect(result.ok).toBe(false);
    expect(ops.execute).not.toHaveBeenCalled();
  });
});
