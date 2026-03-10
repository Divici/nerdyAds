/**
 * Regression Eval — verifies that editing doesn't tank other dimensions.
 * After editor improves weakest dimension, other dimensions should not drop > 1 point.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { EvaluatorAgent } from '../../src/agents/evaluator.js';
import { EditorAgent } from '../../src/agents/editor.js';
import { identifyWeakest } from '../../src/evaluate/scoring.js';
import type { Ad } from '../../src/types/ad.js';
import type { DimensionName } from '../../src/types/evaluation.js';

// Ad with one clear weakness but decent other dimensions
const TEST_AD: Ad = {
  id: 'regression-test',
  briefId: 'eval-regression',
  primaryText:
    "Your child's 3.8 GPA says they're smart. Their 1180 SAT says the test doesn't show it. The digital SAT rewards strategy, not just knowledge. Our diagnostic finds the gaps. 1-on-1 coaching fills them. Average improvement: 200+ points in 8 weeks.",
  headline: 'Smart Kids. Low Scores. We Fix That.',
  description: 'Expert SAT strategy coaching',
  ctaButton: 'Stuff',  // deliberately weak CTA
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
  id: 'eval-regression-brief',
  targetAudience: 'parent' as const,
  campaignGoal: 'conversion' as const,
  emotionalAngle: 'aspiration',
  offer: 'Expert 1-on-1 SAT tutoring with 200+ point average improvement',
};

describe('Regression Eval — editing preserves non-targeted dimensions', () => {
  const evaluator = new EvaluatorAgent();
  const editor = new EditorAgent();

  it('non-targeted dimensions do not drop more than 1 point after edit', async () => {
    // Step 1: Evaluate original
    const evalBefore = await evaluator.evaluate(TEST_AD, BRIEF);
    const weakest = identifyWeakest(evalBefore.scores);

    console.log(
      'Before:',
      evalBefore.scores.map((s) => `${s.dimension}=${s.score}`),
    );
    console.log('Targeting:', weakest.dimension);

    // Step 2: Edit
    const improvedAd = await editor.improve(TEST_AD, evalBefore, BRIEF);

    // Step 3: Re-evaluate
    const evalAfter = await evaluator.evaluate(improvedAd, BRIEF);

    console.log(
      'After:',
      evalAfter.scores.map((s) => `${s.dimension}=${s.score}`),
    );

    // Step 4: Check non-targeted dimensions didn't regress badly
    const regressions: string[] = [];
    for (const scoreBefore of evalBefore.scores) {
      if (scoreBefore.dimension === weakest.dimension) continue;

      const scoreAfter = evalAfter.scores.find(
        (s) => s.dimension === scoreBefore.dimension,
      );
      if (!scoreAfter) continue;

      const drop = scoreBefore.score - scoreAfter.score;
      if (drop > 1) {
        regressions.push(
          `${scoreBefore.dimension}: ${scoreBefore.score} → ${scoreAfter.score} (dropped ${drop})`,
        );
      }
    }

    if (regressions.length > 0) {
      console.log('Regressions found:', regressions);
    }

    expect(regressions).toHaveLength(0);
  }, 120_000);

  it('max regression across all non-targeted dimensions is ≤ 1 point', async () => {
    // Second test with a different ad for robustness
    const ad2: Ad = {
      ...TEST_AD,
      id: 'regression-test-2',
      primaryText:
        'Improve your SAT score with expert tutoring. Our experienced tutors help students achieve better results. Personalized study plans. Flexible scheduling.',
      headline: 'Raise Your SAT Score',
      description: 'Professional SAT preparation',
      ctaButton: 'Learn More',
    };

    const evalBefore = await evaluator.evaluate(ad2, BRIEF);
    const weakest = identifyWeakest(evalBefore.scores);
    const improvedAd = await editor.improve(ad2, evalBefore, BRIEF);
    const evalAfter = await evaluator.evaluate(improvedAd, BRIEF);

    let maxDrop = 0;
    for (const scoreBefore of evalBefore.scores) {
      if (scoreBefore.dimension === weakest.dimension) continue;
      const scoreAfter = evalAfter.scores.find(
        (s) => s.dimension === scoreBefore.dimension,
      );
      if (!scoreAfter) continue;
      const drop = scoreBefore.score - scoreAfter.score;
      maxDrop = Math.max(maxDrop, drop);
    }

    console.log('Max non-targeted drop:', maxDrop);
    expect(maxDrop).toBeLessThanOrEqual(1);
  }, 120_000);
});
