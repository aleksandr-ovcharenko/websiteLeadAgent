import 'dotenv/config';
import { fetch2gisItems } from '../apps/collector/src/providers/2gis/fetch2gisItems.js';

async function main() {
  const apiKey = process.env.DGIS_API_KEY;
  if (!apiKey) throw new Error('DGIS_API_KEY not configured');

  const city = 'Минск';
  const query = 'строительные компании';
  const pageSize = 10;

  const items = await fetch2gisItems({ apiKey, city, query, page: 1, pageSize });

  if (items.length === 0) {
    console.error('FAIL: 2GIS smoke test returned 0 results');
    process.exit(1);
  }

  console.log(`PASS: 2GIS smoke test returned ${items.length} raw item(s)`);
  console.log(`First: ${items[0].name || 'n/a'} (${items[0].address_name || 'no address'})`);
}

main().catch((e) => {
  console.error('FAIL:', e.message);
  process.exit(1);
});
