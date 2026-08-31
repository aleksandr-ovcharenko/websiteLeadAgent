import { chromium } from 'playwright';
import { normalizeError } from './normalizeError.js';

export interface BrowserCheckResult {
  ok: boolean;
  code?: string;
  friendlyMessage?: string;
  rawMessage?: string;
  stack?: string;
  action?: string;
}

export async function checkBrowserReadiness(): Promise<BrowserCheckResult> {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return { ok: true };
  } catch (error) {
    const normalized = normalizeError(error);
    return { ok: false, ...normalized };
  }
}
