import { runLighthouseForLead } from '../auditor/src/lighthouse/runLighthouse.js';

const leadId = 'cmthnoa78006gtnq37di8fi9z';
const url = 'https://mrs.by/filiali/remontno-stroitelniy-frunzenskogo-rayona/';

try {
  const result = await runLighthouseForLead({ leadId, url });
  console.log('Lighthouse OK', result.summary);
} catch (e) {
  console.error('Lighthouse failed', e);
}
