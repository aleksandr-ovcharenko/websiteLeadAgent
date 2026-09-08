import type { PrismaClient } from '@prisma/client';

export type SecurityGateStatus = 'HEALTHY' | 'ATTENTION' | 'HIGH_RISK' | 'BLOCKED';

export interface SecurityGateResult {
  status: SecurityGateStatus;
  openCritical: number;
  openHigh: number;
  openMedium: number;
  openLow: number;
  acceptedHigh: number;
  productionCritical: number;
  productionHigh: number;
  productionMedium: number;
  productionLow: number;
  blockedReason?: string;
  details: {
    total: Record<string, number>;
    production: Record<string, number>;
    dev: Record<string, number>;
    build: Record<string, number>;
    notReachable: Record<string, number>;
    unknown: Record<string, number>;
    reasoning: string[];
  };
}

function canonicalKey(f: { canonicalId?: string | null; id: string }): string {
  return f.canonicalId || f.id;
}

function isProductionBlocker(environment: string, reachability: string): boolean {
  return environment === 'RUNTIME' && reachability !== 'NOT_REACHABLE';
}

function distinctByCanonical<T extends { canonicalId?: string | null; id: string; severity: string }>(items: T[]): Record<string, number> {
  const seen = new Set<string>();
  const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const item of items) {
    const key = canonicalKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    const sev = item.severity || 'INFO';
    counts[sev] = (counts[sev] || 0) + 1;
  }
  return counts;
}

export async function evaluateSecurityGate(prisma: PrismaClient): Promise<SecurityGateResult> {
  const openFindings = await prisma.securityFinding.findMany({
    where: { status: { in: ['OPEN', 'FIXING'] } },
    select: { id: true, canonicalId: true, severity: true, environment: true, reachability: true },
  });

  const total = distinctByCanonical(openFindings);
  const productionFindings = openFindings.filter((f) => isProductionBlocker(String(f.environment), String(f.reachability)));
  const devFindings = openFindings.filter((f) => f.environment === 'DEV');
  const buildFindings = openFindings.filter((f) => f.environment === 'BUILD');
  const notReachableFindings = openFindings.filter((f) => f.reachability === 'NOT_REACHABLE');
  const unknownFindings = openFindings.filter((f) => f.environment === 'UNKNOWN' && f.reachability === 'UNKNOWN');

  const production = distinctByCanonical(productionFindings);
  const dev = distinctByCanonical(devFindings);
  const build = distinctByCanonical(buildFindings);
  const notReachable = distinctByCanonical(notReachableFindings);
  const unknown = distinctByCanonical(unknownFindings);

  const reasoning: string[] = [];

  const acceptedHigh = await prisma.securityFinding.count({
    where: { severity: 'HIGH', status: 'ACCEPTEDRISK' },
  });

  const gate: SecurityGateResult = {
    status: 'HEALTHY',
    openCritical: total.CRITICAL,
    openHigh: total.HIGH,
    openMedium: total.MEDIUM,
    openLow: total.LOW,
    acceptedHigh,
    productionCritical: production.CRITICAL,
    productionHigh: production.HIGH,
    productionMedium: production.MEDIUM,
    productionLow: production.LOW,
    details: {
      total,
      production,
      dev,
      build,
      notReachable,
      unknown,
      reasoning,
    },
  };

  if (production.CRITICAL > 0) {
    gate.status = 'BLOCKED';
    gate.blockedReason = `${production.CRITICAL} production-reachable CRITICAL finding(s)`;
    reasoning.push(`BLOCKED: ${production.CRITICAL} production-reachable CRITICAL finding(s)`);
  } else if (production.HIGH > 0) {
    gate.status = 'HIGH_RISK';
    gate.blockedReason = `${production.HIGH} production-reachable HIGH finding(s)`;
    reasoning.push(`HIGH_RISK: ${production.HIGH} production-reachable HIGH finding(s)`);
  } else if (production.MEDIUM > 0) {
    gate.status = 'ATTENTION';
    gate.blockedReason = `${production.MEDIUM} production-reachable MEDIUM finding(s)`;
    reasoning.push(`ATTENTION: ${production.MEDIUM} production-reachable MEDIUM finding(s)`);
  } else {
    gate.blockedReason = 'No production-reachable findings';
    reasoning.push('HEALTHY: no production-reachable findings');
    if (total.CRITICAL > 0 || total.HIGH > 0) {
      reasoning.push(`Note: ${total.CRITICAL + total.HIGH} non-production/open findings exist but do not block release`);
    }
  }

  // Scanner failures are tracked via audits and should not be HEALTHY if a required scan is missing/failed.
  const recentFailure = await prisma.securityAudit.findFirst({
    where: { status: 'FAILED' },
    orderBy: { completedAt: 'desc' },
    take: 1,
  });
  if (recentFailure) {
    if (gate.status === 'HEALTHY') {
      gate.status = 'ATTENTION';
    }
    gate.blockedReason = gate.blockedReason
      ? `${gate.blockedReason}; recent scanner failure: ${recentFailure.scanner}`
      : `Recent scanner failure: ${recentFailure.scanner}`;
    reasoning.push(`ATTENTION: recent scanner failure (${recentFailure.scanner})`);
  }

  await prisma.securityGate.create({
    data: {
      status: gate.status,
      openCritical: gate.openCritical,
      openHigh: gate.openHigh,
      openMedium: gate.openMedium,
      openLow: gate.openLow,
      acceptedHigh: gate.acceptedHigh,
      blockedReason: gate.blockedReason,
      details: gate.details as any,
    },
  });

  return gate;
}
