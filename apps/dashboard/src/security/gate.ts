import type { PrismaClient } from '@prisma/client';

export type SecurityGateStatus = 'HEALTHY' | 'ATTENTION' | 'HIGH_RISK' | 'BLOCKED';

export async function evaluateSecurityGate(prisma: PrismaClient): Promise<{
  status: SecurityGateStatus;
  openCritical: number;
  openHigh: number;
  openMedium: number;
  openLow: number;
  acceptedHigh: number;
  blockedReason?: string;
}> {
  const openFindings = await prisma.securityFinding.groupBy({
    by: ['severity', 'status'],
    where: { status: { in: ['OPEN', 'FIXING'] } },
    _count: { id: true },
  });

  const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const g of openFindings) {
    if (g.severity) counts[g.severity] = (counts[g.severity] || 0) + g._count.id;
  }

  const acceptedHigh = await prisma.securityFinding.count({
    where: { severity: 'HIGH', status: 'ACCEPTEDRISK' },
  });

  const gate: any = {
    status: 'HEALTHY',
    openCritical: counts.CRITICAL,
    openHigh: counts.HIGH,
    openMedium: counts.MEDIUM,
    openLow: counts.LOW,
    acceptedHigh,
  };

  if (counts.CRITICAL > 0) {
    gate.status = 'BLOCKED';
    gate.blockedReason = `${counts.CRITICAL} open CRITICAL finding(s)`;
  } else if (counts.HIGH > 0) {
    gate.status = 'HIGH_RISK';
    gate.blockedReason = `${counts.HIGH} open HIGH finding(s)`;
  } else if (counts.MEDIUM > 0) {
    gate.status = 'ATTENTION';
  }

  await prisma.securityGate.create({
    data: {
      status: gate.status,
      openCritical: gate.openCritical,
      openHigh: gate.openHigh,
      openMedium: gate.openMedium,
      openLow: gate.openLow,
      acceptedHigh,
      blockedReason: gate.blockedReason,
    },
  });

  return gate;
}
