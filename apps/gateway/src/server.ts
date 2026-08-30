import 'dotenv/config';
import { createServer } from 'node:http';
import httpProxy from 'http-proxy';
import { selectTarget } from './selectTarget.js';

const PORT = Number(process.env.GATEWAY_PORT ?? 3000);

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true
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
