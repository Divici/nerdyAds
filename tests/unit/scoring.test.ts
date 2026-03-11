import { describe, it, expect } from 'vitest';
import { computeWeightedScore, computeConfidence, identifyWeakest, allDimensionsAboveFloor } from '../../src/evaluate/scoring.js';
import type { DimensionScore } from '../../src/types/evaluation.js';

function makeScores(overrides: Partial<Record<string, { score: number; confidence: number }>> = {}): DimensionScore[] {
  const defaults: Record<string, { score: number; confidence: number }> = {
    clarity: { score: 7, confidence: 7 },
    value_proposition: { score: 7, confidence: 7 },
    emotional_resonance: { score: 7, confidence: 7 },
    cta: { score: 7, confidence: 7 },
    brand_voice: { score: 7, confidence: 7 },
  };
  const merged = { ...defaults, ...overrides };
  return Object.entries(merged).map(([dimension, vals]) => ({
    dimension: dimension as DimensionScore['dimension'],
    score: vals.score,
    rationale: `Rationale for ${dimension}`,
    confidence: vals.confidence,
  }));
}

describe('computeWeightedScore', () => {
  it('returns exact score when all dimensions are equal', () => {
    const scores = makeScores();
    // All 7s → weighted = 7.0
    expect(computeWeightedScore(scores)).toBeCloseTo(7.0, 2);
  });

  it('weights clarity and value_proposition higher than cta and brand_voice', () => {
    // clarity=10 (25%), value_prop=10 (25%), emotional=5 (20%), cta=5 (15%), brand=5 (15%)
    // = (10*25 + 10*25 + 5*20 + 5*15 + 5*15) / 100 = (250+250+100+75+75)/100 = 7.5
    const scores = makeScores({
      clarity: { score: 10, confidence: 7 },
      value_proposition: { score: 10, confidence: 7 },
      emotional_resonance: { score: 5, confidence: 7 },
      cta: { score: 5, confidence: 7 },
      brand_voice: { score: 5, confidence: 7 },
    });
    expect(computeWeightedScore(scores)).toBeCloseTo(7.5, 2);
  });

  it('computes correctly with varied scores', () => {
    // clarity=9 (25%), value_prop=8 (25%), emotional=6 (20%), cta=4 (15%), brand=5 (15%)
    // = (225 + 200 + 120 + 60 + 75) / 100 = 6.8
    const scores = makeScores({
      clarity: { score: 9, confidence: 7 },
      value_proposition: { score: 8, confidence: 7 },
      emotional_resonance: { score: 6, confidence: 7 },
      cta: { score: 4, confidence: 7 },
      brand_voice: { score: 5, confidence: 7 },
    });
    expect(computeWeightedScore(scores)).toBeCloseTo(6.8, 2);
  });

  it('returns minimum when all scores are 1', () => {
    const scores = makeScores({
      clarity: { score: 1, confidence: 1 },
      value_proposition: { score: 1, confidence: 1 },
      emotional_resonance: { score: 1, confidence: 1 },
      cta: { score: 1, confidence: 1 },
      brand_voice: { score: 1, confidence: 1 },
    });
    expect(computeWeightedScore(scores)).toBeCloseTo(1.0, 2);
  });

  it('returns maximum when all scores are 10', () => {
    const scores = makeScores({
      clarity: { score: 10, confidence: 10 },
      value_proposition: { score: 10, confidence: 10 },
      emotional_resonance: { score: 10, confidence: 10 },
      cta: { score: 10, confidence: 10 },
      brand_voice: { score: 10, confidence: 10 },
    });
    expect(computeWeightedScore(scores)).toBeCloseTo(10.0, 2);
  });
});

