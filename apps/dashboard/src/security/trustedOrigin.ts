import type { Request } from 'express';

function isDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function getTrustedOrigins(): string[] {
  const configured = process.env.TRUSTED_ORIGINS || process.env.APP_ORIGIN || '';
  if (configured) {
    return configured.split(',').map((o) => o.trim()).filter(Boolean);
  }
  if (isDev()) {
    return [
      'http://localhost:3000',  // gateway
      'http://localhost:3004',  // platform web
      'http://localhost:3333',  // dashboard (direct)
      'http://localhost:3335',  // cms (direct)
      'http://localhost:3336',  // renderer (direct)
    ];
  }
  return [];
}

let _cache: string[] | undefined;
let _envHash: string | undefined;

function cached(): string[] {
  const env = (process.env.TRUSTED_ORIGINS || '') + (process.env.APP_ORIGIN || '') + process.env.NODE_ENV;
  if (_cache === undefined || _envHash !== env) {
    _cache = getTrustedOrigins();
    _envHash = env;
  }
  return _cache;
}

export function isTrustedOrigin(originOrReferer: string | undefined): boolean {
  if (!originOrReferer) return false;
  try {
    const u = new URL(originOrReferer);
    const check = `${u.protocol}//${u.host}`.toLowerCase();
    const trusted = cached();
    return trusted.some((o) => o.toLowerCase() === check);
  } catch {
    return false;
  }
}

export function getRequestOrigin(req: Request): string | undefined {
  return req.get('origin') || req.get('referer') || undefined;
}
