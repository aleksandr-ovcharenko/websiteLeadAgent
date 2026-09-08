import { chromium, type BrowserType } from 'playwright';

export function chromiumLaunchArgs(explicitNoSandbox?: boolean): string[] {
  const noSandboxEnv = process.env.PLAYWRIGHT_CHROMIUM_NO_SANDBOX === 'true' || explicitNoSandbox === true;
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && noSandboxEnv) {
    throw new Error(
      'PLAYWRIGHT_CHROMIUM_NO_SANDBOX=true is not allowed in production. '
      + 'Run the browser as a non-root user with sandboxing enabled.'
    );
  }

  if (noSandboxEnv) {
    console.warn('[SECURITY] Chromium sandbox disabled. This is only acceptable in local/test environments and must never be used in production.');
    return ['--no-sandbox', '--disable-setuid-sandbox'];
  }

  // Use Playwright's defaults, but remove the --no-sandbox and --disable-setuid-sandbox
  // switches so the OS sandbox is active. The calling process must be able to create
  // the Chromium sandbox (i.e., not running as root without user namespaces).
  return [];
}

export async function launchSandboxedBrowser(launchOptions: Parameters<BrowserType['launch']>[0] = {}) {
  const isProduction = process.env.NODE_ENV === 'production';
  const sandboxOverride = process.env.PLAYWRIGHT_CHROMIUM_NO_SANDBOX === 'true' ? true : undefined;
  const extraArgs = chromiumLaunchArgs(sandboxOverride);

  const args = [...(launchOptions.args || []), ...extraArgs];
  const ignoreDefaultArgs = sandboxOverride ? undefined : ['--no-sandbox', '--disable-setuid-sandbox'];

  try {
    return await chromium.launch({ ...launchOptions, args, ignoreDefaultArgs });
  } catch (err: any) {
    const message = err?.message || '';
    if (isProduction) {
      throw new Error(
        `Chromium sandbox launch failed in production: ${message}. ` +
        'Do not disable the sandbox. Run as an unprivileged user or use a container with seccomp.'
      );
    }
    // In dev/test, if sandbox fails, warn and allow explicit retry with --no-sandbox.
    if (process.env.PLAYWRIGHT_CHROMIUM_NO_SANDBOX !== 'true') {
      console.warn('[SECURITY] Chromium sandbox launch failed in dev/test. Set PLAYWRIGHT_CHROMIUM_NO_SANDBOX=true only if you are intentionally running without sandbox in a disposable environment.');
    }
    throw err;
  }
}