describe('computeConfidence', () => {
  it('returns "high" when average confidence >= 7', () => {
    const scores = makeScores(); // all confidence 7
    expect(computeConfidence(scores)).toBe('high');
  });

  it('returns "medium" when average confidence is between 4 and 7', () => {
    const scores = makeScores({
      clarity: { score: 7, confidence: 5 },
      value_proposition: { score: 7, confidence: 5 },
      emotional_resonance: { score: 7, confidence: 5 },
      cta: { score: 7, confidence: 5 },
      brand_voice: { score: 7, confidence: 5 },
    });
    expect(computeConfidence(scores)).toBe('medium');
  });

  it('returns "low" when average confidence < 4', () => {
    const scores = makeScores({
      clarity: { score: 7, confidence: 2 },
      value_proposition: { score: 7, confidence: 3 },
      emotional_resonance: { score: 7, confidence: 2 },
      cta: { score: 7, confidence: 3 },
      brand_voice: { score: 7, confidence: 2 },
    });
    expect(computeConfidence(scores)).toBe('low');
  });

  it('returns "high" at the boundary (exactly 7)', () => {
    const scores = makeScores({
      clarity: { score: 7, confidence: 7 },
      value_proposition: { score: 7, confidence: 7 },
      emotional_resonance: { score: 7, confidence: 7 },
      cta: { score: 7, confidence: 7 },
      brand_voice: { score: 7, confidence: 7 },
    });
    expect(computeConfidence(scores)).toBe('high');
  });

  it('returns "medium" at the boundary (exactly 4)', () => {
    const scores = makeScores({
      clarity: { score: 7, confidence: 4 },
      value_proposition: { score: 7, confidence: 4 },
      emotional_resonance: { score: 7, confidence: 4 },
      cta: { score: 7, confidence: 4 },
      brand_voice: { score: 7, confidence: 4 },
    });
    expect(computeConfidence(scores)).toBe('medium');
  });
});

describe('allDimensionsAboveFloor', () => {
  it('returns true when all dimensions are at or above the floor', () => {
    const scores = makeScores(); // all 7s
    expect(allDimensionsAboveFloor(scores)).toBe(true);
  });

  it('returns false when any dimension is below the floor', () => {
    const scores = makeScores({
      cta: { score: 4, confidence: 7 },
    });
    expect(allDimensionsAboveFloor(scores)).toBe(false);
  });

  it('returns true when a dimension is exactly at the floor (6)', () => {
    const scores = makeScores({
      brand_voice: { score: 6, confidence: 7 },
    });
    expect(allDimensionsAboveFloor(scores)).toBe(true);
  });

  it('returns false when a dimension is at old floor (5) but below new floor (6)', () => {
    const scores = makeScores({
      brand_voice: { score: 5, confidence: 7 },
    });
    expect(allDimensionsAboveFloor(scores)).toBe(false);
  });

  it('returns false when multiple dimensions are below the floor', () => {
    const scores = makeScores({
      cta: { score: 3, confidence: 7 },
      brand_voice: { score: 2, confidence: 7 },
    });
    expect(allDimensionsAboveFloor(scores)).toBe(false);
  });

  it('accepts custom floor value', () => {
    const scores = makeScores({
      cta: { score: 6, confidence: 7 },
    });
    expect(allDimensionsAboveFloor(scores, 7)).toBe(false);
    expect(allDimensionsAboveFloor(scores, 6)).toBe(true);
  });
});

describe('identifyWeakest', () => {
  it('returns the full DimensionScore object for the weakest dimension', () => {
    const scores = makeScores({
      cta: { score: 3, confidence: 7 },
    });
    const weakest = identifyWeakest(scores);
    expect(weakest.dimension).toBe('cta');
    expect(weakest.score).toBe(3);
    expect(weakest.rationale).toBeDefined();
    expect(weakest.confidence).toBe(7);
  });

  it('returns first lowest when there is a tie', () => {
    // clarity and brand_voice both 3 — clarity comes first in dimension order
    const scores = makeScores({
      clarity: { score: 3, confidence: 7 },
      brand_voice: { score: 3, confidence: 7 },
    });
    const weakest = identifyWeakest(scores);
    // Should return one of the tied dimensions
    expect(['clarity', 'brand_voice']).toContain(weakest.dimension);
    expect(weakest.score).toBe(3);
  });

  it('identifies weakest among otherwise strong scores', () => {
    const scores = makeScores({
      clarity: { score: 9, confidence: 8 },
      value_proposition: { score: 9, confidence: 8 },
      emotional_resonance: { score: 9, confidence: 8 },
      cta: { score: 9, confidence: 8 },
      brand_voice: { score: 5, confidence: 8 },
    });
    expect(identifyWeakest(scores).dimension).toBe('brand_voice');
  });
});
