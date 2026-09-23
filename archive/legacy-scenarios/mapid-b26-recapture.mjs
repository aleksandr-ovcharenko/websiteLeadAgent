import { captureScreenshots } from '../packages/redesign-engine/experiments/screenshots.mjs';
import { join } from 'node:path';

const B26 = '/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b26-cms';
const shots = await captureScreenshots({
  targets: [
    { name: 'b26-cms', url: `file://${B26}/render/b26-cms.html`, type: 'CMS_RENDER' },
    { name: 'b26-cms-mobile', url: `file://${B26}/render/b26-cms.html`, type: 'CMS_RENDER_MOBILE' },
    { name: 'b26-faithful', url: `file://${B26}/render/b26-cms-brand-faithful.html`, type: 'CMS_RENDER_FAITHFUL' },
    { name: 'b26-cms-roundtrip', url: `file://${B26}/render/b26-cms-roundtrip.html`, type: 'CMS_ROUNDTRIP' }
  ],
  outDir: join(B26, 'qa')
});
console.log('Recaptured:', shots.map((s) => s.path));
