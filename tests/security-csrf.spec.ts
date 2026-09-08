import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'node:http';
import { originRefererCheck, requireJsonContentType } from '../apps/dashboard/src/security/csrf.js';
import { isTrustedOrigin, getTrustedOrigins } from '../apps/dashboard/src/security/trustedOrigin.js';

const app = express();
app.use(express.json());
app.use(originRefererCheck);
app.use(requireJsonContentType);
app.post('/api/test', (_req, res) => res.json({ ok: true }));

let server: http.Server;
let port: number;

async function start(): Promise<void> {
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server.address() as any;
      port = typeof addr === 'string' ? 0 : addr.port;
      resolve();
    });
  });
}

async function stop(): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

async function post(options: { origin?: string; referer?: string; contentType?: string; body?: string }) {
  const headers: Record<string, string> = { 'Content-Type': options.contentType ?? 'application/json' };
  if (options.origin) headers.Origin = options.origin;
  if (options.referer) headers.Referer = options.referer;
  const res = await fetch(`http://localhost:${port}/api/test`, {
    method: 'POST',
    headers,
    body: options.body ?? '{}',
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

beforeAll(start);
afterAll(stop);

describe('Trusted origin resolution', () => {
  it('allows configured TRUSTED_ORIGINS', () => {
    const old = process.env.TRUSTED_ORIGINS;
    process.env.TRUSTED_ORIGINS = 'https://app.example.com,https://admin.example.com';
    expect(isTrustedOrigin('https://app.example.com/radar')).toBe(true);
    expect(isTrustedOrigin('https://admin.example.com/cms')).toBe(true);
    expect(isTrustedOrigin('https://evil.example.com/radar')).toBe(false);
    if (old === undefined) delete process.env.TRUSTED_ORIGINS; else process.env.TRUSTED_ORIGINS = old;
  });

  it('rejects scheme/host/port mismatches', () => {
    const old = process.env.TRUSTED_ORIGINS;
    process.env.TRUSTED_ORIGINS = 'https://app.example.com';
    expect(isTrustedOrigin('http://app.example.com')).toBe(false);
    expect(isTrustedOrigin('https://app.example.com:8443')).toBe(false);
    expect(isTrustedOrigin('https://appxexample.com')).toBe(false);
    if (old === undefined) delete process.env.TRUSTED_ORIGINS; else process.env.TRUSTED_ORIGINS = old;
  });

  it('exposes default localhost dev origins when unconfigured', () => {
    const list = getTrustedOrigins();
    expect(list).toContain('http://localhost:3000');
    expect(list).toContain('http://localhost:3004');
    expect(list).toContain('http://localhost:3333');
  });
});

describe('CSRF origin middleware', () => {
  it('allows trusted platform-web origin', async () => {
    const r = await post({ origin: 'http://localhost:3004', referer: 'http://localhost:3004/radar' });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).ok).toBe(true);
  });

  it('allows trusted gateway origin', async () => {
    const r = await post({ origin: 'http://localhost:3000', referer: 'http://localhost:3000/radar' });
    expect(r.status).toBe(200);
    expect(JSON.parse(r.body).ok).toBe(true);
  });

  it('denies an evil origin', async () => {
    const r = await post({ origin: 'https://evil.com', referer: 'https://evil.com/radar' });
    expect(r.status).toBe(403);
    expect(r.body).toMatch(/origin_mismatch/);
  });

  it('denies a spoofed host that is not in the trusted list', async () => {
    const r = await post({ origin: 'http://localhost:9999', referer: 'http://localhost:9999/radar' });
    expect(r.status).toBe(403);
    expect(r.body).toMatch(/origin_mismatch/);
  });

  it('rejects missing origin/referer', async () => {
    const r = await post({});
    expect(r.status).toBe(403);
    expect(r.body).toMatch(/origin_missing/);
  });

  it('rejects non-JSON state-changing requests', async () => {
    const r = await post({ origin: 'http://localhost:3000', contentType: 'text/plain', body: 'x' });
    expect(r.status).toBe(400);
    expect(r.body).toMatch(/invalid_content_type/);
  });
});
