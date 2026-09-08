import type { Request } from 'express';
import rateLimit from 'express-rate-limit';

export function getClientIp(req: Request): string {
  // Express' req.ip already honors trust proxy configuration; prefer it over
  // blindly trusting arbitrary public X-Forwarded-For headers.
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator(req: Request) {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
    return `${getClientIp(req)}:${email}`;
  },
  handler(_req, res, _next, options) {
    res.status(429).json({ error: 'too_many_attempts', retryAfter: Math.ceil(options.windowMs / 1000) });
  },
  message: { error: 'too_many_attempts' },
});

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator(req: Request) {
    return getClientIp(req);
  },
  handler(_req, res, _next, options) {
    res.status(429).json({ error: 'rate_limited', retryAfter: Math.ceil(options.windowMs / 1000) });
  },
});
