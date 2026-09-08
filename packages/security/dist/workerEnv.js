const ALWAYS_REQUIRED = new Set([
    'PATH',
    'HOME',
    'USER',
    'SHELL',
    'NODE_ENV',
    'LOG_LEVEL',
    'LANG',
    'TZ',
    'TMPDIR',
    'TEMP',
    'TMP',
]);
const ALLOWED_PREFIXES = [
    'CONCURRENCY_',
    'PLAYWRIGHT_',
    'CHROME_',
    'GEMINI_',
    'OPENAI_',
    'AI_',
    'DGIS_',
    'SERPAPI_',
    'ANTHROPIC_',
    'COHERE_',
];
const ALLOWED_KEYS = new Set([
    'DATABASE_URL',
    'GEMINI_API_KEY',
    'GEMINI_MODEL',
    'GEMINI_API_URL',
    'GEMINI_SEMANTIC_CACHE',
    'GEMINI_SEMANTIC_LOG',
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'AI_PROVIDER',
    'DGIS_API_KEY',
    'SERPAPI_API_KEY',
    'ANTHROPIC_API_KEY',
    'COHERE_API_KEY',
    'PLAYWRIGHT_CHROMIUM_PATH',
    'PLAYWRIGHT_CHROMIUM_NO_SANDBOX',
    'CHROME_NO_SANDBOX',
    'SESSION_SECRET',
]);
export function sanitizeWorkerEnv(source = process.env) {
    const out = {};
    for (const [key, value] of Object.entries(source)) {
        if (value === undefined)
            continue;
        if (ALWAYS_REQUIRED.has(key) || ALLOWED_KEYS.has(key)) {
            out[key] = value;
            continue;
        }
        if (ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            out[key] = value;
        }
    }
    return out;
}
