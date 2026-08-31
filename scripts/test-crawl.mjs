import { crawlSite } from '../packages/redesign-engine/dist/index.js';

const url = process.argv[2] || 'https://versh.by/';
console.log('Crawling', url);
const { pages, navigation } = await crawlSite({ baseUrl: url, maxPages: 20, maxDepth: 3 });
console.log('\n=== NAVIGATION TREE ===');
console.log(JSON.stringify(navigation, null, 2));
console.log('\n=== DISCOVERED PAGES ===');
console.log(pages.map((p, i) => `${i + 1}. [depth ${p.depth}] ${p.url} — ${p.title}`).join('\n'));
console.log('\nTotal pages:', pages.length);
