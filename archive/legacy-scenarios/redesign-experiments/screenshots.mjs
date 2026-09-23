import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { launchSandboxedBrowser } from '@minsk/security';
import { ArtifactType, StageStatus } from './types.mjs';
import { createArtifactRef } from './manifest.mjs';

/**
 * @typedef {import('./manifest.mjs').ArtifactRef} ArtifactRef
 */

/**
 * @typedef {object} ScreenshotTarget
 * @property {string} name
 * @property {string} url
 * @property {string} [viewport]
 * @property {number} width
 * @property {number} height
 * @property {ArtifactType} type
 */

const DEFAULT_VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

/**
 * Capture screenshots for a set of targets and viewports.
 * @param {Object} opts
 * @param {ScreenshotTarget[]} opts.targets
 * @param {string} opts.outDir
 * @param {Record<string, {width: number, height: number}>} [opts.viewports]
 * @returns {Promise<ArtifactRef[]>}
 */
export async function captureScreenshots({ targets, outDir, viewports = DEFAULT_VIEWPORTS }) {
  await mkdir(outDir, { recursive: true });
  const browser = await launchSandboxedBrowser({ headless: true });
  const artifacts = [];
  const failures = [];

  try {
    for (const target of targets) {
      for (const [viewportName, viewport] of Object.entries(viewports)) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();
        const fileName = `${target.name}-${viewportName}.png`;
        const filePath = join(outDir, fileName);

        try {
          const response = await page.goto(target.url, { waitUntil: 'networkidle', timeout: 60000 });
          const status = response?.status();
          if (status && status >= 400) {
            throw new Error(`HTTP ${status} for ${target.url}`);
          }
          await page.waitForTimeout(1000);

          const consoleErrors = [];
          page.on('pageerror', (err) => consoleErrors.push(String(err).slice(0, 200)));
          page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(String(msg.text()).slice(0, 200));
          });

          await page.screenshot({ path: filePath, fullPage: true });
          await writeFile(`${filePath}.metadata.json`, JSON.stringify({
            url: target.url,
            viewport: viewportName,
            width: viewport.width,
            height: viewport.height,
            timestamp: new Date().toISOString(),
            httpStatus: status,
            consoleErrors,
          }, null, 2), 'utf8');

          artifacts.push(await createArtifactRef(target.type, filePath, { viewport: viewportName, url: target.url }));
        } catch (err) {
          failures.push({ target: target.name, viewport: viewportName, url: target.url, error: err.message });
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    const errorPath = join(outDir, 'screenshot-failures.json');
    await writeFile(errorPath, JSON.stringify(failures, null, 2), 'utf8');
  }

  return artifacts;
}

/**
 * Ingest an existing screenshot file as an artifact.
 * @param {string} filePath
 * @param {string} type
 * @param {Object} [metadata]
 * @returns {Promise<ArtifactRef | null>}
 */
export async function ingestScreenshot(filePath, type, metadata = {}) {
  if (!existsSync(filePath)) return null;
  return createArtifactRef(type, filePath, metadata);
}
