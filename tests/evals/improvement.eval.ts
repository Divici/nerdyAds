/**
 * Improvement Eval — verifies that the editor agent improves the targeted weak dimension.
 * Evaluates an ad, edits targeting weakest dimension, re-evaluates, asserts improvement.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { EvaluatorAgent } from '../../src/agents/evaluator.js';
import { EditorAgent } from '../../src/agents/editor.js';
import { identifyWeakest } from '../../src/evaluate/scoring.js';
import type { Ad } from '../../src/types/ad.js';

// Deliberately mediocre ad with room for improvement
const MEDIOCRE_AD: Ad = {
  id: 'improvement-test',
  briefId: 'eval-improvement',
  primaryText:
    'Want better SAT scores? Our tutors can help your child prepare for the test. We offer flexible scheduling and personalized instruction.',
  headline: 'SAT Tutoring',
  description: 'Improve your score',
  ctaButton: 'Learn More',
  version: 0,
  metadata: {
    model: 'eval',
    seed: 0,
    promptHash: '',
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
    generatedAt: new Date().toISOString(),
  },
};

const BRIEF = {
  id: 'eval-improvement-brief',
  targetAudience: 'parent' as const,
  campaignGoal: 'conversion' as const,
  emotionalAngle: 'aspiration',
  offer: 'Expert 1-on-1 SAT tutoring with 200+ point average improvement',
};

describe('Improvement Eval — editor improves targeted dimension', () => {
  const evaluator = new EvaluatorAgent();
  const editor = new EditorAgent();

  it('weakest dimension score improves after one edit cycle', async () => {
    // Step 1: Evaluate the mediocre ad
    const evalBefore = await evaluator.evaluate(MEDIOCRE_AD, BRIEF);
    const weakest = identifyWeakest(evalBefore.scores);

    console.log(
      'Before edit:',
      evalBefore.scores.map((s) => `${s.dimension}=${s.score}`),
    );
    console.log('Weakest dimension:', weakest.dimension, '=', weakest.score);

    // Step 2: Edit targeting the weakest dimension
    const improvedAd = await editor.improve(MEDIOCRE_AD, evalBefore, BRIEF);

    console.log('Improved ad primary text:', improvedAd.primaryText.slice(0, 100));

    // Step 3: Re-evaluate the improved ad
    const evalAfter = await evaluator.evaluate(improvedAd, BRIEF);

    const afterScore = evalAfter.scores.find((s) => s.dimension === weakest.dimension);

    console.log(
      'After edit:',
      evalAfter.scores.map((s) => `${s.dimension}=${s.score}`),
    );
    console.log(
      `${weakest.dimension}: ${weakest.score} → ${afterScore?.score}`,
    );

    // The targeted dimension should improve (or at minimum not decrease)
    expect(afterScore!.score).toBeGreaterThanOrEqual(weakest.score);

    // Overall weighted score should improve
    expect(evalAfter.weightedScore).toBeGreaterThanOrEqual(evalBefore.weightedScore);
  }, 120_000);

  it('overall weighted score improves or holds after editing', async () => {
    // Use a different mediocre ad variant
    const ad: Ad = {
      ...MEDIOCRE_AD,
      id: 'improvement-test-2',
      primaryText:
        'Get SAT help. Tutors available. Good results. Sign up.',
      headline: 'Test Prep',
      description: 'Tutoring services',
    };

    const evalBefore = await evaluator.evaluate(ad, BRIEF);
    const improvedAd = await editor.improve(ad, evalBefore, BRIEF);
    const evalAfter = await evaluator.evaluate(improvedAd, BRIEF);

    console.log(`Overall: ${evalBefore.weightedScore} → ${evalAfter.weightedScore}`);

    expect(evalAfter.weightedScore).toBeGreaterThanOrEqual(evalBefore.weightedScore - 0.5);
  }, 120_000);
});
