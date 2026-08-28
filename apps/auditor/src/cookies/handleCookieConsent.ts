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
  const candidates = frame.locator(
    [
      'button',
      '[role="button"]',
      'input[type="button"]',
      'input[type="submit"]',
      'a[role="button"]',
      'a',
      '[data-cookieaccept]',
      '[data-testid*="accept" i]',
      '[id*="accept" i]',
      '[class*="accept" i]'
    ].join(',')
  );

  const count = await candidates.count();
  const limit = Math.min(count, 30);

  for (let i = 0; i < limit; i++) {
    const el = candidates.nth(i);
    const text = ((await el.innerText().catch(() => '')) || (await el.textContent().catch(() => '')) || '').trim();
    if (!text) {
      const aria = ((await el.getAttribute('aria-label').catch(() => '')) ?? '').trim();
      if (!aria) continue;
      if (!TEXT_PATTERNS.some((r) => r.test(aria))) continue;
      if (NEGATIVE_PATTERNS.some((r) => r.test(aria))) continue;
    } else {
      if (!TEXT_PATTERNS.some((r) => r.test(text))) continue;
      if (NEGATIVE_PATTERNS.some((r) => r.test(text))) continue;
    }

    const visible = await el.isVisible().catch(() => false);
    if (!visible) continue;

    await el.click({ timeout: 1500 }).catch(() => undefined);
    return true;
  }

  return false;
}

export async function handleCookieConsent(page: Page): Promise<void> {
  const started = Date.now();

  while (Date.now() - started < 5000) {
    const frames = page.frames();

    let clicked = false;

    for (const frame of frames) {
      clicked = (await tryClickInFrame(frame)) || clicked;
      if (clicked) break;
    }

    if (clicked) {
      await page.waitForTimeout(350);
      continue;
    }

    await page.waitForTimeout(250);
  }

  await page
    .evaluate(() => {
      const selectors = [
        '[id*="cookie" i]',
        '[class*="cookie" i]',
        '[id*="consent" i]',
        '[class*="consent" i]',
        '[id*="gdpr" i]',
        '[class*="gdpr" i]',
        '[aria-label*="cookie" i]',
        '[aria-label*="consent" i]',
        '.cc-window',
        '.cc-banner',
        '.cookie-banner',
        '.cookie-consent',
        '.CookieConsent',
        '#cookie',
        '#cookies',
        '#cookie-banner',
        '#cookieconsent'
      ];

      for (const s of selectors) {
        for (const el of Array.from(document.querySelectorAll<HTMLElement>(s))) {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        }
      }

      const style = document.createElement('style');
      style.textContent = selectors.map((s) => `${s}{display:none!important;visibility:hidden!important;opacity:0!important;pointer-events:none!important;}`).join('\n');
      document.head.appendChild(style);
    })
    .catch(() => undefined);
}
