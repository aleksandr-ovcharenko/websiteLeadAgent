import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as chromeLauncher from 'chrome-launcher';

// tsx/esbuild keepNames injects __name calls into lighthouse page functions, but the
// evaluated browser string is missing the esbuild wrapper definition. Patch the
// BenchmarkIndex function to declare the wrapper before its first __name call.
let _lighthouse: any = null;
async function getLighthouse() {
  if (_lighthouse) return _lighthouse;
  const { default: lighthouse } = await import('lighthouse');
  _lighthouse = lighthouse;

  const { pageFunctions } = await import('lighthouse/core/lib/page-functions.js');
  const original = pageFunctions.computeBenchmarkIndex.toString.bind(pageFunctions.computeBenchmarkIndex);
  const originalString = original();
  const wrapperMatch = originalString.match(/\b([\w$]+)\([\w$]+,\s*["']/);
  const wrapperName = wrapperMatch ? wrapperMatch[1] : '__name';
  const wrapperDef = `var ${wrapperName}=(fn,value)=>Object.defineProperty(fn,"name",{value,configurable:true});`;
  pageFunctions.computeBenchmarkIndex.toString = () =>
    originalString.replace(/^\s*(function\s+[\w$]+\s*\(\)\s*\{)/, `$1${wrapperDef}`);
  return _lighthouse;
}

export interface LighthouseSummary {
  performance: number;
  accessibility: number;
  seo: number;
  bestPractices: number;
  lcp?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  tbt?: number;
}

export interface LighthouseErrorDetails {
  code: string;
  message: string;
  protocolMethod?: string;
  retryable: boolean;
  attempt: number;
  url: string;
  durationMs: number;
  safeTechnicalDetails?: Record<string, any>;
}

export class LighthouseError extends Error {
  code: string;
  protocolMethod?: string;
  retryable: boolean;
  attempt: number;
  url: string;
  durationMs: number;
  details?: Record<string, any>;

  constructor(opts: LighthouseErrorDetails) {
    super(opts.message);
    this.name = 'LighthouseError';
    this.code = opts.code;
    this.protocolMethod = opts.protocolMethod;
    this.retryable = opts.retryable;
    this.attempt = opts.attempt;
    this.url = opts.url;
    this.durationMs = opts.durationMs;
    this.details = opts.safeTechnicalDetails;
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      protocolMethod: this.protocolMethod,
      retryable: this.retryable,
      attempt: this.attempt,
      url: this.url,
      durationMs: this.durationMs,
      details: this.details,
      stack: this.stack,
    };
  }
}

function scoreToInt(score: number | null | undefined): number {
  if (score == null) return 0;
  return Math.round(score * 100);
}

function isRetryableError(err: any): boolean {
  if (err instanceof LighthouseError) return err.retryable;
  const text = String(err?.message ?? err).toLowerCase();
  const retryable =
    text.includes('protocol_timeout') ||
    text.includes('timeout') ||
    text.includes('protocol error') ||
    text.includes('target closed') ||
    text.includes('session closed') ||
    text.includes('browser disconnect') ||
    text.includes('socket hang up') ||
    text.includes('read econnreset') ||
    text.includes('worker exited') ||
    text.includes('watchdog timeout');
  return retryable;
}

function classifyError(err: any, url: string, attempt: number, durationMs: number): LighthouseError {
  const text = String(err?.message ?? err);
  const stack = err?.stack ? String(err.stack) : undefined;
  const lower = text.toLowerCase();
  let code = 'LIGHTHOUSE_FAILED';
  let protocolMethod: string | undefined;

  const protocolMatch = text.match(/protocolMethod[:\s]+(\S+)/) || stack?.match(/protocolMethod[:\s]+(\S+)/);
  if (protocolMatch) protocolMethod = protocolMatch[1];

  if (lower.includes('protocol_timeout')) {
    code = 'PROTOCOL_TIMEOUT';
    if (!protocolMethod) {
      const methodMatch = text.match(/Target\.\w+/) || stack?.match(/Target\.\w+/);
      if (methodMatch) protocolMethod = methodMatch[0];
    }
  } else if (lower.includes('watchdog timeout')) {
    code = 'WATCHDOG_TIMEOUT';
  } else if (lower.includes('target closed') || lower.includes('session closed')) {
    code = 'BROWSER_SESSION_CLOSED';
  } else if (lower.includes('browser disconnect')) {
    code = 'BROWSER_DISCONNECT';
  }

  return new LighthouseError({
    code,
    message: text,
    protocolMethod,
    retryable: isRetryableError(err),
    attempt,
    url,
    durationMs,
    safeTechnicalDetails: { stack: stack ? stack.split('\n').slice(0, 10) : undefined, original: err?.name },
  });
}

interface RunOnceInput {
  url: string;
  leadId: string;
  attempt: number;
  maxTimeMs?: number;
  maxWaitForLoad?: number;
  maxWaitForFcp?: number;
}

interface RunOnceResult {
  reportPath: string;
  summary: LighthouseSummary;
  durationMs: number;
  attempt: number;
}

export async function runLighthouseOnce(input: RunOnceInput): Promise<RunOnceResult> {
  const { url, leadId, attempt } = input;
  const outDir = join('data', 'lighthouse');
  await mkdir(outDir, { recursive: true });

  const chrome = await chromeLauncher.launch({
    chromeFlags: [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--allow-insecure-localhost'
    ]
  });

  const start = Date.now();
  const maxTimeMs = input.maxTimeMs ?? 120000;
  const maxWaitForLoad = input.maxWaitForLoad ?? 60000;
  const maxWaitForFcp = input.maxWaitForFcp ?? 30000;

  let watchdog: NodeJS.Timeout | undefined;
  try {
    const lighthouse = await getLighthouse();

    const race = Promise.race([
      lighthouse(url, {
        port: chrome.port,
        output: 'json',
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'seo', 'best-practices'],
        maxWaitForLoad,
        maxWaitForFcp,
      } as any),
      new Promise<never>((_, reject) => {
        watchdog = setTimeout(() => {
          reject(new Error('Lighthouse watchdog timeout: operation hung beyond maximum supported duration'));
        }, maxTimeMs);
      }),
    ]);

    const result: any = await race;
    clearTimeout(watchdog);

    const lhr = result?.lhr;
    const reportJson = result?.report;

    if (!lhr || !reportJson) {
      throw new Error('Lighthouse returned empty result');
    }

    if (lhr.runtimeError) {
      throw new Error(`Lighthouse runtime error: ${lhr.runtimeError.message} (code: ${lhr.runtimeError.code})`);
    }

    const summary: LighthouseSummary = {
      performance: scoreToInt(lhr.categories?.performance?.score),
      accessibility: scoreToInt(lhr.categories?.accessibility?.score),
      seo: scoreToInt(lhr.categories?.seo?.score),
      bestPractices: scoreToInt(lhr.categories?.['best-practices']?.score)
    };

    const audits = lhr.audits ?? {};
    const num = (id: string) => {
      const v = audits[id]?.numericValue;
      return typeof v === 'number' ? v : undefined;
    };

    summary.lcp = num('largest-contentful-paint');
    summary.cls = num('cumulative-layout-shift');
    summary.inp = num('interaction-to-next-paint');
    summary.fcp = num('first-contentful-paint');
    summary.tbt = num('total-blocking-time');

    const reportPath = join(outDir, `${leadId}.json`);
    await writeFile(reportPath, typeof reportJson === 'string' ? reportJson : JSON.stringify(reportJson), 'utf-8');

    const durationMs = Date.now() - start;
    return { reportPath, summary, durationMs, attempt };
  } catch (err: any) {
    if (watchdog) clearTimeout(watchdog);
    throw classifyError(err, url, attempt, Date.now() - start);
  } finally {
    try {
      await chrome.kill();
    } catch {
      // ignore; best-effort
    }
    // Defensive: ensure no stale Chrome remains if chrome-launcher failed to kill.
    try {
      if (chrome.pid) {
        process.kill(chrome.pid, 'SIGTERM');
      }
    } catch {
      // already gone
    }
  }
}

interface RunInput {
  leadId: string;
  url: string;
  retries?: number;
  maxTimeMs?: number;
  maxWaitForLoad?: number;
  maxWaitForFcp?: number;
}

function workerPath(): string {
  return fileURLToPath(new URL('./lighthouse.worker.ts', import.meta.url));
}

async function runWorkerOnce(input: RunOnceInput): Promise<RunOnceResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', workerPath()], {
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => { stdout += chunk; });
    child.stderr?.on('data', (chunk) => { stderr += chunk; });

    const timeout = setTimeout(() => {
      try { process.kill(-(child.pid!), 'SIGTERM'); } catch {}
      setTimeout(() => {
        try { process.kill(-(child.pid!), 'SIGKILL'); } catch {}
      }, 3000);
    }, (input.maxTimeMs ?? 120000) + 3000);

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    child.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0 && !stdout.trim()) {
        reject(new LighthouseError({
          code: 'WORKER_EXIT',
          message: `Lighthouse worker exited with code ${code}`,
          retryable: true,
          attempt: input.attempt,
          url: input.url,
          durationMs: 0,
        }));
        return;
      }
      const last = stdout.trim().split('\n').pop();
      try {
        const parsed = JSON.parse(last ?? '{}');
        if (parsed.ok) resolve(parsed.result as RunOnceResult);
        else {
          const err = Object.assign(new Error(parsed.error?.message ?? 'Worker error'), parsed.error ?? {});
          reject(err);
        }
      } catch {
        reject(new LighthouseError({
          code: 'WORKER_PARSE',
          message: `Lighthouse worker output was not valid JSON: ${stderr || stdout}`,
          retryable: true,
          attempt: input.attempt,
          url: input.url,
          durationMs: 0,
        }));
      }
    });

    child.stdin?.write(JSON.stringify(input));
    child.stdin?.end();
  });
}

export async function runLighthouseForLead(input: RunInput): Promise<RunOnceResult> {
  const { leadId, url, retries = 2, maxTimeMs, maxWaitForLoad, maxWaitForFcp } = input;
  const maxAttempts = retries + 1;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await runWorkerOnce({
        url,
        leadId,
        attempt,
        maxTimeMs,
        maxWaitForLoad,
        maxWaitForFcp,
      });
      return result;
    } catch (err: any) {
      lastError = err;
      if (attempt >= maxAttempts) break;
      if (!isRetryableError(err)) break;
      // Short backoff before a fresh attempt with a fresh worker and fresh Chrome.
      await new Promise((r) => setTimeout(r, Math.min(attempt * 1000, 3000)));
    }
  }

  if (lastError instanceof LighthouseError) throw lastError;
  throw classifyError(lastError, url, maxAttempts, 0);
}
