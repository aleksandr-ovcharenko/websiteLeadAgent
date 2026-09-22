// V3.7.3 — Template copy dictionary.
//
// Every user-facing string the template needs lives in CMS SiteSettings
// .templateCopy as a flat key→text map. The renderer never invents text:
// a missing key either omits an optional element or is flagged by QA.
//
// `REQUIRED_COPY_KEYS` are blocking: a site cannot reach HUMAN_REVIEW_READY
// while they are absent. Everything else is optional furniture.

export type TemplateCopy = Record<string, string>;

/** Default Russian dictionary written once at generation time. After that it
 *  is ordinary CMS data — owned by the editor, preserved across regen. */
export const DEFAULT_TEMPLATE_COPY_RU: TemplateCopy = {
  // entity kind labels
  'entity.service': 'Услуга',
  'entity.project': 'Объект',
  'entity.news': 'Новость',
  'entity.vacancy': 'Вакансия',
  'entity.product': 'Продукт',
  'entity.default': 'Материал',
  // collection names used when a page/section lacks its own heading
  'collection.services': 'Услуги',
  'collection.projects': 'Объекты',
  'collection.news': 'Новости',
  'collection.vacancies': 'Вакансии',
  'collection.products': 'Каталог',
  // back-navigation labels per collection kind
  'back.services': 'Все услуги',
  'back.projects': 'Все объекты',
  'back.news': 'Все новости',
  'back.vacancies': 'Все вакансии',
  'back.products': 'Весь каталог',
  // view-all link: {name} = the section's own CMS heading
  'viewAll.template': 'Все {name}',
  'navSubmenu.all': 'Все — {name}',
  // provenance link
  'source.link': 'Источник ↗',
  // pagination
  'pager.aria': 'Страницы',
  'pager.prev': '← Назад',
  'pager.next': 'Вперёд →',
  'collection.empty': 'На этой странице нет элементов.',
  // mobile menu
  'menu.open': 'Меню',
  'menu.close': 'Закрыть',
  'menu.aria': 'Главное меню',
  'hero.aria': 'Начало',
  // 404
  'notFound.title': 'Страница не найдена',
  'notFound.lede': 'По адресу «{path}» ничего нет.',
  'notFound.home': '← На главную',
  'notFound.code': '404',
  // detail-view furniture
  'detail.galleryAria': 'Галерея',
  'detail.specsAria': 'Характеристики',
  'detail.factsAria': 'Факты о компании',
  'detail.category': 'Категория',
  'detail.location': 'Локация',
  'detail.prevAria': 'Предыдущий объект',
  'detail.nextAria': 'Следующий объект',
  'detail.indexTemplate': '{label} {i} / {n}',
  'detail.openCta': 'Открыть объект →',
  'detail.pageCta': 'Страница объекта →',
  'detail.galleryAlt': '{title} — фото {n}',
  'detail.entityIndexAlt': '{title} — {n}',
  'back.default': 'Назад',
  'about.directions': 'Направления',
  'about.companyHeading': 'Компания',
  'about.factsAria': 'Факты о компании',
  'about.founded': 'Основана',
  'about.team': 'Команда',
  'about.unp': 'УНП',
  'about.address': 'Адрес',
  'contacts.heading': 'Контакты',
  'contacts.phone': 'Телефон',
  'contacts.email': 'Email',
  'contacts.address': 'Адрес',
  'contacts.hours': 'Режим работы',
  'chapter.label': 'Глава {n}',
  // certificates & lightbox
  'certs.openAria': 'Открыть документ: {name}',
  'certs.docUntitled': 'Документ {n}',
  'lightbox.zoomFit': 'Уместить',
  'lightbox.zoomIn': 'Увеличить',
  'lightbox.openOriginal': 'Открыть оригинал',
  'lightbox.download': 'Скачать',
  'lightbox.close': 'Закрыть',
  'lightbox.prev': '← Пред.',
  'lightbox.next': 'След. →',
  'services.figureAria': 'Иллюстрация активной услуги',
  'footer.aria': 'Нижняя навигация',
  'a11y.skipLink': 'Перейти к содержимому',
};

/** Keys whose absence blocks acceptance — the site visibly breaks without
 *  them (navigation, entity framing, empty-state honesty). */
export const REQUIRED_COPY_KEYS = [
  'menu.open', 'menu.close', 'menu.aria', 'hero.aria',
  'notFound.title', 'notFound.lede', 'notFound.home',
  'source.link', 'viewAll.template', 'back.services', 'back.projects',
  'back.news', 'back.products', 'pager.aria', 'pager.prev', 'pager.next',
  'collection.empty',
];

/** Merge strategy: generated defaults fill only absent keys — existing CMS
 *  values (editor-owned after manualModifiedAt) are never overwritten. */
export function mergeTemplateCopy(existing: TemplateCopy | null | undefined): TemplateCopy {
  return { ...DEFAULT_TEMPLATE_COPY_RU, ...(existing || {}) };
}
