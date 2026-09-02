import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { discoverHomepage } from '../dist/crawl/homepageDiscovery.js';

function makePage(overrides = {}) {
  return {
    url: overrides.url ?? 'https://mapid.by/',
    title: overrides.title ?? 'Home',
    metaDescription: '',
    h1: overrides.h1 ?? 'Home',
    text: '',
    html: '',
    links: [],
    images: [],
    path: overrides.path ?? 'index',
    depth: 0,
    priority: 0,
    navItem: false,
    ...overrides,
  };
}

describe('discoverHomepage', () => {
  it('prefers the origin root over the contacts seed URL', () => {
    const contacts = makePage({
      url: 'https://mapid.by/kontakty.html',
      title: 'Контакты',
      h1: 'Контакты',
      path: 'kontakty',
    });
    const root = makePage({
      url: 'https://mapid.by/',
      title: 'Главная — MAPID',
      h1: 'MAPID',
      path: 'index',
    });
    const services = makePage({
      url: 'https://mapid.by/uslugi.html',
      title: 'Услуги',
      h1: 'Услуги',
      path: 'uslugi',
    });

    const navigation = [
      { label: 'Главная', url: 'https://mapid.by/', source: 'header', children: [] },
      { label: 'Контакты', url: 'https://mapid.by/kontakty.html', source: 'header', children: [] },
      { label: 'Услуги', url: 'https://mapid.by/uslugi.html', source: 'header', children: [] },
    ];

    const warnings = [];
    const result = discoverHomepage([contacts, root, services], contacts.url, navigation, 'https://mapid.by/', warnings);

    assert.equal(result.url, 'https://mapid.by/');
    assert.ok(result.confidence > 0.4, `expected confidence > 0.4, got ${result.confidence}`);
    assert.equal(result.pageIndex, 1);
    assert.ok(result.reason.includes('origin root') || result.reason.includes('URL is origin root') || result.reason.includes('H1 is not generic'));
  });

  it('detects homepage from rel=canonical and logo href pointing to root', () => {
    const contacts = makePage({
      url: 'https://mapid.by/kontakty.html',
      title: 'Контакты',
      h1: 'Контакты',
      path: 'kontakty',
    });
    const root = makePage({
      url: 'https://mapid.by/index.html',
      title: 'MAPID — Главная',
      h1: 'MAPID',
      path: 'index',
      canonicalUrl: 'https://mapid.by/',
      logoHref: 'https://mapid.by/',
    });

    const warnings = [];
    const result = discoverHomepage([contacts, root], contacts.url, [], 'https://mapid.by/', warnings);

    assert.equal(result.url, 'https://mapid.by/');
    assert.ok(result.confidence > 0.4, `expected confidence > 0.4, got ${result.confidence}`);
  });

  it('warns on low confidence and never returns a generic contacts page as homepage', () => {
    const contacts = makePage({
      url: 'https://mapid.by/kontakty.html',
      title: 'Контакты',
      h1: 'Контакты',
      path: 'kontakty',
    });

    const warnings = [];
    const result = discoverHomepage([contacts], contacts.url, [], 'https://mapid.by/', warnings);

    assert.notEqual(result.url, 'https://mapid.by/kontakty.html');
    assert.equal(result.url, 'https://mapid.by/');
    assert.ok(warnings.length > 0, 'expected low-confidence warning');
  });
});
