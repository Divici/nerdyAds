import { describe, it, expect } from 'vitest';
import {
  DIMENSION_WEIGHTS,
  DIMENSIONS,
  getDimensionWeight,
} from '@config/weights.js';
import {
  QUALITY_THRESHOLD,
  MAX_CYCLES,
  RATCHET_BUFFER,
  MIN_SCORE,
  MAX_SCORE,
  MIN_DIMENSION_SCORE,
  TARGET_ACCEPTED_PER_BRIEF,
  BATCH_SIZE,
  MAX_GENERATION_ROUNDS,
} from '@config/thresholds.js';
import {
  MODELS,
  TOKEN_PRICING,
  DEFAULT_SEED,
} from '@config/models.js';

describe('Dimension weights', () => {
  it('weights sum to 100', () => {
    const total = Object.values(DIMENSION_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBe(100);
  });

  it('has exactly 5 dimensions', () => {
    expect(Object.keys(DIMENSION_WEIGHTS)).toHaveLength(5);
  });

  it('all weights are positive', () => {
    for (const weight of Object.values(DIMENSION_WEIGHTS)) {
      expect(weight).toBeGreaterThan(0);
    }
  });

  it('DIMENSIONS array matches weight keys', () => {
    expect([...DIMENSIONS].sort()).toEqual(Object.keys(DIMENSION_WEIGHTS).sort());
  });

  it('getDimensionWeight returns correct weight', () => {
    expect(getDimensionWeight('clarity')).toBe(25);
    expect(getDimensionWeight('cta')).toBe(15);
  });
});

describe('Thresholds', () => {
  it('QUALITY_THRESHOLD is 7.5', () => {
    expect(QUALITY_THRESHOLD).toBe(7.5);
  });

  it('MAX_CYCLES is 3', () => {
    expect(MAX_CYCLES).toBe(3);
  });

  it('RATCHET_BUFFER is 0.5', () => {
    expect(RATCHET_BUFFER).toBe(0.5);
  });

  it('MIN_SCORE is 1 and MAX_SCORE is 10', () => {
    expect(MIN_SCORE).toBe(1);
    expect(MAX_SCORE).toBe(10);
  });

  it('MIN_DIMENSION_SCORE is 6', () => {
    expect(MIN_DIMENSION_SCORE).toBe(6);
  });

  it('TARGET_ACCEPTED_PER_BRIEF is 6', () => {
    expect(TARGET_ACCEPTED_PER_BRIEF).toBe(6);
  });

  it('BATCH_SIZE is 3', () => {
    expect(BATCH_SIZE).toBe(3);
  });

  it('MAX_GENERATION_ROUNDS is 10', () => {
    expect(MAX_GENERATION_ROUNDS).toBe(10);
  });
});

describe('Model config', () => {
  it('has flash and pro model configs', () => {
    expect(MODELS.flash).toBeDefined();
    expect(MODELS.pro).toBeDefined();
  });

  it('flash model has correct fields', () => {
    expect(MODELS.flash.modelId).toBeDefined();
    expect(MODELS.flash.temperature).toBeGreaterThanOrEqual(0);
    expect(MODELS.flash.temperature).toBeLessThanOrEqual(2);
  });

  it('pro model has correct fields', () => {
    expect(MODELS.pro.modelId).toBeDefined();
    expect(MODELS.pro.temperature).toBeGreaterThanOrEqual(0);
    expect(MODELS.pro.temperature).toBeLessThanOrEqual(2);
  });

  it('TOKEN_PRICING has per-token costs for both models', () => {
    expect(TOKEN_PRICING.flash.inputPerToken).toBeGreaterThan(0);
    expect(TOKEN_PRICING.flash.outputPerToken).toBeGreaterThan(0);
    expect(TOKEN_PRICING.pro.inputPerToken).toBeGreaterThan(0);
    expect(TOKEN_PRICING.pro.outputPerToken).toBeGreaterThan(0);
  });

  it('DEFAULT_SEED is a positive integer', () => {
    expect(Number.isInteger(DEFAULT_SEED)).toBe(true);
    expect(DEFAULT_SEED).toBeGreaterThan(0);
  });
});
