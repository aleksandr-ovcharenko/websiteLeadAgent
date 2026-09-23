import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { auditLeadWebsite } from '../auditor/src/pipeline/auditLeadWebsite.js';

const prisma = new PrismaClient();
const logger = pino({ level: 'info' });
const leadId = 'cmthnoa78006gtnq37di8fi9z';
const website = 'https://mrs.by/filiali/remontno-stroitelniy-frunzenskogo-rayona/';

const runId = `manual-${Date.now()}`;
const events = [];

const result = await auditLeadWebsite({
  prisma,
  logger,
  runId,
  leadId,
  website,
  onActivity: async (e) => {
    events.push(e);
    console.log(`[${e.level}] ${e.module} ${e.eventType}: ${e.message}`);
  }
});

console.log('result', result);
console.log('events', JSON.stringify(events, null, 2));
await prisma.$disconnect();
