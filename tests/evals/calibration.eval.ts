/**
 * Calibration Eval — verifies evaluator ranks reference set tiers correctly.
 * Asserts: strong avg > medium avg > weak avg with ≥1.0 point gap.
 * Also asserts: no individual strong ad scores below any weak ad.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { EvaluatorAgent } from '../../src/agents/evaluator.js';
import type { Ad } from '../../src/types/ad.js';

interface ReferenceAd {
  id: string;
  copy_tier: 'strong' | 'medium' | 'weak';
  primary_text: string;
  headline: string;
  description: string;
  cta_button: string;
}

function refToAd(ref: ReferenceAd): Ad {
  return {
    id: ref.id,
    briefId: 'calibration',
    primaryText: ref.primary_text || '(no copy)',
    headline: ref.headline,
    description: ref.description || '',
    ctaButton: ref.cta_button || 'Learn More',
    version: 0,
    metadata: {
      model: 'reference',
      seed: 0,
      promptHash: '',
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      generatedAt: new Date().toISOString(),
    },
  };
}

async function loadRefAds(): Promise<ReferenceAd[]> {
  const raw = await readFile(path.resolve('data/reference/reference-set.json'), 'utf8');
  return JSON.parse(raw);
}

describe('Calibration Eval — reference set tier ranking', () => {
  const evaluator = new EvaluatorAgent();

  it('strong tier avg > medium tier avg > weak tier avg with ≥1.0 gap', async () => {
    const refAds = await loadRefAds();

    // Evaluate all ads in parallel (rate limiter handles concurrency)
    const results = await Promise.all(
      refAds.map(async (ref) => {
        const ad = refToAd(ref);
        const evaluation = await evaluator.evaluate(ad);
        return { tier: ref.copy_tier, id: ref.id, score: evaluation.weightedScore };
      }),
    );

    const tiers: Record<string, number[]> = { strong: [], medium: [], weak: [] };
    for (const r of results) {
      tiers[r.tier].push(r.score);
    }

    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

    const strongAvg = avg(tiers.strong);
    const mediumAvg = avg(tiers.medium);
    const weakAvg = avg(tiers.weak);

    console.log('Tier averages:', { strongAvg, mediumAvg, weakAvg });
    console.log('Strong scores:', tiers.strong);
    console.log('Medium scores:', tiers.medium);
    console.log('Weak scores:', tiers.weak);

    // Tier ordering
    expect(strongAvg).toBeGreaterThan(mediumAvg);
    expect(mediumAvg).toBeGreaterThan(weakAvg);

    // Meaningful separation (≥1.0 point gap)
    expect(strongAvg - mediumAvg).toBeGreaterThanOrEqual(1.0);
    expect(mediumAvg - weakAvg).toBeGreaterThanOrEqual(1.0);
  }, 300_000);

  it('no individual strong ad scores below any weak ad', async () => {
    const refAds = await loadRefAds();
    const filtered = refAds.filter((r) => r.copy_tier === 'strong' || r.copy_tier === 'weak');

    // Evaluate in parallel
    const results = await Promise.all(
      filtered.map(async (ref) => {
        const ad = refToAd(ref);
        const evaluation = await evaluator.evaluate(ad);
        return { tier: ref.copy_tier, id: ref.id, score: evaluation.weightedScore };
      }),
    );

    const strong = results.filter((r) => r.tier === 'strong');
    const weak = results.filter((r) => r.tier === 'weak');

    const minStrong = Math.min(...strong.map((s) => s.score));
    const maxWeak = Math.max(...weak.map((s) => s.score));

    console.log('Strong:', strong.map((s) => `${s.id}=${s.score}`));
    console.log('Weak:', weak.map((s) => `${s.id}=${s.score}`));
    console.log('Min strong:', minStrong, 'Max weak:', maxWeak);

    expect(minStrong).toBeGreaterThan(maxWeak);
  }, 300_000);
});
