import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldCrawlUrl } from '../dist/crawl/crawlSite.js';

describe('Crawl URL blocking false positives', () => {
  it('allows normal pages and product/service paths', () => {
    assert.equal(shouldCrawlUrl('https://example.com/'), true);
    assert.equal(shouldCrawlUrl('https://example.com/about'), true);
    assert.equal(shouldCrawlUrl('https://example.com/privacy-policy'), true, 'page with privacy in slug should not be blocked by substring');
    assert.equal(shouldCrawlUrl('https://example.com/terms-of-service'), true, 'page with terms in slug should not be blocked by substring');
    assert.equal(shouldCrawlUrl('https://example.com/cookie-notice'), true, 'page with cookie in slug should not be blocked by substring');
    assert.equal(shouldCrawlUrl('https://example.com/printing-services'), true, 'page with print in slug should not be blocked');
    assert.equal(shouldCrawlUrl('https://example.com/search-results?q=test'), true, 'search results page path should not be blocked by substring');
    assert.equal(shouldCrawlUrl('https://example.com/uslugi/proektirovanie'), true, 'nested service path allowed');
  });

  it('blocks exact admin and auth paths', () => {
    assert.equal(shouldCrawlUrl('https://example.com/admin'), false);
    assert.equal(shouldCrawlUrl('https://example.com/wp-admin/'), false);
    assert.equal(shouldCrawlUrl('https://example.com/login'), false);
    assert.equal(shouldCrawlUrl('https://example.com/account/settings'), false);
    assert.equal(shouldCrawlUrl('https://example.com/wp-json/wp/v2/users'), false);
    assert.equal(shouldCrawlUrl('https://example.com/wp-content/uploads/image.jpg'), false);
  });

  it('blocks asset file extensions', () => {
    assert.equal(shouldCrawlUrl('https://example.com/brochure.pdf'), false);
    assert.equal(shouldCrawlUrl('https://example.com/photo.jpg'), false);
    assert.equal(shouldCrawlUrl('https://example.com/archive.zip'), false);
    assert.equal(shouldCrawlUrl('https://example.com/style.css'), false);
  });

  it('blocks tracking and action query parameters', () => {
    assert.equal(shouldCrawlUrl('https://example.com/page?utm_source=email'), false);
    assert.equal(shouldCrawlUrl('https://example.com/page?fbclid=abc'), false);
    assert.equal(shouldCrawlUrl('https://example.com/page?action=edit'), false);
    assert.equal(shouldCrawlUrl('https://example.com/page?replytocom=123'), false);
  });

  it('preserves useful pagination/category query parameters', () => {
    assert.equal(shouldCrawlUrl('https://example.com/news?page=2'), true);
    assert.equal(shouldCrawlUrl('https://example.com/news?category=5'), true);
    assert.equal(shouldCrawlUrl('https://example.com/news?tag=intro'), true);
  });
});
