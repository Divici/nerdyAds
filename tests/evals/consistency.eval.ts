/**
 * Consistency Eval — verifies evaluator gives consistent scores for the same ad.
 * Evaluates the same ad 3x and asserts variance < 1.0 across runs.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { EvaluatorAgent } from '../../src/agents/evaluator.js';
import type { Ad } from '../../src/types/ad.js';

const TEST_AD: Ad = {
  id: 'consistency-test',
  briefId: 'eval-consistency',
  primaryText:
    "📊 Your child isn't struggling with the material—they're struggling with the test.\n\nThe digital SAT rewards strategy, not just knowledge. That's why high-achieving students often score below their potential.\n\n✓ Diagnostic pinpoints exact timing gaps\n✓ Digital interface training\n✓ 1-on-1 strategy coaching\n✓ Flexible scheduling around your timeline\n\nSmart students need smart test strategy.\n\nReady to see scores that match their ability?",
  headline: '3.8 GPA But 1180 SAT? Here\'s Why',
  description: 'Strategy-based SAT improvement',
  ctaButton: 'Learn more',
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

describe('Consistency Eval — same ad scored 3x', () => {
  const evaluator = new EvaluatorAgent();

  it('weighted score variance < 1.0 across 3 evaluations', async () => {
    const scores: number[] = [];

    for (let i = 0; i < 3; i++) {
      const evaluation = await evaluator.evaluate(TEST_AD);
      scores.push(evaluation.weightedScore);
    }

    const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance = scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length;
    const range = Math.max(...scores) - Math.min(...scores);

    console.log('Scores:', scores);
    console.log('Average:', avg, 'Variance:', variance, 'Range:', range);

    expect(variance).toBeLessThan(1.0);
    // Also check range is reasonable (< 2 points spread)
    expect(range).toBeLessThan(2.0);
  }, 120_000);

  it('per-dimension scores are consistent (range < 2 per dimension)', async () => {
    const dimensionScores: Record<string, number[]> = {};

    for (let i = 0; i < 3; i++) {
      const evaluation = await evaluator.evaluate(TEST_AD);
      for (const ds of evaluation.scores) {
        if (!dimensionScores[ds.dimension]) dimensionScores[ds.dimension] = [];
        dimensionScores[ds.dimension].push(ds.score);
      }
    }

    for (const [dim, scores] of Object.entries(dimensionScores)) {
      const range = Math.max(...scores) - Math.min(...scores);
      console.log(`${dim}: scores=${scores}, range=${range}`);
      expect(range).toBeLessThan(2);
    }
  }, 120_000);
});
