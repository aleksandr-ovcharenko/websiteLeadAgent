import 'dotenv/config';
import { createServer } from 'node:http';
import httpProxy from 'http-proxy';

const PORT = Number(process.env.GATEWAY_PORT ?? 3000);

const targets = {
  platformApi: `http://localhost:${process.env.PLATFORM_API_PORT ?? 3333}`,
  cms: `http://localhost:${process.env.CMS_PORT ?? 3335}`,
  renderer: `http://localhost:${process.env.RENDERER_PORT ?? 3336}`,
  platformWeb: `http://localhost:${process.env.PLATFORM_WEB_PORT ?? 3004}`
};

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  xfwd: true
});

proxy.on('error', (err: any, _req: any, res: any) => {
  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'backend_unavailable', message: err?.message || 'upstream unreachable' }));
  }
});

function selectTarget(url: string) {
  if (url.startsWith('/api/cms/')) return { target: targets.cms, url };
  if (url.startsWith('/api/') || url.startsWith('/audit/') || url.startsWith('/site-screenshots/')) return { target: targets.platformApi, url };
  if (url.startsWith('/cms')) return { target: targets.cms, url: '/admin' + url.replace(/^\/cms/, '') };
  if (url.startsWith('/preview/') || url.startsWith('/template-assets/') || url.startsWith('/site-media/')) return { target: targets.renderer, url };
  return { target: targets.platformWeb, url };
}

const server = createServer((req, res) => {
  const original = req.url || '/';
  if (original.startsWith('/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'gateway' }));
    return;
  }
  const { target, url } = selectTarget(original);
  req.url = url;
  proxy.web(req, res, { target });
});

server.on('upgrade', (req, socket, head) => {
  const original = req.url || '/';
  if (original.startsWith('/__vite')) {
    proxy.ws(req, socket, head, { target: targets.platformWeb });
    return;
  }
  const { target, url } = selectTarget(original);
  req.url = url;
  proxy.ws(req, socket, head, { target });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Gateway running: http://localhost:${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
