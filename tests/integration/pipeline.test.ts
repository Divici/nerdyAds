import { describe, it, expect, vi } from 'vitest';
import { runBatch, type BatchRunnerDeps } from '../../src/pipeline/batch-runner.js';
import { iterateAd, type IterationDeps } from '../../src/pipeline/iteration-loop.js';
import { MetricsTracker } from '../../src/metrics/tracker.js';
import { QualityRatchet } from '../../src/evaluate/threshold.js';
import type { Ad } from '../../src/types/ad.js';
import type { Brief } from '../../src/types/brief.js';
import type { Evaluation } from '../../src/types/evaluation.js';

// ── Helpers ──────────────────────────────────────────────────────────────

const makeAd = (id = 'ad-1', version = 0): Ad => ({
  id,
  briefId: 'brief-1',
  primaryText: 'Test ad text',
  headline: 'Test Headline',
  description: 'Test description',
  ctaButton: 'Learn More',
  version,
  metadata: {
    model: 'gemini-2.0-flash',
    seed: 42,
    promptHash: 'abc',
    tokensIn: 100,
    tokensOut: 50,
    costUsd: 0.001,
    generatedAt: '2026-03-09T00:00:00Z',
  },
});

const makeEval = (score: number, adId = 'ad-1'): Evaluation => ({
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
    promptHash: 'eval',
    tokensIn: 200,
    tokensOut: 100,
    costUsd: 0.005,
    generatedAt: '2026-03-09T00:00:00Z',
  },
});

const brief: Brief = {
  id: 'brief-1',
  targetAudience: 'student',
  campaignGoal: 'conversion',
  emotionalAngle: 'urgency',
  offer: 'Boost your SAT score',
};

// ── Scenario 1: Pass on first try ────────────────────────────────────────

describe('Pipeline Integration: pass first try', () => {
  it('accepts all ads without improvement when scores are high', async () => {
    const deps: BatchRunnerDeps = {
      generateBatch: vi.fn().mockResolvedValue([makeAd('a1'), makeAd('a2')]),
      evaluate: vi.fn().mockResolvedValue(makeEval(8.5)),
      improve: vi.fn(),
      checkThreshold: (score) => score >= 7.0,
      maxCycles: 3,
    };

    const result = await runBatch(brief, 2, deps);

    expect(result.ads).toHaveLength(2);
    expect(result.ads.every((a) => a.accepted)).toBe(true);
    expect(result.ads.every((a) => a.cyclesUsed === 0)).toBe(true);
    expect(deps.improve).not.toHaveBeenCalled();
  });
});

// ── Scenario 2: Improve then pass ────────────────────────────────────────

describe('Pipeline Integration: improve then pass', () => {
  it('ad fails first eval, editor fixes it, second eval passes', async () => {
    const deps: BatchRunnerDeps = {
      generateBatch: vi.fn().mockResolvedValue([makeAd('a1')]),
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(makeEval(5.0, 'a1'))  // first eval fails
        .mockResolvedValueOnce(makeEval(8.0, 'a1')), // second eval passes
      improve: vi.fn().mockResolvedValue(makeAd('a1', 1)),
      checkThreshold: (score) => score >= 7.0,
      maxCycles: 3,
    };

    const result = await runBatch(brief, 1, deps);

    expect(result.ads).toHaveLength(1);
    expect(result.ads[0].accepted).toBe(true);
    expect(result.ads[0].cyclesUsed).toBe(1);
    expect(result.ads[0].evaluations).toHaveLength(2);
    expect(deps.improve).toHaveBeenCalledTimes(1);
  });
});

// ── Scenario 3: Fail all cycles ──────────────────────────────────────────

describe('Pipeline Integration: fail all cycles', () => {
  it('rejects ad after exhausting 3 improvement cycles', async () => {
    const deps: BatchRunnerDeps = {
      generateBatch: vi.fn().mockResolvedValue([makeAd('a1')]),
      evaluate: vi.fn().mockResolvedValue(makeEval(4.0, 'a1')),
      improve: vi.fn().mockImplementation((ad: Ad) =>
        Promise.resolve(makeAd('a1', ad.version + 1)),
      ),
      checkThreshold: () => false,
      maxCycles: 3,
    };

    const result = await runBatch(brief, 1, deps);

    expect(result.ads[0].accepted).toBe(false);
    expect(result.ads[0].cyclesUsed).toBe(3);
    // 1 initial + 3 improvement evals
    expect(result.ads[0].evaluations).toHaveLength(4);
    expect(deps.improve).toHaveBeenCalledTimes(3);
  });
});

