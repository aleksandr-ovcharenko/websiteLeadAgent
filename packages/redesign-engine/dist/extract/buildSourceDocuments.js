import { load } from 'cheerio';
const COLLECTION_SELECTORS = [
    '.services', '.service-list', '[class*="service"]',
    '.projects', '.project-list', '.portfolio', '.portfolio-block', '[class*="portfolio"]', '[class*="project"]',
    '.news', '.news-list', '[class*="news"]',
    '.vacancies', '.vacancy-list', '.careers', '[class*="vacanc"]',
    '.cards', '.card-list', '.items', '.list-group', '.image-grid', '.isotope', '.team', '.reviews'
];
const CARD_SELECTORS = [
    '.card', '.service', '.project', '.portfolio-item', '.element', '.grid-item', '.work', '.works',
    '.news-item', '.vacancy', '.team-member', '.review',
    'li', 'article', '.item', '[class*="item"]', '[class*="element"]'
];
function slugFromUrl(url) {
    try {
        const u = new URL(url);
        const path = u.pathname.replace(/\/$/, '').replace(/^\//, '');
        return path || 'index';
    }
    catch {
        return 'index';
    }
}
function normalizeUrl(base, href) {
    try {
        const u = new URL(href, base);
        const b = new URL(base);
        if (u.hostname !== b.hostname)
            return null;
        u.hash = '';
        if (!u.search)
            u.search = '';
        const hrefHadTrailingSlash = typeof href === 'string' && href.endsWith('/');
        const pathnameHadTrailingSlash = u.pathname.endsWith('/');
        u.pathname = u.pathname.replace(/\/index\.html?$/i, '').replace(/\/+$/, '') || '/';
        if (hrefHadTrailingSlash && pathnameHadTrailingSlash && u.pathname !== '/')
            u.pathname += '/';
        return u.toString().replace(/\?$/, '');
    }
    catch {
        return null;
    }
}
function isInternal(base, href) {
    try {
        return new URL(href, base).hostname === new URL(base).hostname;
    }
    catch {
        return false;
    }
}
function nodePath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.type === 'tag' && cur.tagName) {
        const cls = cur.attribs?.class ? '.' + cur.attribs.class.split(/\s+/).filter(Boolean).slice(0, 3).join('.') : '';
        const id = cur.attribs?.id ? `#${cur.attribs.id}` : '';
        parts.unshift(`${cur.tagName}${id}${cls}`);
        cur = cur.parent;
    }
    return parts.slice(-8).join(' > ');
}
function cleanText(text) {
    return text.replace(/\s+/g, ' ').trim();
}
function extractPhones(text) {
    const re = /[\(\+]?\d(?:[\s\(\)\-]?\d){6,30}/g;
    const matches = (text.match(re) || [])
        .map((m) => m.replace(/\s+/g, ' ').trim())
        .filter((m) => m.replace(/[^\d]/g, '').length >= 7)
        .map((m) => m.replace(/\s+/g, ' ').trim());
    return [...new Set(matches)];
}
function extractEmails(text) {
    const re = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    return [...new Set(text.match(re) || [])];
}
function extractSocialLinks(text, links) {
    const domains = [
        { platform: 'VK', rx: /vk\.com|vkontakte\.ru/ },
        { platform: 'Instagram', rx: /instagram\.com|instagr\.am/ },
        { platform: 'Facebook', rx: /facebook\.com|fb\.com/ },
        { platform: 'Telegram', rx: /t\.me|telegram\.me/ },
        { platform: 'YouTube', rx: /youtube\.com|youtu\.be/ },
        { platform: 'LinkedIn', rx: /linkedin\.com/ },
        { platform: 'OK', rx: /ok\.ru/ },
    ];
    const out = [];
    const seen = new Set();
    const all = [...new Set([text, ...links.map((l) => l.href)])];
    for (const raw of all) {
        for (const d of domains) {
            if (d.rx.test(raw)) {
                const match = raw.match(/https?:\/\/[^\s\"<>]+/);
                if (match) {
                    const u = match[0].replace(/[\"'<>]/g, '');
                    if (!seen.has(u)) {
                        seen.add(u);
                        out.push({ platform: d.platform, url: u });
                    }
                }
                break;
            }
        }
    }
    return out;
}
function workingHours(text) {
    // Generic time-range pattern (HH:MM - HH:MM) without language-specific day names.
    const m = text.match(/(?:\b(?:mon|tue|wed|thu|fri|sat|sun|mo|tu|we|th|fr|sa|su)[-.,/]?\s*)?\d{1,2}[\:\.]\d{2}\s*[-–—]\s*\d{1,2}[\:\.]\d{2}/i);
    return m ? m[0].trim() : undefined;
}
function addressCandidates(text) {
    // Generic address-like snippets: at least 20 chars, contains a digit and a comma or street-like token.
    const re = /.{20,80}?\d+.{0,60}/g;
    const matches = (text.match(re) || [])
        .map(cleanText)
        .filter((s) => s.length >= 20 && s.length <= 100);
    return [...new Set(matches)].slice(0, 5);
}
function findHeadingLevel(tagName) {
    const m = tagName.match(/^h([1-6])$/i);
    return m ? parseInt(m[1], 10) : 0;
}
function buildDomPath(el) {
    return nodePath(el);
}
function extractImageAttributes($, img, baseUrl, pageUrl, crawledImage) {
    const $img = $(img);
    const src = $img.attr('src') || $img.attr('data-src') || $img.attr('data-lazy-src') || '';
    const absoluteSrc = src ? normalizeUrl(baseUrl, src) || src : '';
    let width = parseInt($img.attr('width') || '', 10) || undefined;
    let height = parseInt($img.attr('height') || '', 10) || undefined;
    if (crawledImage) {
        width = width ?? crawledImage.width;
        height = height ?? crawledImage.height;
    }
    const $link = $img.closest('a');
    const href = $link.length ? $link.attr('href') : undefined;
    const $figure = $img.closest('figure');
    const caption = ($figure.find('figcaption').first().text() || $img.attr('title') || '').trim();
    const alt = ($img.attr('alt') || '').trim();
    const domPath = buildDomPath(img);
    return {
        src: absoluteSrc,
        alt,
        caption,
        width,
        height,
        domPath,
        region: 'unknown',
        provenance: { sourcePageUrl: pageUrl, sourceSelector: domPath },
        href: href ? normalizeUrl(baseUrl, href) || href : undefined
    };
}
function elementRegion($el, chrome) {
    const ancestors = [];
    let cur = $el.get(0);
    while (cur && cur.type === 'tag') {
        ancestors.push(cur);
        cur = cur.parent;
    }
    for (const h of chrome.header || []) {
        if (ancestors.includes(h))
            return 'header';
    }
    for (const f of chrome.footer || []) {
        if (ancestors.includes(f))
            return 'footer';
    }
    for (const n of chrome.nav || []) {
        if (ancestors.includes(n))
            return 'nav';
    }
    const tagName = $el.get(0)?.tagName?.toLowerCase();
    if (tagName === 'main' || $el.closest('main').length)
        return 'main';
    if (tagName === 'article' || $el.closest('article').length)
        return 'aside';
    if (tagName === 'aside' || $el.closest('aside').length)
        return 'aside';
    return 'unknown';
}
function identifyChrome($) {
    const header = $('header, [role="banner"], .site-header, .page-header, #header, .header').get();
    const footer = $('footer, .site-footer, .page-footer, #footer, .footer').get();
    const nav = $('nav, .nav, .navigation, .menu, .main-menu, .site-menu, #nav, .navbar').get();
    return { header, footer, nav };
}
function removeNoise($) {
    $('script:not([type="application/ld+json"]), style, noscript, svg, canvas, template, iframe, [class*="cookie"], [id*="cookie"], [class*="consent"], [id*="consent"], .modal, [role="dialog"]').remove();
}
function extractMeta($, name) {
    return $(`meta[name="${name}"]`).attr('content') || $(`meta[property="${name}"]`).attr('content') || '';
}
function extractOpenGraph($) {
    const og = {};
    $('meta[property^="og:"]').each((_, el) => {
        const prop = $(el).attr('property');
        const content = $(el).attr('content');
        if (prop && content)
            og[prop] = content;
    });
    return og;
}
function extractStructuredData($) {
    const data = [];
    $('script[type="application/ld+json"]').each((_, el) => {
        const text = $(el).html() || '';
        try {
            data.push(JSON.parse(text));
        }
        catch { }
    });
    return data;
}
function extractBreadcrumbs($, baseUrl, jsonld) {
    for (const sd of jsonld) {
        if (sd['@type'] === 'BreadcrumbList' || (Array.isArray(sd['@graph']) && sd['@graph'].some((x) => x['@type'] === 'BreadcrumbList'))) {
            const list = sd.itemListElement || sd['@graph']?.find((x) => x['@type'] === 'BreadcrumbList')?.itemListElement || [];
            return list.map((it) => {
                const label = typeof it.item === 'string' ? it.name || it.item : it.name || (it.item?.name) || '';
                const url = typeof it.item === 'string' ? it.item : it.item?.['@id'] || it.item?.url || undefined;
                return { label, url: url ? normalizeUrl(baseUrl, url) || url : undefined };
            }).filter((b) => b.label);
        }
    }
    const bc = [];
    $('[class*="breadcrumb"], nav[aria-label="breadcrumb"]').first().find('a').each((_, el) => {
        const label = cleanText($(el).text());
        const href = $(el).attr('href');
        if (label)
            bc.push({ label, url: href ? normalizeUrl(baseUrl, href) || href : undefined });
    });
    return bc;
}
function navTreeFromLinks(links) {
    const roots = [];
    const seen = new Set();
    for (const l of links) {
        if (!l.href || seen.has(l.href))
            continue;
        seen.add(l.href);
        roots.push({ label: l.text, url: l.href, source: 'header', children: [] });
    }
    return roots;
}
function extractNavTree($, container, baseUrl, source) {
    const seen = new Set();
    function anchorNode(a) {
        const text = cleanText($(a).text());
        const href = $(a).attr('href') || '';
        if (!text || !href)
            return null;
        if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:'))
            return null;
        if (!isInternal(baseUrl, href))
            return null;
        const nu = normalizeUrl(baseUrl, href);
        if (!nu || seen.has(nu))
            return null;
        seen.add(nu);
        return { label: text, url: nu, source, children: [] };
    }
    function walkList(ul) {
        const nodes = [];
        $(ul).children('li').each((_, li) => {
            const $li = $(li);
            const link = $li.children('a[href]').first().get(0) || $li.find('a[href]').first().get(0);
            const node = link ? anchorNode(link) : null;
            if (!node) {
                // List item may be a heading label with a nested submenu.
                const label = cleanText($li.contents().not($li.children('ul, ol')).text());
                if (label && $li.children('ul, ol').length) {
                    const children = walkList($li.children('ul, ol').first());
                    if (children.length) {
                        nodes.push({ label, url: children[0].url, source, children });
                    }
                    return;
                }
            }
            if (!node)
                return;
            const nested = $li.children('ul, ol');
            if (nested.length) {
                node.children = walkList(nested.first());
            }
            else {
                const anyNested = $li.find('ul, ol');
                if (anyNested.length)
                    node.children = walkList(anyNested.first());
            }
            nodes.push(node);
        });
        return nodes;
    }
    const $container = $(container);
    if ($container.is('ul, ol'))
        return walkList(container);
    if ($container.children('a[href]').length) {
        return $container.children('a[href]').map((_, a) => anchorNode(a)).get().filter(Boolean);
    }
    const nestedUl = $container.find('ul, ol').first();
    if (nestedUl.length)
        return walkList(nestedUl.get(0));
    return $container.find('a[href]').map((_, a) => anchorNode(a)).get().filter(Boolean);
}
function detectCollectionType($el, items, baseUrl) {
    const html = $el.toString().toLowerCase();
    const text = cleanText($el.text()).toLowerCase();
    const url = items.map((it) => it.url).filter(Boolean).join(' ').toLowerCase();
    const signal = html + ' ' + text + ' ' + url;
    if (/\bservice|\bservices|\bsolutions/.test(signal))
        return 'services';
    if (/\bproject|\bprojects|\bportfolio|\bwork/.test(signal))
        return 'projects';
    if (/\bnews|\bblog|\barticle|\bpress/.test(signal))
        return 'news';
    if (/\bvacan|\bcareer|\bjob|\bjobs/.test(signal))
        return 'vacancies';
    if (/\bteam|\bpeople|\bstaff/.test(signal))
        return 'team';
    if (/\breview|\btestimonial|\btestimonials/.test(signal))
        return 'testimonials';
    return 'unknown';
}
function cardContainerScore($, $root) {
    const rootEl = $root.get(0);
    const children = $root.children().get();
    if (!rootEl || rootEl.tagName === 'body' || rootEl.tagName === 'html' || children.length < 2) {
        return { cards: 0, children: children.length, score: 0 };
    }
    let cards = 0;
    for (const child of children) {
        const $child = $(child);
        const tag = child.tagName?.toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'section')
            continue;
        const hasLink = $child.find('a[href]').length > 0 || tag === 'a';
        const hasHeading = /^h[2-6]$/i.test(tag) || $child.find('h2,h3,h4,h5,h6').length > 0;
        const hasImage = $child.find('img').length > 0;
        const hasText = $child.text().trim().length > 0;
        const hasDescription = $child.find('p').text().trim().length > 20;
        // A card must have a link, image, or a heading with a meaningful description.
        const isCard = (hasLink || hasImage || (hasHeading && hasDescription)) && hasText;
        if (isCard)
            cards++;
    }
    const score = children.length ? cards / Math.max(children.length, 3) : 0;
    return { cards, children: children.length, score };
}
function isCardContainer($, $root) {
    if ($root.closest('header, footer, nav, [role="banner"]').length)
        return false;
    const rootEl = $root.get(0);
    if (!rootEl || rootEl.tagName === 'body' || rootEl.tagName === 'html')
        return false;
    // Page-wide wrappers that contain the global chrome are not card containers
    const chromeInside = $root.find('header, footer, nav, [role="banner"], .site-header, .site-footer, .main-navigation, .main-nav, .navbar, .nav, .menu, .header, .footer, #header, #footer, #nav, #menu').length > 0;
    if (chromeInside)
        return false;
    // Modal / popup / overlay containers are not content collections
    const cls = ($root.attr('class') || '');
    if (/\b(modal|popup|dialog|overlay|drawer|offcanvas|lightbox|backdrop|v-modal)\b/i.test(cls))
        return false;
    const { cards, children } = cardContainerScore($, $root);
    if (children < 2 || cards < 2)
        return false;
    // A container whose children are mostly structural sections/articles is a page wrapper, not a card list
    const structuralTags = new Set(['section', 'article', 'aside']);
    const structuralChildren = $root.children().get().filter((c) => structuralTags.has(c.tagName?.toLowerCase())).length;
    if (children > 12 && structuralChildren / children >= 0.5)
        return false;
    // If a child is itself a card container, this root is a wrapper around smaller grids
    const childContainers = $root.children().filter((_i, c) => {
        const $c = $(c);
        const { cards: cc, children: cl } = cardContainerScore($, $c);
        return cl >= 2 && cc >= 2 && cc / cl >= 0.5;
    }).length;
    if (childContainers > 0)
        return false;
    return cards / children >= 0.45;
}
function detectCollections($, baseUrl, pageUrl, imageMap) {
    const collections = [];
    const roots = new Set();
    const candidates = [];
    function scoreRoot(el) {
        const $el = $(el);
        const { cards, children } = cardContainerScore($, $el);
        if (children < 2 || cards < 2)
            return 0;
        return cards + (children > 6 ? 1 : 0);
    }
    function addRoot(el) {
        const tag = (el.tagName || '').toLowerCase();
        if (tag === 'body' || tag === 'html')
            return;
        if ($(el).find('header, footer, nav, [role="banner"], .site-header, .site-footer, .main-navigation, .main-nav, .navbar, .nav, .menu, .header, .footer, #header, #footer, #nav, #menu').length > 0)
            return;
        for (const r of roots) {
            if ($.contains(r, el) || $.contains(el, r))
                return;
        }
        const col = parseCollection($, el, baseUrl, pageUrl, imageMap);
        if (col.items.length >= 2) {
            collections.push(col);
            roots.add(el);
        }
    }
    // Gather semantic candidates
    $(COLLECTION_SELECTORS.join(',')).each((_, el) => {
        if ($(el).closest('header, footer, nav, [role="banner"]').length)
            return;
        const depth = $(el).parents().length;
        const s = scoreRoot(el);
        if (s > 0)
            candidates.push({ el, depth, score: s });
    });
    // Gather structural candidates
    $('section, div, article, ul, ol').each((_, el) => {
        if ($(el).closest('header, footer, nav, [role="banner"]').length)
            return;
        if (isCardContainer($, $(el))) {
            const depth = $(el).parents().length;
            const s = scoreRoot(el);
            if (s > 0)
                candidates.push({ el, depth, score: s });
        }
    });
    // Prefer the deepest, most card-like containers. This keeps inner grids (e.g. .portfolio_block)
    // and rejects outer page wrappers (e.g. div#fw_c or div#content when it contains a real grid).
    candidates.sort((a, b) => b.depth - a.depth || b.score - a.score);
    for (const c of candidates) {
        addRoot(c.el);
    }
    return collections;
}
function collectionHeading($, collectionRoot) {
    const $root = $(collectionRoot);
    // A collection heading must not be a card title nested inside the collection.
    const isCardHeading = (el) => $(el).closest('a, article, li, .card, .element, .item, .project, .service, .work, [class*="portfolio"], [class*="project"], [class*="card"]').length > 0;
    const findHeading = (query) => query.filter((_, el) => !isCardHeading(el)).first().text() || '';
    const heading = findHeading($root.closest('section, article, main, [class*="section"], [class*="area"]').find('h2,h3,h4,h5,h6')) ||
        findHeading($root.prevAll('h2,h3,h4,h5,h6')) ||
        findHeading($root.prevAll().find('h2,h3,h4,h5,h6')) ||
        findHeading($root.siblings('h2,h3,h4,h5,h6')) ||
        findHeading($root.parent().prevAll('h2,h3,h4,h5,h6'));
    return cleanText(heading);
}
function parseCollection($, collectionRoot, baseUrl, pageUrl, imageMap) {
    const $root = $(collectionRoot);
    const selector = buildDomPath(collectionRoot);
    const heading = collectionHeading($, collectionRoot);
    const items = [];
    let cardEls = [];
    $root.children().each((_, child) => {
        const $child = $(child);
        const tag = child.tagName?.toLowerCase();
        if (/^h[2-6]$/i.test(tag)) {
            cardEls.push(child);
            return;
        }
        if ($child.is(CARD_SELECTORS.join(','))) {
            cardEls.push(child);
            return;
        }
        const inner = $child.find(CARD_SELECTORS.join(',')).first();
        if (inner.length) {
            cardEls.push(inner.get(0));
        }
    });
    if (cardEls.length < 2) {
        // DOM-generic fallback: use descendants that have links or headings.
        cardEls = $root.find(CARD_SELECTORS.join(',')).get();
    }
    if (cardEls.length < 2 && $root.get(0).tagName === 'li') {
        cardEls.push($root.get(0));
    }
    let currentGroup;
    for (const card of cardEls.slice(0, 50)) {
        const $card = $(card);
        const isGroup = /^h[2-6]$/i.test(card.tagName);
        const $titleEl = isGroup ? $card : $card.find('h1,h2,h3,h4,h5,h6,.title,.heading,[class*="title"]').first();
        const title = cleanText($titleEl.text()) || (isGroup ? '' : cleanText($card.find('a').first().text()));
        const $link = $card.is('a[href]') ? $card : $card.find('a[href]').first();
        const href = $link.attr('href');
        const url = href ? normalizeUrl(baseUrl, href) || href : undefined;
        const description = cleanText($card.find('p').not($titleEl.find('*')).slice(0, 2).text());
        const $img = $card.find('img').first();
        const imgSrc = $img.attr('src') || $img.attr('data-src') || '';
        const image = imgSrc ? imageMap.get(normalizeUrl(baseUrl, imgSrc) || imgSrc) : undefined;
        const meta = {};
        $card.find('[class*="date"], [class*="price"], [class*="location"], [class*="category"]').each((_, el) => {
            const text = cleanText($(el).text());
            if (text) {
                const key = ($(el).attr('class') || '').split(/\s+/).find((c) => /date|price|location|category/.test(c)) || 'meta';
                meta[key] = text;
            }
        });
        if (isGroup && title) {
            currentGroup = title;
        }
        if (title || url || image || Object.keys(meta).length) {
            items.push({ title, description, url, image, meta, group: isGroup ? undefined : currentGroup, isGroup });
        }
    }
    const typeCandidate = detectCollectionType($root, items, baseUrl);
    return { id: `col-${Math.random().toString(36).slice(2, 9)}`, selector, heading, typeCandidate, items };
}
function collectSections($, root, baseUrl, pageUrl, imageMap, region) {
    const sections = [];
    let current = null;
    let order = 0;
    function flush() {
        if (current)
            sections.push(current);
        current = null;
    }
    function startSection(headingEl) {
        flush();
        const id = `sec-${order}-${Math.random().toString(36).slice(2, 7)}`;
        const level = headingEl ? findHeadingLevel(headingEl.tagName) : 0;
        const heading = headingEl ? cleanText($(headingEl).text()) : undefined;
        current = {
            id,
            level,
            heading,
            region,
            paragraphs: [],
            lists: [],
            tables: [],
            images: [],
            links: [],
            collections: [],
            domPath: headingEl ? buildDomPath(headingEl) : undefined,
            order: order++
        };
    }
    function walkNode(node) {
        if (!node)
            return;
        if (node.type === 'text') {
            const text = cleanText(node.data || '');
            if (text && current)
                current.paragraphs.push(text);
            return;
        }
        if (node.type !== 'tag')
            return;
        const tagName = node.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'svg', 'canvas', 'template'].includes(tagName))
            return;
        if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
            startSection(node);
            if (current) {
                current.paragraphs.push(cleanText($(node).text()));
            }
            return;
        }
        if (!current)
            startSection();
        if (tagName === 'p') {
            const text = cleanText($(node).text());
            if (text)
                current.paragraphs.push(text);
        }
        else if (tagName === 'a') {
            const text = cleanText($(node).text());
            const href = $(node).attr('href');
            if (href && text && isInternal(baseUrl, href) && !href.startsWith('#')) {
                const nu = normalizeUrl(baseUrl, href) || href;
                current.links.push({ text, href: nu, source: 'body', domPath: buildDomPath(node) });
            }
            // Images inside links are still valid content evidence.
            $(node).find('img').each((_, imgNode) => {
                const img = extractImageAttributes($, imgNode, baseUrl, pageUrl);
                img.region = region === 'main' ? 'main' : 'unknown';
                img.provenance.sourceSectionId = current.id;
                imageMap.set(img.src, img);
                current.images.push(img);
            });
        }
        else if (tagName === 'img') {
            const img = extractImageAttributes($, node, baseUrl, pageUrl);
            img.region = region === 'main' ? 'main' : 'unknown';
            img.provenance.sourceSectionId = current.id;
            imageMap.set(img.src, img);
            current.images.push(img);
        }
        else if (tagName === 'ul' || tagName === 'ol') {
            const items = [];
            $(node).find('li').each((_, li) => {
                const itemText = cleanText($(li).text());
                if (itemText)
                    items.push(itemText);
            });
            if (items.length)
                current.lists.push(items);
        }
        else if (tagName === 'table') {
            const rows = [];
            const headers = [];
            $(node).find('tr').each((rowIdx, tr) => {
                const cells = [];
                $(tr).find('th,td').each((_, td) => {
                    const text = cleanText($(td).text());
                    cells.push(text);
                    if (rowIdx === 0 && td.tagName === 'th')
                        headers.push(text);
                });
                if (cells.length)
                    rows.push(cells);
            });
            if (rows.length)
                current.tables.push({ headers: headers.length ? headers : undefined, rows });
        }
        else if (tagName === 'article' || tagName === 'section') {
            $(node).children().each((_, child) => walkNode(child));
        }
        else if (['div', 'span', 'header', 'footer', 'main', 'aside'].includes(tagName)) {
            const text = cleanText($(node).clone().children().remove().end().text());
            if (text && !$(node).children().length) {
                current.paragraphs.push(text);
            }
            else {
                $(node).contents().each((_, child) => walkNode(child));
            }
        }
        else {
            $(node).contents().each((_, child) => walkNode(child));
        }
    }
    $(root).contents().each((_, child) => walkNode(child));
    flush();
    return sections;
}
function extractEvidence($, jsonld, pageTitle, baseUrl) {
    const dates = [];
    const companyNameCandidates = [];
    const addresses = [];
    for (const sd of jsonld) {
        const extract = (obj) => {
            if (!obj || typeof obj !== 'object')
                return;
            ['datePublished', 'dateModified', 'foundingDate', 'startDate', 'dateCreated'].forEach((key) => {
                if (obj[key])
                    dates.push({ text: String(obj[key]), type: 'jsonld', context: `${obj['@type'] || 'Object'}/${key}` });
            });
            if (obj.name)
                companyNameCandidates.push({ text: String(obj.name), source: `jsonld/${obj['@type'] || 'Object'}` });
            if (obj.legalName)
                companyNameCandidates.push({ text: String(obj.legalName), source: `jsonld/${obj['@type'] || 'Object'}` });
            if (obj.address) {
                const addr = typeof obj.address === 'string' ? obj.address : [obj.address.streetAddress, obj.address.addressLocality, obj.address.addressRegion].filter(Boolean).join(', ');
                if (addr)
                    addresses.push(addr);
            }
            if (obj['@graph'])
                obj['@graph'].forEach(extract);
        };
        extract(sd);
    }
    $('time').each((_, el) => {
        const text = cleanText($(el).attr('datetime') || $(el).text());
        if (text)
            dates.push({ text, type: 'time', context: buildDomPath(el) });
    });
    $('meta[property="article:published_time"], meta[property="article:modified_time"]').each((_, el) => {
        const text = $(el).attr('content');
        if (text)
            dates.push({ text, type: 'meta', context: $(el).attr('property') || '' });
    });
    const footerText = $('footer').text() || '';
    const headerText = $('header').text() || '';
    addresses.push(...addressCandidates(footerText), ...addressCandidates(headerText));
    if (pageTitle) {
        const candidate = pageTitle.split(/[-—|]/)[0].trim();
        if (candidate && candidate.length > 2 && !/\b(?:home|about|contact|services|news|products)\b/i.test(candidate)) {
            companyNameCandidates.push({ text: candidate, source: 'title' });
        }
    }
    return { dates, companyNameCandidates, addressCandidates: [...new Set(addresses)] };
}
function buildSourceDocument(crawledPage, index, baseUrl) {
    const $ = load(crawledPage.html || '<html></html>');
    removeNoise($);
    const chromeNodes = identifyChrome($);
    const pageUrl = crawledPage.url;
    const imageMap = new Map();
    const title = cleanText($('title').text()) || crawledPage.title || '';
    const metaDescription = cleanText($('meta[name="description"]').attr('content') || '') || crawledPage.metaDescription || '';
    const h1 = cleanText($('h1').first().text()) || crawledPage.h1 || '';
    const canonicalUrl = $('link[rel="canonical"]').attr('href') || crawledPage.canonicalUrl;
    const language = $('html').attr('lang') || undefined;
    const isHomepage = crawledPage.path === 'index' || normalizeUrl(baseUrl, pageUrl) === normalizeUrl(baseUrl, baseUrl);
    const favicon = $('link[rel="icon"], link[rel="shortcut icon"]').first().attr('href') || crawledPage.favicon;
    const structuredData = extractStructuredData($);
    const openGraph = extractOpenGraph($);
    const evidence = extractEvidence($, structuredData, title, baseUrl);
    const headerImages = [];
    const footerImages = [];
    const navImages = [];
    $(chromeNodes.header).find('img').add($(chromeNodes.header).filter('img')).each((_, img) => {
        const si = extractImageAttributes($, img, baseUrl, pageUrl);
        si.region = 'header';
        imageMap.set(si.src, si);
        headerImages.push(si);
    });
    $(chromeNodes.footer).find('img').add($(chromeNodes.footer).filter('img')).each((_, img) => {
        const si = extractImageAttributes($, img, baseUrl, pageUrl);
        si.region = 'footer';
        imageMap.set(si.src, si);
        footerImages.push(si);
    });
    $(chromeNodes.nav).find('img').add($(chromeNodes.nav).filter('img')).each((_, img) => {
        const si = extractImageAttributes($, img, baseUrl, pageUrl);
        si.region = 'nav';
        imageMap.set(si.src, si);
        navImages.push(si);
    });
    let logoSrc;
    let logoHref;
    let logoAlt;
    $(chromeNodes.header).find('a img, .logo img, [class*="logo"] img').each((_, img) => {
        if (!logoSrc) {
            logoSrc = normalizeUrl(baseUrl, $(img).attr('src') || '') || $(img).attr('src') || '';
            logoAlt = $(img).attr('alt') || '';
            const $a = $(img).closest('a');
            logoHref = $a.length ? normalizeUrl(baseUrl, $a.attr('href') || '') || $a.attr('href') || undefined : undefined;
        }
    });
    if (!logoSrc && crawledPage.logo)
        logoSrc = normalizeUrl(baseUrl, crawledPage.logo) || crawledPage.logo;
    const headerLinks = [];
    $(chromeNodes.header).find('a[href]').each((_, el) => {
        const text = cleanText($(el).text());
        const href = $(el).attr('href') || '';
        if (text && href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && isInternal(baseUrl, href)) {
            headerLinks.push({ text, href: normalizeUrl(baseUrl, href) || href, source: 'header', domPath: buildDomPath(el) });
        }
    });
    const footerLinks = [];
    $(chromeNodes.footer).find('a[href]').each((_, el) => {
        const text = cleanText($(el).text());
        const href = $(el).attr('href') || '';
        if (text && href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && isInternal(baseUrl, href)) {
            footerLinks.push({ text, href: normalizeUrl(baseUrl, href) || href, source: 'footer', domPath: buildDomPath(el) });
        }
    });
    const navLinks = [];
    $(chromeNodes.nav).find('a[href]').each((_, el) => {
        const text = cleanText($(el).text());
        const href = $(el).attr('href') || '';
        if (text && href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:') && isInternal(baseUrl, href)) {
            navLinks.push({ text, href: normalizeUrl(baseUrl, href) || href, source: 'nav', domPath: buildDomPath(el) });
        }
    });
    const mainCandidates = $('main, [role="main"], article, .content, .main-content, .page-content, [class*="content"]');
    let mainEl = mainCandidates.first().get(0);
    if (!mainEl) {
        const bodyClone = $('body').clone();
        bodyClone.find('header, footer, nav, [role="banner"], [class*="cookie"]').remove();
        mainEl = bodyClone.get(0) || $('body').get(0);
    }
    const sections = [];
    if (mainEl) {
        sections.push(...collectSections($, mainEl, baseUrl, pageUrl, imageMap, 'main'));
    }
    // Also extract aside/article side content.
    $('aside, article').each((_, el) => {
        if (mainEl && $.contains(mainEl, el))
            return;
        sections.push(...collectSections($, el, baseUrl, pageUrl, imageMap, 'aside'));
    });
    const collections = detectCollections($, baseUrl, pageUrl, imageMap);
    const allImages = [];
    $('img').each((_, img) => {
        const src = normalizeUrl(baseUrl, $(img).attr('src') || $(img).attr('data-src') || $(img).attr('data-lazy-src') || '') || '';
        if (!src)
            return;
        if (imageMap.has(src)) {
            allImages.push(imageMap.get(src));
            return;
        }
        const si = extractImageAttributes($, img, baseUrl, pageUrl);
        const $el = $(img);
        const region = elementRegion($el, chromeNodes);
        si.region = region === 'unknown' && (mainEl && $.contains(mainEl, img)) ? 'main' : region;
        imageMap.set(src, si);
        allImages.push(si);
    });
    // Enrich with CrawledPage image metadata (dimensions, likely logo/hero flags from browser).
    for (const ci of crawledPage.images || []) {
        const key = normalizeUrl(baseUrl, ci.src) || ci.src;
        const si = imageMap.get(key);
        if (si) {
            si.width = si.width ?? ci.width;
            si.height = si.height ?? ci.height;
            si.provenance.isLogo = ci.likelyLogo;
            si.provenance.isHero = ci.likelyHero;
            si.alt = si.alt || ci.alt;
        }
    }
    const headerText = $(chromeNodes.header).text();
    const footerText = $(chromeNodes.footer).text();
    const phones = [...new Set([...extractPhones(headerText), ...extractPhones(footerText), ...extractPhones(crawledPage.text || '')])].slice(0, 5);
    const emails = [...new Set([...extractEmails(headerText), ...extractEmails(footerText), ...extractEmails(crawledPage.text || '')])].slice(0, 5);
    const socialLinks = extractSocialLinks(headerText + ' ' + footerText, [...headerLinks, ...footerLinks, ...navLinks]);
    const chrome = {
        header: { html: $(chromeNodes.header).first().html() || undefined, text: cleanText(headerText), links: headerLinks, images: headerImages },
        footer: { html: $(chromeNodes.footer).first().html() || undefined, text: cleanText(footerText), links: footerLinks, images: footerImages },
        nav: {
            primary: extractNavTree($, chromeNodes.nav[0] || chromeNodes.header[0], baseUrl, 'header') || navTreeFromLinks(headerLinks),
            secondary: extractNavTree($, chromeNodes.nav[1] || chromeNodes.footer[0], baseUrl, 'footer') || navTreeFromLinks(footerLinks),
            breadcrumbs: extractBreadcrumbs($, baseUrl, structuredData)
        },
        contacts: {
            phones,
            emails,
            addresses: evidence.addressCandidates.slice(0, 5),
            socialLinks,
            workingHours: workingHours(headerText) || workingHours(footerText)
        },
        logo: logoSrc ? { src: logoSrc, href: logoHref, alt: logoAlt } : undefined,
        favicon: favicon ? normalizeUrl(baseUrl, favicon) || favicon : undefined,
        themeColors: crawledPage.themeColors
    };
    const mainText = sections.map((s) => [s.heading, ...s.paragraphs].filter(Boolean).join('\n\n')).join('\n\n');
    const rawText = cleanText($.text());
    return {
        id: `sd-${index}-${slugFromUrl(pageUrl)}`,
        url: pageUrl,
        path: crawledPage.path,
        title,
        metaDescription,
        h1,
        canonicalUrl,
        language,
        isHomepage,
        depth: crawledPage.depth,
        priority: crawledPage.priority,
        chrome,
        sections: sections.filter((s) => s.paragraphs.length || s.lists.length || s.tables.length || s.images.length || s.heading),
        collections,
        structuredData,
        openGraph,
        evidence,
        images: allImages,
        mainText,
        rawText,
        html: crawledPage.html
    };
}
export function buildSourceDocuments(crawlResult) {
    const baseUrl = crawlResult.homepage?.url || crawlResult.pages[0]?.url || '';
    return crawlResult.pages.map((page, index) => buildSourceDocument(page, index, baseUrl));
}
export function sourceDocumentToCrawledPage(doc) {
    const headerImages = doc.images.filter((i) => i.region === 'header' || i.provenance.isHero);
    const heroImage = headerImages.sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0))[0]?.src;
    const images = doc.images.map((img) => ({
        src: img.src,
        alt: img.alt || '',
        width: img.width,
        height: img.height,
        area: img.width && img.height ? img.width * img.height : undefined,
        context: img.provenance.sourceSelector,
        likelyLogo: img.provenance.isLogo,
        likelyHero: img.provenance.isHero
    }));
    return {
        url: doc.url,
        title: doc.title,
        metaDescription: doc.metaDescription,
        h1: doc.h1 || '',
        canonicalUrl: doc.canonicalUrl,
        text: doc.mainText,
        html: doc.html,
        links: [...(doc.chrome.header?.links || []), ...(doc.chrome.footer?.links || []), ...doc.sections.flatMap((s) => s.links)].map((l) => ({ text: l.text, href: l.href, source: (l.source === 'nav' ? 'header' : l.source) })),
        images,
        logo: doc.chrome.logo?.src,
        logoHref: doc.chrome.logo?.href,
        favicon: doc.chrome.favicon,
        heroImage: heroImage || doc.chrome.logo?.src,
        themeColors: doc.chrome.themeColors,
        headerNav: doc.chrome.nav?.primary,
        footerNav: doc.chrome.nav?.secondary,
        path: doc.path,
        depth: doc.depth,
        priority: doc.priority,
        navItem: false
    };
}
