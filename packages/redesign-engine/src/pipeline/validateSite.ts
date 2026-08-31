interface ValidationResult {
  ok: boolean;
  score: number;
  total: number;
  missing: string[];
  warnings: string[];
}

export interface ValidateOptions {
  siteId: string;
  prisma: any;
}

export async function validateGeneratedSite(options: ValidateOptions): Promise<ValidationResult> {
  const { siteId, prisma } = options;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      siteSettings: true,
      pages: { where: { status: 'PUBLISHED' }, select: { id: true } },
      services: { where: { status: 'PUBLISHED' }, select: { id: true } },
      projects: { where: { status: 'PUBLISHED' }, select: { id: true } },
      newsPosts: { where: { status: 'PUBLISHED' }, select: { id: true } },
      media: { select: { id: true, sourceUrl: true } },
      menus: { include: { items: { select: { id: true } } } },
    },
  });

  const missing: string[] = [];
  const warnings: string[] = [];
  let score = 0;
  let total = 0;

  const check = (passed: boolean, label: string, critical = true) => {
    total++;
    if (passed) {
      score++;
    } else if (critical) {
      missing.push(label);
    } else {
      warnings.push(label);
    }
  };

  check(!!site, 'Site record exists', true);
  if (!site) {
    return { ok: false, score: 0, total: 1, missing, warnings };
  }

  const themeConfig = (site.themeConfig || {}) as any;
  const theme = themeConfig.theme || {};
  const hero = themeConfig.hero || {};
  const about = themeConfig.about || {};
  const cta = themeConfig.cta || {};
  const logoId = site.siteSettings?.logoMediaId || themeConfig.logo?.id;
  const settings = site.siteSettings || {};

  check(site.status === 'ACTIVE', 'Site status is active', true);
  check(!!settings.companyName, 'Company name in settings', true);
  check(!!(settings.phone || settings.email || settings.address || themeConfig.contacts?.email), 'At least one contact method', false);

  check(!!(theme.primaryColor && theme.textColor && theme.backgroundColor), 'Theme has primary/text/background colors', true);

  check(!!logoId && site.media.some((m: any) => m.id === logoId), 'Logo image exists in media', true);
  check(!!hero.title && String(hero.title).trim().length > 0, 'Hero has title', true);
  check(!!hero.subtitle && String(hero.subtitle).trim().length > 0, 'Hero has supporting text', true);
  check(!!(hero.imageId || hero.imageUrl), 'Hero has background image', true);
  check(
    !!hero.imageId && site.media.some((m: any) => m.id === hero.imageId || m.sourceUrl === hero.imageId),
    'Hero image belongs to current site media',
    true
  );
  check(
    !!hero.buttonUrl && !hero.buttonUrl.includes('#') && !hero.buttonUrl.includes('javascript:'),
    'Hero CTA has a valid destination',
    true
  );

  check(!!about.content && String(about.content).trim().length > 0, 'About section has content', true);
  check(!!(about.imageId || about.imageUrl), 'About section has image', false);

  check(!!cta.title || !!cta.description || !!settings.phone || !!settings.email, 'Contact/CTA section has content', false);

  check(Array.isArray(themeConfig.homepageSections) && themeConfig.homepageSections.length > 0, 'Homepage sections configured', true);

  const menu = site.menus[0];
  check(!!menu && menu.items.length > 0, 'Main navigation menu has items', true);

  check(site.pages.length > 0, 'At least one published page', true);
  check(site.services.length > 0 || site.projects.length > 0, 'At least one published service or project', false);

  const ok = missing.length === 0 && score / total >= 0.7;
  return { ok, score, total, missing, warnings };
}
