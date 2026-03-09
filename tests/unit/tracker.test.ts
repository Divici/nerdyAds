import { describe, it, expect } from 'vitest';
import { MetricsTracker } from '../../src/metrics/tracker.js';

describe('MetricsTracker', () => {
  it('starts with zero totals', () => {
    const tracker = new MetricsTracker();
    const summary = tracker.getSummary();
    expect(summary.totalAdsGenerated).toBe(0);
    expect(summary.totalAdsAccepted).toBe(0);
    expect(summary.acceptanceRate).toBe(0);
    expect(summary.averageScore).toBe(0);
    expect(summary.totalCostUsd).toBe(0);
    expect(summary.totalTokensIn).toBe(0);
    expect(summary.totalTokensOut).toBe(0);
  });

  it('records accepted ads and computes acceptance rate', () => {
    const tracker = new MetricsTracker();
    tracker.recordAd({ accepted: true, score: 8.0, costUsd: 0.01, tokensIn: 100, tokensOut: 50 });
    tracker.recordAd({ accepted: false, score: 5.0, costUsd: 0.01, tokensIn: 100, tokensOut: 50 });
    tracker.recordAd({ accepted: true, score: 7.5, costUsd: 0.01, tokensIn: 100, tokensOut: 50 });

    const summary = tracker.getSummary();
    expect(summary.totalAdsGenerated).toBe(3);
    expect(summary.totalAdsAccepted).toBe(2);
    expect(summary.acceptanceRate).toBeCloseTo(2 / 3, 4);
  });

  it('computes average score across all ads', () => {
    const tracker = new MetricsTracker();
    tracker.recordAd({ accepted: true, score: 8.0, costUsd: 0, tokensIn: 0, tokensOut: 0 });
    tracker.recordAd({ accepted: false, score: 4.0, costUsd: 0, tokensIn: 0, tokensOut: 0 });

    expect(tracker.getSummary().averageScore).toBeCloseTo(6.0, 4);
  });

  it('accumulates cost and tokens', () => {
    const tracker = new MetricsTracker();
    tracker.recordAd({ accepted: true, score: 7.0, costUsd: 0.005, tokensIn: 200, tokensOut: 100 });
    tracker.recordAd({ accepted: true, score: 8.0, costUsd: 0.010, tokensIn: 300, tokensOut: 150 });

    const summary = tracker.getSummary();
    expect(summary.totalCostUsd).toBeCloseTo(0.015, 8);
    expect(summary.totalTokensIn).toBe(500);
    expect(summary.totalTokensOut).toBe(250);
  });

  it('tracks quality trend in order of recording', () => {
    const tracker = new MetricsTracker();
    tracker.recordAd({ accepted: true, score: 6.0, costUsd: 0, tokensIn: 0, tokensOut: 0 });
    tracker.recordAd({ accepted: true, score: 8.0, costUsd: 0, tokensIn: 0, tokensOut: 0 });
    tracker.recordAd({ accepted: false, score: 5.0, costUsd: 0, tokensIn: 0, tokensOut: 0 });

    expect(tracker.getQualityTrend()).toEqual([6.0, 8.0, 5.0]);
  });

  it('tracks failure reasons', () => {
    const tracker = new MetricsTracker();
    tracker.recordFailure('low_clarity');
    tracker.recordFailure('weak_cta');
    tracker.recordFailure('low_clarity');

    const failures = tracker.getFailureCounts();
    expect(failures).toEqual({ low_clarity: 2, weak_cta: 1 });
  });

  it('generates batch metrics for a brief', () => {
    const tracker = new MetricsTracker();
    tracker.recordAd({ accepted: true, score: 8.0, costUsd: 0.01, tokensIn: 100, tokensOut: 50, briefId: 'b1' });
    tracker.recordAd({ accepted: false, score: 5.0, costUsd: 0.02, tokensIn: 200, tokensOut: 100, briefId: 'b1' });
    tracker.recordAd({ accepted: true, score: 7.5, costUsd: 0.01, tokensIn: 100, tokensOut: 50, briefId: 'b2' });

    const b1Metrics = tracker.getBatchMetrics('b1');
    expect(b1Metrics.briefId).toBe('b1');
    expect(b1Metrics.adsGenerated).toBe(2);
    expect(b1Metrics.adsAccepted).toBe(1);
    expect(b1Metrics.acceptanceRate).toBeCloseTo(0.5, 4);
    expect(b1Metrics.averageScore).toBeCloseTo(6.5, 4);
    expect(b1Metrics.costUsd).toBeCloseTo(0.03, 8);
  });

  it('returns zeroed batch metrics for unknown brief', () => {
    const tracker = new MetricsTracker();
    const metrics = tracker.getBatchMetrics('unknown');
    expect(metrics.adsGenerated).toBe(0);
    expect(metrics.acceptanceRate).toBe(0);
  });
});
