import { runLighthouseForLead, LighthouseError } from '../apps/auditor/src/lighthouse/runLighthouse.ts';
import { execSync } from 'node:child_process';

const leadId = 'cmthnoa78006gtnq37di8fi9z';
const url = 'https://mrs.by/filiali/remontno-stroitelniy-frunzenskogo-rayona/';

function chromeCount() {
  try {
    return Number(execSync("ps aux | grep -E '[C]hrome|[c]hromium' | wc -l", { encoding: 'utf-8' }).trim());
  } catch {
    return 0;
  }
}

const chromeBefore = chromeCount();
console.log('Chrome before timeout test:', chromeBefore);

let failed = false;
try {
  await runLighthouseForLead({ leadId, url, retries: 2, maxTimeMs: 10 });
} catch (e) {
  failed = true;
  console.log('Expected failure captured:', e.name, e.code, 'attempt', e.attempt, 'retryable', e.retryable);
  if (e instanceof LighthouseError) {
    console.log('LighthouseError.toJSON:', JSON.stringify(e.toJSON(), null, 2));
  } else {
    console.error('Not a LighthouseError:', e);
    process.exit(1);
  }
}

if (!failed) {
  console.error('Should have failed due to timeout');
  process.exit(1);
}

const afterFailure = chromeCount();
console.log('Chrome after failure:', afterFailure);

console.log('Now running a normal successful run...');
const result = await runLighthouseForLead({ leadId, url: 'https://mrs.by/' });
console.log('Success:', result.summary);
const afterSuccess = chromeCount();
console.log('Chrome after success:', afterSuccess);

