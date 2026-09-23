import { exec } from 'node:child_process';
import { launch } from 'chrome-launcher';
import { writeFile } from 'node:fs/promises';

const server = exec('python3 -m http.server 3467 --directory /Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation/agent/render');
await new Promise(r => setTimeout(r, 1200));
const { default: lighthouse } = await import('lighthouse');
const chrome = await launch({ chromeFlags: ['--headless', '--disable-gpu', '--ignore-certificate-errors'] });
const result = await lighthouse('http://localhost:3467/b3-agent.html', {
  port: chrome.port,
  output: 'json',
  logLevel: 'error',
  onlyCategories: ['performance']
});
await writeFile('/Users/aleksandr.ovcharenko/websiteLeadAgent/data/experiments/mapid/b3-generation/agent/lighthouse-debug.json', JSON.stringify({
  cls: result.lhr.audits['cumulative-layout-shift'],
  layoutShiftElements: result.lhr.audits['layout-shift-elements']
}, null, 2));
console.log('saved');
await chrome.kill();
server.kill();
