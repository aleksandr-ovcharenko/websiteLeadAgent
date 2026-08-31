import { describe, it, expect } from 'vitest';
import { visualAnalysisProviderResultSchema } from './visualAnalysisSchema.js';

function base() {
  return {
    problems: ['p1'],
    strengths: ['s1'],
    summary: 'A concise summary of the website quality.',
  };
}

describe('visualAnalysisProviderResultSchema', () => {
  it('accepts numeric strings for score fields', () => {
    const result = visualAnalysisProviderResultSchema.parse({
      ...base(),
      modernity: '7',
      visualQuality: '6',
      mobileUX: '8',
      trust: '7',
      ctaQuality: '5',
      contentStructure: '8',
      visualHierarchy: '6',
      brandConsistency: '7',
      redesignPotential: '9',
    });
    expect(result.modernity).toBe(7);
    expect(result.redesignPotential).toBe(9);
  });

  it('rejects non-numeric strings', () => {
    expect(() => visualAnalysisProviderResultSchema.parse({
      ...base(),
      modernity: 'seven',
      visualQuality: 6,
      mobileUX: 8,
      trust: 7,
      ctaQuality: 5,
      contentStructure: 8,
      visualHierarchy: 6,
      brandConsistency: 7,
      redesignPotential: 9,
    })).toThrow();
  });

  it('rejects out of range values', () => {
    expect(() => visualAnalysisProviderResultSchema.parse({
      ...base(),
      modernity: 100,
      visualQuality: 6,
      mobileUX: 8,
      trust: 7,
      ctaQuality: 5,
      contentStructure: 8,
      visualHierarchy: 6,
      brandConsistency: 7,
      redesignPotential: 9,
    })).toThrow();
  });

  it('rejects null', () => {
    expect(() => visualAnalysisProviderResultSchema.parse({
      ...base(),
      modernity: null,
      visualQuality: 6,
      mobileUX: 8,
      trust: 7,
      ctaQuality: 5,
      contentStructure: 8,
      visualHierarchy: 6,
      brandConsistency: 7,
      redesignPotential: 9,
    })).toThrow();
  });
});
