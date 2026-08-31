export interface NormalizedError {
  code: string;
  friendlyMessage: string;
  rawMessage: string;
  stack?: string;
  action?: string;
}

const PATTERNS: { code: string; test: (message: string) => boolean; friendly: string; action?: string }[] = [
  {
    code: 'PLAYWRIGHT_BROWSER_MISSING',
    test: (m) => /Executable doesn't exist at|chromium.*not.*install|playwright.*chromium|browserType\.launch/i.test(m),
    friendly: 'Chromium browser is not installed.',
    action: 'Run: npm run setup:browsers',
  },
  {
    code: 'LIGHTHOUSE_BROWSER_MISSING',
    test: (m) => /chrome.*not.*found|chromium.*lighthouse|no.*chrome.*binary/i.test(m),
    friendly: 'Chrome/Chromium required by Lighthouse is unavailable.',
    action: 'Run: npm run setup:browsers',
  },
  {
    code: 'SOURCE_TIMEOUT',
    test: (m) => /page\.goto.*timeout|navigation.*timeout|net::ERR_CONNECTION_TIMED_OUT|ETIMEDOUT/i.test(m),
    friendly: 'Source website did not respond before timeout.',
  },
  {
    code: 'SOURCE_DNS_FAILED',
    test: (m) => /net::ERR_NAME_NOT_RESOLVED|getaddrinfo.*ENOTFOUND|DNS.*lookup/i.test(m),
    friendly: 'Could not resolve source website hostname.',
  },
  {
    code: 'AI_RATE_LIMIT',
    test: (m) => /rate limit|too many requests|429|insufficient_quota/i.test(m),
    friendly: 'AI provider rate limit reached. The operation can be retried later.',
  },
  {
    code: 'AI_PROVIDER_ERROR',
    test: (m) => /ai.*provider|gemini.*error|openai.*error|vision.*provider/i.test(m),
    friendly: 'AI provider returned an error.',
  },
  {
    code: 'MEDIA_DOWNLOAD_FAILED',
    test: (m) => /download.*fail|media.*download|fetch.*image/i.test(m),
    friendly: 'Media asset download failed.',
  },
  {
    code: 'CMS_IMPORT_FAILED',
    test: (m) => /cms.*import|importToCms|import.*fail/i.test(m),
    friendly: 'CMS import failed.',
  },
  {
    code: 'RENDER_FAILED',
    test: (m) => /render.*fail|showcase.*render|site.*render/i.test(m),
    friendly: 'Showcase render failed.',
  },
  {
    code: 'DATABASE_UNAVAILABLE',
    test: (m) => /database.*connect|prisma.*connect|ECONNREFUSED.*5432|connection.*postgres/i.test(m),
    friendly: 'Database is unavailable.',
  },
];

export function normalizeError(error: unknown): NormalizedError {
  const err = error instanceof Error ? error : new Error(String(error));
  const rawMessage = err.message || 'Unknown error';
  const stack = err.stack || '';

  for (const pattern of PATTERNS) {
    if (pattern.test(rawMessage)) {
      return {
        code: pattern.code,
        friendlyMessage: pattern.friendly,
        rawMessage,
        stack,
        action: pattern.action,
      };
    }
  }

  return {
    code: 'UNKNOWN_ERROR',
    friendlyMessage: rawMessage,
    rawMessage,
    stack,
  };
}
