import 'dotenv/config';
import { createServer } from 'node:http';
import httpProxy from 'http-proxy';
import { selectTarget } from './selectTarget.js';

const PORT = Number(process.env.GATEWAY_PORT ?? 3000);
const isProduction = process.env.NODE_ENV === 'production';

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true
});

const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
};

if (isProduction) {
  securityHeaders['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
}

proxy.on('proxyRes', (_proxyRes, _req, res) => {
  for (const [k, v] of Object.entries(securityHeaders)) {
    const existing = res.getHeader(k);
    if (existing == null) res.setHeader(k, v);
  }
});

proxy.on('error', (err: any, _req: any, res: any) => {
  if (res && !res.headersSent && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'backend_unavailable', message: err?.message || 'upstream unreachable' }));
  }
});

const server = createServer((req, res) => {
  const original = req.url || '/';
  if (original.startsWith('/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'GATE' }));
    return;
  }
  const { target, url } = selectTarget(original);
  req.url = url;
  proxy.web(req, res, { target });
});

server.on('upgrade', (req, socket, head) => {
  const original = req.url || '/';
  if (original.startsWith('/__vite')) {
    proxy.ws(req, socket, head, { target: `http://localhost:${process.env.PLATFORM_WEB_PORT ?? 3004}` });
    return;
  }
  const { target, url } = selectTarget(original);
  req.url = url;
  proxy.ws(req, socket, head, { target });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[GATE] ready on http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
