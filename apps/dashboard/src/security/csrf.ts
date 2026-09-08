import type { Request, Response, NextFunction } from 'express';

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
  const host = req.headers.host || '';

  // If the browser sends an Origin/Referer header, validate it matches the host.
  // Same-site requests with SameSite=Strict cookies are already protected; this
  // catches explicit cross-origin attempts and spoofed headers.
  const check = (value: string) => {
    try {
      const u = new URL(value);
      return u.host.toLowerCase() === host.toLowerCase();
    } catch {
      return false;
    }
  };

  if (origin && !check(origin)) {
    res.status(403).json({ error: 'origin_mismatch' });
    return;
  }

  if (referer && !check(referer)) {
    res.status(403).json({ error: 'referer_mismatch' });
    return;
  }

  next();
}
