import { describe, it, expect } from 'vitest';
import { meetsThreshold, QualityRatchet } from '../../src/evaluate/threshold.js';
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
    confidence: 8,
  }));
}

describe('meetsThreshold', () => {
  it('accepts score at exactly 7.5 with no running average', () => {
    expect(meetsThreshold(7.5)).toBe(true);
  });

  it('rejects score below 7.5 with no running average', () => {
    expect(meetsThreshold(7.4)).toBe(false);
  });

  it('accepts score well above threshold', () => {
    expect(meetsThreshold(9.0)).toBe(true);
  });

  it('uses ratchet threshold when running average is high', () => {
    // runningAvg = 8.5 → dynamic threshold = max(7.5, 8.5 - 0.5) = 8.0
    expect(meetsThreshold(8.0, 8.5)).toBe(true);
    expect(meetsThreshold(7.9, 8.5)).toBe(false);
  });

  it('falls back to 7.5 when ratchet would be lower', () => {
    // runningAvg = 7.8 → dynamic threshold = max(7.5, 7.8 - 0.5) = 7.5
    expect(meetsThreshold(7.5, 7.8)).toBe(true);
    expect(meetsThreshold(7.4, 7.8)).toBe(false);
  });

  it('uses static 7.5 when no running average provided', () => {
    expect(meetsThreshold(7.5)).toBe(true);
    expect(meetsThreshold(7.49)).toBe(false);
  });
});

describe('QualityRatchet', () => {
  it('starts with static threshold of 7.5', () => {
    const ratchet = new QualityRatchet();
    expect(ratchet.getThreshold()).toBeCloseTo(7.5, 2);
  });

  it('updates threshold as scores are recorded', () => {
    const ratchet = new QualityRatchet();
    ratchet.record(8.5);
    ratchet.record(9.5);
    // avg = 9.0 → threshold = max(7.5, 9.0 - 0.5) = 8.5
    expect(ratchet.getThreshold()).toBeCloseTo(8.5, 2);
  });

  it('never drops below 7.5', () => {
    const ratchet = new QualityRatchet();
    ratchet.record(7.8);
    ratchet.record(7.6);
    // avg = 7.7 → max(7.5, 7.7 - 0.5) = max(7.5, 7.2) = 7.5
    expect(ratchet.getThreshold()).toBeCloseTo(7.5, 2);
  });

  it('ratchets up with consistently high scores', () => {
    const ratchet = new QualityRatchet();
    ratchet.record(9.0);
    ratchet.record(9.0);
    ratchet.record(9.0);
    // avg = 9.0 → threshold = 8.5
    expect(ratchet.getThreshold()).toBeCloseTo(8.5, 2);
  });

  it('check method uses the dynamic threshold', () => {
    const ratchet = new QualityRatchet();
    ratchet.record(9.0);
    ratchet.record(9.0);
    // avg = 9.0 → threshold = 8.5
    expect(ratchet.check(8.5)).toBe(true);
    expect(ratchet.check(8.4)).toBe(false);
  });

  it('getAverage returns running average or undefined when empty', () => {
    const ratchet = new QualityRatchet();
    expect(ratchet.getAverage()).toBeUndefined();
    ratchet.record(8.0);
    expect(ratchet.getAverage()).toBeCloseTo(8.0, 2);
  });

  it('rejects ad when weighted score passes but a dimension is below floor', () => {
    const ratchet = new QualityRatchet();
    // Weighted score of 8.8 passes the 7.5 threshold,
    // but brand_voice=2 is below the dimension floor of 6
    const scores = makeScores({
      clarity: 10,
      value_proposition: 10,
      emotional_resonance: 10,
      cta: 10,
      brand_voice: 2,
    });
    // Weighted: (10*25 + 10*25 + 10*20 + 10*15 + 2*15) / 100 = 8.8
    expect(ratchet.check(8.8, scores)).toBe(false);
  });

  it('accepts ad when weighted score passes and all dimensions are above floor', () => {
    const ratchet = new QualityRatchet();
    const scores = makeScores({ cta: 7 });
    expect(ratchet.check(7.5, scores)).toBe(true);
  });

  it('accepts ad when no dimension scores provided (backward compat)', () => {
    const ratchet = new QualityRatchet();
    expect(ratchet.check(7.5)).toBe(true);
  });
});
