import type { Request, Response, NextFunction } from 'express';
import { isTrustedOrigin } from './trustedOrigin.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function requireJsonContentType(req: Request, res: Response, next: NextFunction) {
  if (!STATE_CHANGING.has(req.method)) {
    return next();
  }
  const ct = (req.get('content-type') || '').toLowerCase();
  // Multipart uploads are routed through multer, which is protected by cookies
  // and the multipart boundary; do not enforce JSON there.
  if (ct.includes('multipart/form-data')) {
    return next();
  }
  if (!ct.includes('application/json')) {
    res.status(400).json({ error: 'invalid_content_type' });
    return;
  }
  next();
}

export function originRefererCheck(req: Request, res: Response, next: NextFunction) {
  if (!STATE_CHANGING.has(req.method)) {
    return next();
  }

  const origin = req.get('origin');
  const referer = req.get('referer');

  // A state-changing request must declare a trusted public origin.
  // SameSite=Strict cookies already bind the session to the origin;
  // this middleware rejects cross-origin and spoofed requests.
  if (origin && isTrustedOrigin(origin)) {
    return next();
  }
  if (referer && isTrustedOrigin(referer)) {
    return next();
  }

  // If neither an Origin nor a Referer is present we cannot validate the
  // public provenance of the request. We reject rather than risk a CSRF.
  if (!origin && !referer) {
    res.status(403).json({ error: 'origin_missing' });
    return;
  }

  res.status(403).json({ error: 'origin_mismatch' });
}
