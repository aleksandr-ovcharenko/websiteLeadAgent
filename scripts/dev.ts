import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';

const DEFAULTS: Record<string, string> = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/minsk_lead_agent?schema=public',
  SESSION_SECRET: 'dev-secret-change-me',
  PLATFORM_API_PORT: '3333',
  CMS_PORT: '3335',
  RENDERER_PORT: '3336',
  PLATFORM_WEB_PORT: '3004',
  GATEWAY_PORT: '3000'
};

for (const [k, v] of Object.entries(DEFAULTS)) {
  if (!process.env[k]) process.env[k] = v;
}

const args = process.argv.slice(2);
const noInfra = args.includes('--no-infra');
const only = args.find(a => a.startsWith('--only='))?.split('=')[1]?.trim() ?? 'full';
const skip = (args.find(a => a.startsWith('--skip='))?.split('=')[1] ?? '').split(',').filter(Boolean);
const help = args.includes('--help') || args.includes('-h');

const NODE_MAJOR = Number(process.versions.node.split('.')[0]);
const NODE_BIN = path.dirname(process.execPath);

function checkNode() {
  if (NODE_MAJOR < 22) {
    console.error(`\nWebsiteLeadAgent requires Node.js >= 22. Current: ${process.version}`);
    console.error('Run with: nvm use 22   (or your preferred Node 22 setup)\n');
    process.exit(1);
  }
}

if (help) {
  console.log(`
WebsiteLeadAgent dev launcher

Usage:
  npm run dev [-- <options>]

Options:
  --only=platform     Start platform web + API + gateway
  --only=cms          Start CMS + auth + gateway
  --only=renderer     Start renderer + gateway
  --skip=cms          Start full product except CMS
  --no-infra          Do not start/stop Docker PostgreSQL
  --help              Show this help

Examples:
  npm run dev
  npm run dev -- --only=platform
  npm run dev -- --skip=cms
`);
  process.exit(0);
}

function shouldStart(name: 'db' | 'platform-api' | 'cms' | 'renderer' | 'platform-web' | 'gateway') {
  if (name === 'db') return !noInfra;
  if (only === 'cms') return ['db','platform-api','cms','gateway'].includes(name);
  if (only === 'renderer') return ['db','renderer','gateway'].includes(name);
  if (only === 'platform') return ['db','platform-api','platform-web','gateway'].includes(name);
  if (skip.includes('cms') && name === 'cms') return false;
  return true;
}

const processes: { label: string; cp: ChildProcess }[] = [];
const pids = new Set<number>();

function log(label: string, data: Buffer | string) {
  const lines = String(data).split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;
    console.log(`[${label}] ${line}`);
  }
}

function run(label: string, cmd: string, args: string[], opts?: { cwd?: string; env?: NodeJS.ProcessEnv }) {
  const cp = spawn(cmd, args, {
    cwd: opts?.cwd ?? process.cwd(),
    env: {
      ...process.env,
      ...(opts?.env ?? {}),
      PATH: `${NODE_BIN}:${process.env.PATH}`
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  pids.add(cp.pid!);
  cp.stdout?.on('data', d => log(label, d));
  cp.stderr?.on('data', d => log(label, d));
  cp.on('exit', (code) => {
    pids.delete(cp.pid!);
    if (code !== 0 && code !== null) {
      console.error(`[${label}] exited with code ${code}`);
    }
  });
  processes.push({ label, cp });
  return cp;
}

function killAll() {
  for (const { cp, label } of processes) {
    console.log(`[dev] stopping ${label}...`);
    cp.kill('SIGTERM');
    setTimeout(() => { if (!cp.killed) cp.kill('SIGKILL'); }, 3000);
  }
}

process.on('SIGINT', () => {
  console.log('\n[dev] Ctrl+C received, shutting down...');
  killAll();
  setTimeout(() => process.exit(0), 3000);
});

async function waitForExit(cp: ChildProcess, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (cp.exitCode !== null) return cp.exitCode;
    await setTimeout(100);
  }
  cp.kill('SIGTERM');
  return -1;
}

async function waitForHealth(port: number, path: string, label: string, timeout = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const r = await fetch(`http://localhost:${port}${path}`);
      if (r.ok) return true;
    } catch {
      // not ready yet
    }
    await setTimeout(400);
  }
  throw new Error(`${label} did not become ready on port ${port}`);
}

