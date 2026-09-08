export function getSessionSecret(): string {
  const raw = process.env.SESSION_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (raw === 'dev-secret-change-me') {
      throw new Error('SESSION_SECRET cannot use the default development value in production.');
    }
    if (!raw || raw.length < 32) {
      throw new Error(
        "SESSION_SECRET must be set to a strong secret of at least 32 characters in production. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    return raw;
  }

  if (!raw || raw.length < 32) {
    if (raw === 'dev-secret-change-me') {
      console.warn('[SECURITY] SESSION_SECRET is using the default development value. Set a strong secret for any non-local deployment.');
    } else if (raw) {
      console.warn('[SECURITY] SESSION_SECRET is shorter than 32 characters. Use a stronger secret for any non-local deployment.');
    } else {
      console.warn('[SECURITY] SESSION_SECRET is not set; using a random per-process secret. Set a persistent strong secret for any non-local deployment.');
    }
  }

  if (raw && raw.length >= 8) return raw;
  return 'dev-secret-change-me';
}

export function getCookieSessionOptions(): any {
  const isProduction = process.env.NODE_ENV === 'production';
  const isTest = process.env.NODE_ENV === 'test';

  return {
    name: isProduction ? '__Host-pla.sid' : 'pla.sid',
    keys: [getSessionSecret()],
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : (isTest ? 'strict' : 'lax'),
    maxAge: 1000 * 60 * 60 * 24,
  };
}
