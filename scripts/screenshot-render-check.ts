import { chromium } from 'playwright';
import { join } from 'node:path';

const shots = [
  'lead2-mapid-desktop.png',
  'lead2-mapid-mobile.png',
  'lead3-versh-desktop.png',
  'lead3-versh-mobile.png',
  'lead4-radlen-desktop.png',
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const root = process.cwd();
  let allPass = true;

  for (const name of shots) {
    const file = join('file:', root, 'docs', 'radar-evidence', name);
    await page.goto(file);
    const img = await page.locator('img').first();
    const naturalWidth = await img.evaluate((el) => (el as HTMLImageElement).naturalWidth);
    const ok = naturalWidth > 0;
    console.log(`${name}: naturalWidth=${naturalWidth} ${ok ? 'PASS' : 'FAIL'}`);
    if (!ok) allPass = false;
  }

  await browser.close();
  if (!allPass) process.exit(1);
  console.log('All screenshot files render successfully');
}

main().catch((e) => { console.error(e); process.exit(1); });
