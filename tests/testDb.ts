import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

let counter = 0;

function parseBasePgUrl(): string {
  const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/minsk_lead_agent';
  // Strip query string for psql; set search_path via schema in Prisma URL.
  return url.replace(/\/([^/?]+)(\?.*)?$/, '/postgres');
}

function parsePrismaUrl(dbName: string): string {
  const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/minsk_lead_agent';
  return url.replace(/\/([^/?]+)(\?.*)?$/, `/${dbName}$2`);
}

export async function getTestPrisma(): Promise<PrismaClient> {
  const dbName = `wla_test_${process.pid}_${counter++}`;
  const testDbUrl = parsePrismaUrl(dbName);
  const baseUrl = parseBasePgUrl();
  try {
    execSync(`psql ${baseUrl} -c "DROP DATABASE IF EXISTS ${dbName};"`, { stdio: 'pipe' });
    execSync(`psql ${baseUrl} -c "CREATE DATABASE ${dbName};"`, { stdio: 'pipe' });
    execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: testDbUrl }, stdio: 'pipe' });
  } catch (e: any) {
    const stderr = e.stderr?.toString?.() || '';
    const stdout = e.stdout?.toString?.() || '';
    throw new Error(`Failed to prepare test database ${dbName}: ${e.message}\n${stdout}\n${stderr}`);
  }
  return new PrismaClient({ datasources: { db: { url: testDbUrl } } });
}
