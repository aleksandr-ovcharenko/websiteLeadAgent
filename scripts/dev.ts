import 'dotenv/config';
import { spawn, type ChildProcess } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import path from 'node:path';
import { chromium } from 'playwright';

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

const PRODUCT_NAMES: Record<string, string> = {
  db: 'POSTGRES',
  'platform-api': 'CORE',
  cms: 'STUDIO',
  renderer: 'ENGINE',
  'platform-web': 'HUB',
  gateway: 'GATE',
  factory: 'FACTORY'
};

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

function installChromium(): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log('[PLAYWRIGHT] Installing Chromium...');
    const cp = spawn('npx', ['playwright', 'install', 'chromium'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit'
    });
    cp.on('error', reject);
    cp.on('exit', (code) => resolve(code ?? 1));
  });
}

async function checkChromium() {
  try {
    const executable = chromium.executablePath();
    if (!existsSync(executable)) throw new Error('missing');
    console.log(`[PLAYWRIGHT] Chromium found at ${executable}`);
  } catch {
    console.log('[PLAYWRIGHT] Chromium is missing, installing...');
    const code = await installChromium();
    if (code !== 0) {
      console.error('\n[PLAYWRIGHT] Chromium installation failed.');
      console.error('Run manually: npm run setup:browsers\n');
      process.exit(1);
    }
    // Re-check after installation
    const executable = chromium.executablePath();
    if (!existsSync(executable)) {
      console.error('\n[PLAYWRIGHT] Chromium still not found after install.');
      process.exit(1);
    }
    console.log(`[PLAYWRIGHT] Chromium installed at ${executable}`);
  }
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
    console.log('[POSTGRES] already reachable on localhost:5433, skipping docker compose');
    return;
  }
  console.log('[POSTGRES] starting PostgreSQL...');
  const up = run('POSTGRES', 'docker', ['compose','up','-d','--no-recreate','db']);
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
  console.log('[POSTGRES] generating prisma client...');
  const generate = run('POSTGRES', 'npx', ['prisma','generate']);
  if ((await waitForExit(generate, 120000)) !== 0) {
    throw new Error('prisma generate failed');
  }

  console.log('[POSTGRES] pushing schema...');
  const push = run('POSTGRES', 'npx', ['prisma','db','push','--accept-data-loss']);
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

  await checkChromium();
  await startInfra();
  await prepareDatabase();
  await buildTemplates();

  if (shouldStart('platform-api')) {
    console.log('[CORE] starting...');
    run('CORE', 'npx', ['tsx','apps/dashboard/src/server.ts']);
    await waitForHealth(Number(process.env.PLATFORM_API_PORT), '/health', 'CORE');
    console.log('[CORE] ready');
  }

  if (shouldStart('cms')) {
    console.log('[STUDIO] starting...');
    run('STUDIO', 'npx', ['tsx','apps/cms/src/server.ts']);
    await waitForHealth(Number(process.env.CMS_PORT), '/health', 'STUDIO');
    console.log('[STUDIO] ready');
  }

  if (shouldStart('renderer')) {
    console.log('[ENGINE] starting...');
    run('ENGINE', 'npx', ['tsx','apps/site-renderer/src/server.ts']);
    await waitForHealth(Number(process.env.RENDERER_PORT), '/health', 'ENGINE');
    console.log('[ENGINE] ready');
  }

  if (shouldStart('platform-web')) {
    console.log('[HUB] starting...');
    run('HUB', 'npm', ['run','dev','-w','@minsk/platform']);
    await waitForHealth(Number(process.env.PLATFORM_WEB_PORT), '/', 'HUB');
    console.log('[HUB] ready');
  }

  if (shouldStart('gateway')) {
    console.log('[GATE] starting...');
    run('GATE', 'npx', ['tsx','apps/gateway/src/server.ts']);
    await waitForHealth(Number(process.env.GATEWAY_PORT), '/health', 'GATE');
    console.log('[GATE] ready');
  }

  console.log('\n----------------------------------------');
  console.log('WebsiteLeadAgent');
  console.log('');
  console.log(`Hub       http://localhost:${process.env.GATEWAY_PORT}`);
  console.log(`Radar     http://localhost:${process.env.GATEWAY_PORT}/radar`);
  console.log(`Forge     http://localhost:${process.env.GATEWAY_PORT}/forge`);
  console.log(`Studio    http://localhost:${process.env.GATEWAY_PORT}/studio/<siteId>`);
  console.log(`Showcase  http://localhost:${process.env.GATEWAY_PORT}/showcase/<previewToken>`);
  console.log('----------------------------------------');
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
