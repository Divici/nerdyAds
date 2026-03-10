import { describe, it, expect, vi } from 'vitest';
import { iterateAd, type IterationDeps } from '../../src/pipeline/iteration-loop.js';
import type { Ad } from '../../src/types/ad.js';
import type { Evaluation } from '../../src/types/evaluation.js';
import type { Brief } from '../../src/types/brief.js';

const makeAd = (overrides?: Partial<Ad>): Ad => ({
  id: 'ad-1',
  briefId: 'brief-1',
  primaryText: 'Test ad text',
  headline: 'Test Headline',
  description: 'Test description',
  ctaButton: 'Learn More',
  version: 0,
  metadata: {
    model: 'gemini-2.0-flash',
    seed: 42,
    promptHash: 'abc123',
    tokensIn: 100,
    tokensOut: 50,
    costUsd: 0.001,
    generatedAt: '2026-03-09T00:00:00Z',
  },
  ...overrides,
});

const makeEvaluation = (score: number, adId = 'ad-1'): Evaluation => ({
  adId,
  scores: [
    { dimension: 'clarity', score, rationale: 'ok', confidence: 8 },
    { dimension: 'value_proposition', score, rationale: 'ok', confidence: 8 },
    { dimension: 'emotional_resonance', score, rationale: 'ok', confidence: 8 },
    { dimension: 'cta', score, rationale: 'ok', confidence: 8 },
    { dimension: 'brand_voice', score, rationale: 'ok', confidence: 8 },
  ],
  weightedScore: score,
  overallConfidence: 'high',
  metadata: {
    model: 'gemini-2.0-pro',
    seed: 42,
    promptHash: 'eval123',
    tokensIn: 200,
    tokensOut: 100,
    costUsd: 0.005,
    generatedAt: '2026-03-09T00:00:00Z',
  },
});

const makeBrief = (): Brief => ({
  id: 'brief-1',
  targetAudience: 'student',
  campaignGoal: 'conversion',
  emotionalAngle: 'urgency',
  offer: 'Boost your SAT score',
});

describe('iterateAd', () => {
  it('accepts ad immediately if first eval passes threshold', async () => {
    const deps: IterationDeps = {
      evaluate: vi.fn().mockResolvedValue(makeEvaluation(8.0)),
      improve: vi.fn(),
      checkThreshold: () => true,
      maxCycles: 3,
    };

    const result = await iterateAd(makeAd(), deps, makeBrief());

    expect(result.accepted).toBe(true);
    expect(result.cyclesUsed).toBe(0);
    expect(result.evaluations).toHaveLength(1);
    expect(deps.improve).not.toHaveBeenCalled();
  });

  it('improves ad and accepts after editor fix passes threshold', async () => {
    const improvedAd = makeAd({ version: 1 });

    const deps: IterationDeps = {
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(makeEvaluation(5.0)) // first eval fails
        .mockResolvedValueOnce(makeEvaluation(8.0)), // second eval passes
      improve: vi.fn().mockResolvedValue(improvedAd),
      checkThreshold: (score: number) => score >= 7.0,
      maxCycles: 3,
    };

    const result = await iterateAd(makeAd(), deps, makeBrief());

    expect(result.accepted).toBe(true);
    expect(result.cyclesUsed).toBe(1);
    expect(result.evaluations).toHaveLength(2);
    expect(deps.improve).toHaveBeenCalledTimes(1);
  });

  it('rejects ad after exhausting all cycles', async () => {
    const deps: IterationDeps = {
      evaluate: vi.fn().mockResolvedValue(makeEvaluation(4.0)),
      improve: vi.fn().mockImplementation((ad: Ad) =>
        Promise.resolve(makeAd({ version: ad.version + 1 })),
      ),
      checkThreshold: () => false,
      maxCycles: 3,
    };

    const result = await iterateAd(makeAd(), deps, makeBrief());

    expect(result.accepted).toBe(false);
    expect(result.cyclesUsed).toBe(3);
    // 1 initial eval + 3 improvement evals = 4 total
    expect(result.evaluations).toHaveLength(4);
    expect(deps.improve).toHaveBeenCalledTimes(3);
  });

  it('tracks the final ad version after improvements', async () => {
    let version = 0;
    const deps: IterationDeps = {
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(makeEvaluation(4.0))
        .mockResolvedValueOnce(makeEvaluation(4.0))
        .mockResolvedValueOnce(makeEvaluation(8.0)),
      improve: vi.fn().mockImplementation(() => {
        version++;
        return Promise.resolve(makeAd({ version }));
      }),
      checkThreshold: (score: number) => score >= 7.0,
      maxCycles: 3,
    };

    const result = await iterateAd(makeAd(), deps, makeBrief());

    expect(result.accepted).toBe(true);
    expect(result.ad.version).toBe(2);
    expect(result.cyclesUsed).toBe(2);
  });

  it('works with maxCycles = 0 (evaluate only, no improvement)', async () => {
    const deps: IterationDeps = {
      evaluate: vi.fn().mockResolvedValue(makeEvaluation(5.0)),
      improve: vi.fn(),
      checkThreshold: () => false,
      maxCycles: 0,
    };

    const result = await iterateAd(makeAd(), deps, makeBrief());

    expect(result.accepted).toBe(false);
    expect(result.cyclesUsed).toBe(0);
    expect(result.evaluations).toHaveLength(1);
    expect(deps.improve).not.toHaveBeenCalled();
  });
});
