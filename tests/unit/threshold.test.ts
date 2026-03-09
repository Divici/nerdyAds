import { describe, it, expect } from 'vitest';
import { meetsThreshold, QualityRatchet } from '../../src/evaluate/threshold.js';

describe('meetsThreshold', () => {
  it('accepts score at exactly 7.0 with no running average', () => {
    expect(meetsThreshold(7.0)).toBe(true);
  });

  it('rejects score below 7.0 with no running average', () => {
    expect(meetsThreshold(6.9)).toBe(false);
  });

  it('accepts score well above threshold', () => {
    expect(meetsThreshold(9.0)).toBe(true);
  });

  it('uses ratchet threshold when running average is high', () => {
    // runningAvg = 8.5 → dynamic threshold = max(7.0, 8.5 - 0.5) = 8.0
    expect(meetsThreshold(8.0, 8.5)).toBe(true);
    expect(meetsThreshold(7.9, 8.5)).toBe(false);
  });

  it('falls back to 7.0 when ratchet would be lower', () => {
    // runningAvg = 7.2 → dynamic threshold = max(7.0, 7.2 - 0.5) = 7.0
    expect(meetsThreshold(7.0, 7.2)).toBe(true);
    expect(meetsThreshold(6.9, 7.2)).toBe(false);
  });

  it('uses static 7.0 when no running average provided', () => {
    expect(meetsThreshold(7.0)).toBe(true);
    expect(meetsThreshold(6.99)).toBe(false);
  });
});

describe('QualityRatchet', () => {
  it('starts with static threshold of 7.0', () => {
    const ratchet = new QualityRatchet();
    expect(ratchet.getThreshold()).toBeCloseTo(7.0, 2);
  });

  it('updates threshold as scores are recorded', () => {
    const ratchet = new QualityRatchet();
    ratchet.record(8.0);
    ratchet.record(9.0);
    // avg = 8.5 → threshold = max(7.0, 8.5 - 0.5) = 8.0
    expect(ratchet.getThreshold()).toBeCloseTo(8.0, 2);
  });

  it('never drops below 7.0', () => {
    const ratchet = new QualityRatchet();
    ratchet.record(7.2);
    ratchet.record(7.0);
    // avg = 7.1 → max(7.0, 7.1 - 0.5) = max(7.0, 6.6) = 7.0
    expect(ratchet.getThreshold()).toBeCloseTo(7.0, 2);
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
});
