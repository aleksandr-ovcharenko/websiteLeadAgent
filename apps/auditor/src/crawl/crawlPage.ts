import type { Page } from 'playwright';

export async function crawlPage(page: Page) {
  const result = await page.evaluate(() => {
    // tsx/esbuild may inject __name(...) helpers into bundled output; in browser context it's undefined.
    // Define a no-op to prevent ReferenceError.
    const __name = (x: any) => x;

    const title = document.title || null;

    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null;
    const h1 = document.querySelector('h1')?.textContent?.trim() ?? null;

    const lang = document.documentElement.getAttribute('lang');
    const viewport = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null;

    const formsCount = document.querySelectorAll('form').length;
    const buttonsCount = document.querySelectorAll('button, input[type="submit"], input[type="button"]').length;
    const linksCount = document.querySelectorAll('a[href]').length;
    const imagesCount = document.querySelectorAll('img').length;

    const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]')).map((a) => a.getAttribute('href'));
    const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]')).map((a) => a.getAttribute('href'));

    const socialHosts = ['instagram.com', 'facebook.com', 'vk.com', 'tiktok.com', 'youtube.com', 'linkedin.com', 'ok.ru'];
    const socialLinks = Array.from(document.querySelectorAll('a[href]'))
      .map((a) => a.getAttribute('href'))
      .filter((href): href is string => Boolean(href))
      .filter((href) => {
        try {
          const u = new URL(href, location.href);
          return socialHosts.some((h) => u.hostname.includes(h));
        } catch {
          return false;
        }
      });

    const bodyText = document.body?.innerText ?? '';
    const footerText = (document.querySelector('footer')?.innerText ?? '').trim();

    const yearRegex = /\b(19\d{2}|20\d{2})\b/g;
    const extractYears = (s: string) => {
      const years: number[] = [];
      for (const m of s.matchAll(yearRegex)) {
        const y = Number(m[1]);
        if (Number.isFinite(y)) years.push(y);
      }
      return Array.from(new Set(years)).sort((a, b) => a - b);
    };

    const footerYears = extractYears(footerText);
    const pageYears = extractYears(bodyText).slice(-20);

    // Date extraction: support dd.mm.yyyy and yyyy-mm-dd as a cheap freshness proxy.
    const dateRegexes = [/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, /\b(\d{4})-(\d{2})-(\d{2})\b/g];
    const dates: number[] = [];
    for (const rx of dateRegexes) {
      for (const m of bodyText.matchAll(rx)) {
        let y: number;
        let mo: number;
        let d: number;
        if (rx === dateRegexes[0]) {
          d = Number(m[1]);
          mo = Number(m[2]);
          y = Number(m[3]);
        } else {
          y = Number(m[1]);
          mo = Number(m[2]);
          d = Number(m[3]);
        }
        const dt = Date.UTC(y, mo - 1, d);
        if (Number.isFinite(dt)) dates.push(dt);
      }
    }
    const latestContentDate = dates.length > 0 ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : null;

    const hasNewsSection = (() => {
      const keywords = ['news', 'blog', 'новости', 'блог', 'акции', 'статьи', 'публикации'];
      const anchors = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => (a.textContent ?? '').toLowerCase())
        .filter(Boolean);
      return anchors.some((t) => keywords.some((k) => t.includes(k)));
    })();

    return {
      title,
      metaDescription,
      h1,
      lang: lang || null,
      viewport,
      footerYears,
      pageYears,
      latestContentDate,
      hasNewsSection,
      counts: {
        forms: formsCount,
        buttons: buttonsCount,
        links: linksCount,
        images: imagesCount
      },
      telLinks: telLinks.filter((x): x is string => Boolean(x)),
      mailtoLinks: mailtoLinks.filter((x): x is string => Boolean(x)),
      socialLinks
    };
  });

  return result;
}
