import type { Page, Frame } from 'playwright';

const TEXT_PATTERNS: RegExp[] = [
  /принять/iu,
  /принять все/iu,
  /согласен/iu,
  /соглас(ие|иться)/iu,
  /разрешить/iu,
  /ok/iu,
  /понятно/iu,
  /accept/iu,
  /accept all/iu,
  /agree/iu,
  /i agree/iu,
  /allow all/iu,
  /allow/iu
];

const NEGATIVE_PATTERNS: RegExp[] = [/настро(й|ек)/iu, /preferences/iu, /custom/iu, /manage/iu, /reject/iu, /отклон/iu];

async function tryClickInFrame(frame: Frame): Promise<boolean> {
  const candidates = frame
    .locator('button, [role="button"], input[type="button"], input[type="submit"], a[role="button"], a')
    .filter({ hasText: /.*/ });

  const count = await candidates.count();
  const limit = Math.min(count, 30);

  for (let i = 0; i < limit; i++) {
    const el = candidates.nth(i);
    const text = (await el.innerText().catch(() => ''))?.trim();
    if (!text) continue;

    if (!TEXT_PATTERNS.some((r) => r.test(text))) continue;
    if (NEGATIVE_PATTERNS.some((r) => r.test(text))) continue;

    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;

    await el.click({ timeout: 1500 }).catch(() => undefined);
    return true;
  }

  return false;
}

export async function handleCookieConsent(page: Page): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < 4000) {
    const frames = page.frames();

    let clicked = false;

    for (const frame of frames) {
      clicked = (await tryClickInFrame(frame)) || clicked;
      if (clicked) break;
    }

    if (!clicked) return;

    await page.waitForTimeout(400);
  }
}
