import { evaluateWebsiteEligibility } from '../apps/collector/src/utils/evaluateWebsiteEligibility.js';

const cases = [
  { url: 'https://bir.ibiz.by/', expected: false, expectedReason: 'DIRECTORY' },
  { url: 'https://ibiz.by/', expected: false, expectedReason: 'DIRECTORY' },
  { url: 'https://foo.ibiz.by/', expected: false, expectedReason: 'DIRECTORY' },
  { url: 'https://minsk.jsprav.ru/podemnyie-bashennyie-i-stroitelnyie-kranyi/vitsvitstroi/', expected: false, expectedReason: 'DIRECTORY' },
  { url: 'https://jsprav.ru/', expected: false, expectedReason: 'DIRECTORY' },
  { url: 'https://minsk.jsprav.ru/', expected: false, expectedReason: 'DIRECTORY' },
  { url: 'https://bel.zhodino.gov.by/2025/10/28/', expected: false, expectedReason: 'GOVERNMENT' },
  { url: 'https://zhodino.gov.by/', expected: false, expectedReason: 'GOVERNMENT' },
  { url: 'https://company.by/', expected: true },
  { url: 'https://www.company.by/', expected: true },
  { url: '', expected: false, expectedReason: 'NO_WEBSITE' },
  { url: null as any, expected: false, expectedReason: 'NO_WEBSITE' },
  { url: 'not-a-url', expected: false, expectedReason: 'INVALID_URL' },
];

let passed = 0;
const failures: string[] = [];

for (const c of cases) {
  const result = evaluateWebsiteEligibility(c.url);
  if (result.eligible !== c.expected) {
    failures.push(`FAIL ${c.url}: eligible=${result.eligible}, expected=${c.expected}`);
  } else if (c.expectedReason && result.reason !== c.expectedReason) {
    failures.push(`FAIL ${c.url}: reason=${result.reason}, expected=${c.expectedReason}`);
  } else {
    passed++;
  }
}

console.log(JSON.stringify({ passed, failed: failures.length, total: cases.length, failures }, null, 2));
if (failures.length) process.exit(1);
