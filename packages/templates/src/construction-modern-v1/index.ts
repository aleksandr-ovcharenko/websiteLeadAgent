import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RenderContext } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function constructionModernV1(_ctx: RenderContext): string {
  const html = readFileSync(resolve(__dirname, 'public/index.html'), 'utf-8');
  return html.replace('<title>', `<meta name="robots" content="noindex, nofollow" />\n    <title>`);
}
