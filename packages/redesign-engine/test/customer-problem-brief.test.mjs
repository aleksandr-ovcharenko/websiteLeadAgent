import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCustomerProblemBrief } from '../dist/plan/customerProblemBrief.js';
import { generateConcepts, validateConceptDiversity } from '../dist/plan/conceptSpec.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const planPath = (client) => path.resolve(__dirname, '..', '..', '..', 'data/redesign/pilot-2b', client, 'site-content-plan-v2.json');
const load = (client) => JSON.parse(fs.readFileSync(planPath(client), 'utf8'));

describe('CustomerProblemBrief', () => {
  for (const client of ['lishen', 'puzzlehouse', 'sdke']) {
    it(`builds a typed brief for ${client} without invented facts`, () => {
      const plan = load(client);
      const brief = buildCustomerProblemBrief(plan);
      assert.strictEqual(brief.siteKey, client);
      assert.ok(brief.sourceEvidence.length > 0);
      assert.ok(brief.whatTheCustomerSells.value.length > 0);
      assert.ok(brief.primaryCustomerJob.value);
      assert.ok(brief.businessModel.value);
      for (const e of brief.sourceEvidence) {
        if (e.inference) continue;
        assert.ok(e.value, 'non-inference evidence must have a value');
      }
    });
  }
});

describe('ConceptSpec diversity', () => {
  for (const client of ['lishen', 'puzzlehouse', 'sdke']) {
    it(`produces 3 diverse concepts for ${client}`, () => {
      const plan = load(client);
      const brief = buildCustomerProblemBrief(plan);
      const concepts = generateConcepts(plan, brief);
      assert.strictEqual(concepts.length, 3);
      const { ok, fails } = validateConceptDiversity(concepts);
      assert.strictEqual(ok, true, `diversity fails: ${fails.join('; ')}`);
      for (const c of concepts) {
        assert.ok(c.homepageSections.length >= 4);
        assert.ok(c.ctaStrategy.primary.label);
        assert.ok(c.rationale);
      }
    });
  }
});
