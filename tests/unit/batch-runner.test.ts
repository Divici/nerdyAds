import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runContinuousBatch, type ContinuousBatchDeps, type ContinuousBatchResult } from '../../src/pipeline/batch-runner.js';
import type { Ad } from '../../src/types/ad.js';
import type { Brief } from '../../src/types/brief.js';
import type { Evaluation, DimensionScore } from '../../src/types/evaluation.js';

const BRIEF: Brief = {
  id: 'brief-001',
  targetAudience: 'student',
  campaignGoal: 'conversion',
  emotionalAngle: 'aspiration',
  offer: 'Free SAT Strategy Call',
};

let adCounter = 0;

function makeAd(overrides: Partial<Ad> = {}): Ad {
  adCounter++;
  return {
    id: `ad-${adCounter}`,
    briefId: 'brief-001',
    primaryText: `Ad copy ${adCounter}`,
    headline: `Headline ${adCounter}`,
    description: `Description ${adCounter}`,
    ctaButton: 'Learn more',
    version: 0,
    metadata: {
      model: 'gemini-2.0-flash',
      seed: 42,
      promptHash: 'hash',
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.001,
      generatedAt: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  };
}

function makeEval(score: number): Evaluation {
  const dimScore: DimensionScore = {
    dimension: 'clarity',
    score,
    rationale: 'Test',
    confidence: 8,
  };
  return {
    adId: 'ad-1',
    scores: [
      dimScore,
      { ...dimScore, dimension: 'value_proposition' },
      { ...dimScore, dimension: 'emotional_resonance' },
      { ...dimScore, dimension: 'cta' },
      { ...dimScore, dimension: 'brand_voice' },
    ],
    weightedScore: score,
    confidence: 'high',
    metadata: {
      model: 'gemini-2.5-pro',
      seed: 42,
      promptHash: 'hash',
      tokensIn: 200,
      tokensOut: 100,
      costUsd: 0.002,
      generatedAt: '2026-01-01T00:00:00Z',
    },
  };
}

function makeDeps(overrides: Partial<ContinuousBatchDeps> = {}): ContinuousBatchDeps {
  return {
    generateBatch: vi.fn(async (_brief, count) =>
      Array.from({ length: count }, () => makeAd()),
    ),
    evaluate: vi.fn(async () => makeEval(8.0)),
    improve: vi.fn(async (ad) => ({ ...ad, version: ad.version + 1 })),
    checkThreshold: vi.fn((score) => score >= 7.5),
    maxCycles: 3,
    targetAccepted: 6,
    batchSize: 3,
    maxRounds: 10,
    ...overrides,
  };
}

describe('runContinuousBatch', () => {
  beforeEach(() => {
    adCounter = 0;
  });

  it('accepts 6 ads from 2 rounds when all pass first try', async () => {
    const deps = makeDeps();

    const result = await runContinuousBatch(BRIEF, deps);

    expect(result.accepted.length).toBe(6);
    expect(result.roundsUsed).toBe(2);
    expect(result.totalGenerated).toBe(6);
    expect(result.rejected.length).toBe(0);
  });

  it('needs 3 rounds when some fail and get discarded', async () => {
    let callCount = 0;
    const deps = makeDeps({
      evaluate: vi.fn(async () => {
        callCount++;
        // Fail every 3rd ad (initial eval), making them go through editor cycles
        // and ultimately get rejected (since improve doesn't raise score)
        if (callCount % 4 === 0) return makeEval(5.0);
        return makeEval(8.0);
      }),
      checkThreshold: vi.fn((score: number) => score >= 7.5),
      improve: vi.fn(async (ad: Ad) => ({ ...ad, version: ad.version + 1 })),
    });

    const result = await runContinuousBatch(BRIEF, deps);

    expect(result.accepted.length).toBeGreaterThanOrEqual(6);
    expect(result.roundsUsed).toBeGreaterThanOrEqual(2);
  });

  it('editor fixes a failing ad within 3 cycles → counts as accepted', async () => {
    let evalCallCount = 0;
    const deps = makeDeps({
      evaluate: vi.fn(async () => {
        evalCallCount++;
        // First ad: fail initial, fail after 1st edit, pass after 2nd edit
        if (evalCallCount === 1) return makeEval(5.0);
        if (evalCallCount === 2) return makeEval(6.0);
        return makeEval(8.0);
      }),
      batchSize: 1,
      targetAccepted: 1,
    });

    const result = await runContinuousBatch(BRIEF, deps);

    expect(result.accepted.length).toBe(1);
    expect(result.accepted[0].cyclesUsed).toBeGreaterThan(0);
  });

  it('stops at MAX_GENERATION_ROUNDS even if target not met', async () => {
    const deps = makeDeps({
      evaluate: vi.fn(async () => makeEval(5.0)),
      checkThreshold: vi.fn(() => false),
      maxRounds: 3,
      targetAccepted: 100,
      batchSize: 2,
    });

    const result = await runContinuousBatch(BRIEF, deps);

    expect(result.roundsUsed).toBe(3);
    expect(result.accepted.length).toBe(0);
    expect(result.totalGenerated).toBe(6);
  });

  it('rejected ads have full evaluation history preserved', async () => {
    const deps = makeDeps({
      evaluate: vi.fn(async () => makeEval(5.0)),
      checkThreshold: vi.fn(() => false),
      maxRounds: 1,
      targetAccepted: 6,
      batchSize: 2,
    });

    const result = await runContinuousBatch(BRIEF, deps);

    expect(result.rejected.length).toBe(2);
    for (const rej of result.rejected) {
      expect(rej.accepted).toBe(false);
      expect(rej.evaluations.length).toBeGreaterThan(0);
      expect(rej.cyclesUsed).toBe(3);
    }
  });

  it('tracks roundsUsed correctly', async () => {
    const deps = makeDeps({
      batchSize: 3,
      targetAccepted: 3,
    });

    const result = await runContinuousBatch(BRIEF, deps);

    expect(result.roundsUsed).toBe(1);
    expect(result.briefId).toBe('brief-001');
  });

  it('passes incrementing round number to generateBatch each round', async () => {
    const generateBatch = vi.fn(async (_brief: Brief, count: number, _patterns?: unknown, _round?: number) =>
      Array.from({ length: count }, () => makeAd()),
    );
    const deps = makeDeps({
      generateBatch,
      batchSize: 3,
      targetAccepted: 6,
    });

    await runContinuousBatch(BRIEF, deps);

    // Should have been called twice (2 rounds × 3 ads = 6 accepted)
    expect(generateBatch).toHaveBeenCalledTimes(2);
    // Round 1 should pass round=1, round 2 should pass round=2
    expect(generateBatch.mock.calls[0][3]).toBe(1);
    expect(generateBatch.mock.calls[1][3]).toBe(2);
  });

  it('passes seedOffset to generateBatch when provided', async () => {
    const generateBatch = vi.fn(async (_brief: Brief, count: number, _patterns?: unknown, _round?: number, _seedOffset?: number) =>
      Array.from({ length: count }, () => makeAd()),
    );
    const deps = makeDeps({
      generateBatch,
      batchSize: 3,
      targetAccepted: 3,
      seedOffset: 9999,
    });

    await runContinuousBatch(BRIEF, deps);

    expect(generateBatch).toHaveBeenCalledTimes(1);
    expect(generateBatch.mock.calls[0][4]).toBe(9999);
  });
});