// ── Scenario 4: Quality ratchet increases threshold ──────────────────────

describe('Pipeline Integration: ratchet increases threshold', () => {
  it('ratchet raises threshold after accepting high-scoring ads', async () => {
    const ratchet = new QualityRatchet();

    // Simulate accepting several high-scoring ads to push ratchet up
    ratchet.record(9.0);
    ratchet.record(9.5);
    ratchet.record(9.0);
    // Running avg = 9.167, ratchet threshold = max(7.0, 9.167 - 0.5) = 8.667

    const threshold = ratchet.getThreshold();
    expect(threshold).toBeGreaterThan(8.0);

    // A score of 7.5 would normally pass the base threshold (7.0)
    // but should fail the ratcheted threshold
    expect(ratchet.check(7.5)).toBe(false);

    // A score of 9.0 should still pass
    expect(ratchet.check(9.0)).toBe(true);
  });

  it('ratchet integrates with iteration loop', async () => {
    const ratchet = new QualityRatchet();
    // Pre-load ratchet with high scores
    ratchet.record(9.0);
    ratchet.record(9.0);

    const deps: IterationDeps = {
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(makeEval(7.5))  // below ratchet
        .mockResolvedValueOnce(makeEval(7.8))  // still below
        .mockResolvedValueOnce(makeEval(9.0)), // above ratchet
      improve: vi.fn().mockImplementation((ad: Ad) =>
        Promise.resolve(makeAd(ad.id, ad.version + 1)),
      ),
      checkThreshold: (score) => {
        const passes = ratchet.check(score);
        if (passes) ratchet.record(score);
        return passes;
      },
      maxCycles: 3,
    };

    const result = await iterateAd(makeAd(), deps, brief);

    // 7.5 and 7.8 should fail the ratcheted threshold (~8.5)
    // 9.0 should pass
    expect(result.accepted).toBe(true);
    expect(result.cyclesUsed).toBe(2);
  });
});

// ── Metrics tracking integration ─────────────────────────────────────────

describe('Pipeline Integration: metrics tracking', () => {
  it('tracker correctly aggregates results from a batch', async () => {
    const tracker = new MetricsTracker();

    const deps: BatchRunnerDeps = {
      generateBatch: vi.fn().mockResolvedValue([makeAd('a1'), makeAd('a2'), makeAd('a3')]),
      evaluate: vi
        .fn()
        .mockResolvedValueOnce(makeEval(8.0, 'a1')) // a1 passes
        .mockResolvedValueOnce(makeEval(5.0, 'a2')) // a2 fails
        .mockResolvedValueOnce(makeEval(8.5, 'a2')) // a2 improved, passes
        .mockResolvedValueOnce(makeEval(3.0, 'a3')) // a3 fails
        .mockResolvedValueOnce(makeEval(3.5, 'a3')) // a3 still fails
        .mockResolvedValueOnce(makeEval(4.0, 'a3')) // a3 still fails
        .mockResolvedValueOnce(makeEval(4.5, 'a3')),// a3 max cycles
      improve: vi.fn().mockImplementation((ad: Ad) =>
        Promise.resolve(makeAd(ad.id, ad.version + 1)),
      ),
      checkThreshold: (score) => score >= 7.0,
      maxCycles: 3,
    };

    const result = await runBatch(brief, 3, deps);

    // Record results into tracker
    for (const adHistory of result.ads) {
      const lastEval = adHistory.evaluations[adHistory.evaluations.length - 1];
      tracker.recordAd({
        accepted: adHistory.accepted,
        score: lastEval.weightedScore,
        costUsd: 0.01,
        tokensIn: 300,
        tokensOut: 150,
        briefId: brief.id,
      });
    }

    const summary = tracker.getSummary();
    expect(summary.totalAdsGenerated).toBe(3);
    expect(summary.totalAdsAccepted).toBe(2); // a1 and a2 accepted
    expect(summary.acceptanceRate).toBeCloseTo(2 / 3, 4);
  });
});