function isDbReachable(timeout = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    const c = createConnection({ port: 5433, host: 'localhost' });
    let done = false;
    c.setTimeout(timeout);
    c.on('connect', () => { done = true; c.end(); resolve(true); });
    c.on('error', () => { if (!done) resolve(false); });
    c.on('timeout', () => { if (!done) resolve(false); c.destroy(); });
  });
}

async function startInfra() {
  if (!shouldStart('db')) return;
  if (await isDbReachable()) {
    console.log('[db] PostgreSQL already reachable on localhost:5433, skipping docker compose');
    return;
  }
  console.log('[db] starting PostgreSQL...');
  const up = run('db', 'docker', ['compose','up','-d','--no-recreate','db']);
  if ((await waitForExit(up, 60000)) !== 0) {
    throw new Error('docker compose up failed');
  }

  const start = Date.now();
  while (Date.now() - start < 60000) {
    const check = spawn('docker', ['compose','exec','-T','db','pg_isready','-U','postgres'], { stdio: 'pipe' });
    const code = await new Promise<number>((resolve) => {
      check.on('exit', (code) => resolve(code ?? 1));
      setTimeout(() => { check.kill(); resolve(1); }, 3000);
    });
    if (code === 0) {
      console.log('[db] ready');
      return;
    }
    await setTimeout(500);
  }
  throw new Error('PostgreSQL did not become healthy');
}

async function prepareDatabase() {
  console.log('[db] generating prisma client...');
  const generate = run('db', 'npx', ['prisma','generate']);
  if ((await waitForExit(generate, 120000)) !== 0) {
    throw new Error('prisma generate failed');
  }

  console.log('[db] pushing schema...');
  const push = run('db', 'npx', ['prisma','db','push','--accept-data-loss']);
  if ((await waitForExit(push, 120000)) !== 0) {
    throw new Error('prisma db push failed');
  }
}

async function buildTemplates() {
  if (existsSync('packages/templates/dist/index.js')) return;
  console.log('[templates] building...');
  const build = run('templates', 'npm', ['run','build','-w','@minsk/templates']);
  if ((await waitForExit(build, 120000)) !== 0) {
    throw new Error('template build failed');
  }
}

async function main() {
  if (!help) checkNode();
  console.log('WebsiteLeadAgent dev launcher\n');

  await startInfra();
  await prepareDatabase();
  await buildTemplates();

  if (shouldStart('platform-api')) {
    console.log('[platform-api] starting...');
    run('platform-api', 'npx', ['tsx','apps/dashboard/src/server.ts']);
    await waitForHealth(Number(process.env.PLATFORM_API_PORT), '/health', 'platform-api');
    console.log('[platform-api] ready');
  }

  if (shouldStart('cms')) {
    console.log('[cms] starting...');
    run('cms', 'npx', ['tsx','apps/cms/src/server.ts']);
    await waitForHealth(Number(process.env.CMS_PORT), '/health', 'cms');
    console.log('[cms] ready');
  }

  if (shouldStart('renderer')) {
    console.log('[renderer] starting...');
    run('renderer', 'npx', ['tsx','apps/site-renderer/src/server.ts']);
    await waitForHealth(Number(process.env.RENDERER_PORT), '/health', 'renderer');
    console.log('[renderer] ready');
  }

  if (shouldStart('platform-web')) {
    console.log('[platform-web] starting...');
    run('platform-web', 'npm', ['run','dev','-w','@minsk/platform']);
    await waitForHealth(Number(process.env.PLATFORM_WEB_PORT), '/', 'platform-web');
    console.log('[platform-web] ready');
  }

  if (shouldStart('gateway')) {
    console.log('[gateway] starting...');
    run('gateway', 'npx', ['tsx','apps/gateway/src/server.ts']);
    await waitForHealth(Number(process.env.GATEWAY_PORT), '/health', 'gateway');
    console.log('[gateway] ready');
  }

  console.log('\n---------------------------------');
  console.log('WebsiteLeadAgent');
  console.log(`http://localhost:${process.env.GATEWAY_PORT}`);
  console.log('\nLeads      → /leads');
  console.log('Sites      → /sites');
  console.log('CMS        → /cms?site=<siteId>');
  console.log('Preview    → /preview/<previewToken>');
  console.log('---------------------------------');
  console.log('\nPress Ctrl+C to stop applications.');
  console.log('PostgreSQL container is kept running for quick restarts.');
  console.log('Run `npm run infra:down` to stop it.\n');

  await new Promise(() => {});
}

main().catch((err) => {
  console.error('[dev] fatal:', err?.message || err);
  killAll();
  process.exit(1);
});
