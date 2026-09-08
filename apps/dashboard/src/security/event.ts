import type { PrismaClient } from '@prisma/client';

export type SecurityEventLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SecurityEventInput {
  level: SecurityEventLevel;
  category: string;
  source: string;
  actorType?: string;
  actorId?: string;
  target?: string;
  message: string;
  details?: Record<string, any>;
}

export class SecurityEventService {
  constructor(private prisma: PrismaClient) {}

  async log(input: SecurityEventInput): Promise<void> {
    await this.prisma.securityEvent.create({
      data: {
        level: input.level as any,
        category: input.category,
        source: input.source,
        actorType: input.actorType,
        actorId: input.actorId,
        target: input.target,
        message: input.message,
        details: input.details as any,
      },
    });
  }
}
