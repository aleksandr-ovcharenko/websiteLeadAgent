const BLACKLIST = [
  'minsk.jsprav.ru',
  'rubrikator.org',
  'spisok.by',
  'spr.by',
  'by.spr.ru'
];

export function isBlacklistedWebsiteDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return BLACKLIST.some((b) => d === b || d.endsWith(`.${b}`));
}
