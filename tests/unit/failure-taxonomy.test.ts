import { describe, it, expect } from 'vitest';
import { classifyFailure, type FailureClassification } from '../../src/evaluate/failure-taxonomy.js';
import type { DimensionScore } from '../../src/types/evaluation.js';

function makeScores(overrides: Partial<Record<string, number>> = {}): DimensionScore[] {
  const defaults: Record<string, number> = {
    clarity: 7,
    value_proposition: 7,
    emotional_resonance: 7,
    cta: 7,
    brand_voice: 7,
  };
  const merged = { ...defaults, ...overrides };
  return Object.entries(merged).map(([dimension, score]) => ({
    dimension: dimension as DimensionScore['dimension'],
    score,
    rationale: `Rationale for ${dimension}`,
    confidence: 7,
  }));
}

describe('classifyFailure', () => {
  it('identifies weak clarity', () => {
    const result = classifyFailure(makeScores({ clarity: 3 }));
    expect(result.weakestDimension).toBe('clarity');
    expect(result.label).toMatch(/unclear/i);
  });

  it('identifies weak CTA', () => {
    const result = classifyFailure(makeScores({ cta: 2 }));
    expect(result.weakestDimension).toBe('cta');
    expect(result.label).toMatch(/cta/i);
  });

  it('identifies weak value proposition', () => {
    const result = classifyFailure(makeScores({ value_proposition: 3 }));
    expect(result.weakestDimension).toBe('value_proposition');
    expect(result.label).toMatch(/value/i);
  });

  it('identifies weak emotional resonance', () => {
    const result = classifyFailure(makeScores({ emotional_resonance: 2 }));
    expect(result.weakestDimension).toBe('emotional_resonance');
    expect(result.label).toMatch(/emotion/i);
  });

  it('identifies weak brand voice', () => {
    const result = classifyFailure(makeScores({ brand_voice: 3 }));
    expect(result.weakestDimension).toBe('brand_voice');
    expect(result.label).toMatch(/brand/i);
  });

  it('includes an improvement suggestion', () => {
    const result = classifyFailure(makeScores({ cta: 2 }));
    expect(result.suggestion).toBeTruthy();
    expect(result.suggestion.length).toBeGreaterThan(10);
  });

  it('returns multiple failures when several dimensions are weak', () => {
    const result = classifyFailure(makeScores({ clarity: 3, cta: 2 }));
    expect(result.allWeakDimensions.length).toBeGreaterThanOrEqual(2);
    // weakest should be cta (score 2)
    expect(result.weakestDimension).toBe('cta');
  });

  it('returns no weak dimensions when all scores are high', () => {
    const result = classifyFailure(makeScores({ clarity: 8, cta: 8, brand_voice: 9 }));
    expect(result.allWeakDimensions).toHaveLength(0);
    expect(result.label).toMatch(/below threshold/i);
  });
});
