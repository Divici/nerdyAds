/**
 * Dimension Independence Eval — verifies evaluator can identify specific weak dimensions.
 * Uses ads designed to be weak in one specific dimension while strong in others.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { EvaluatorAgent } from '../../src/agents/evaluator.js';
import { identifyWeakest } from '../../src/evaluate/scoring.js';
import type { Ad } from '../../src/types/ad.js';
import type { DimensionName } from '../../src/types/evaluation.js';

function makeAd(id: string, overrides: Partial<Ad>): Ad {
  return {
    id,
    briefId: 'eval-independence',
    primaryText: '',
    headline: '',
    description: '',
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
    ...overrides,
  };
}

// Ad with deliberately weak CTA — strong copy but vague action
const WEAK_CTA_AD = makeAd('weak-cta', {
  primaryText:
    "Your child's SAT score doesn't reflect their true ability. The digital SAT tests strategy, not just knowledge. Our diagnostic identifies exact timing gaps and knowledge blind spots. With 1-on-1 coaching, students gain 200+ points in 8 weeks. We've helped 12,000+ families see real improvement.",
  headline: 'Smart Students Deserve Smart Strategy',
  description: 'Expert SAT coaching for the digital test era',
  ctaButton: 'Learn More',
});

// Ad with deliberately weak clarity — muddled, multiple competing messages
const WEAK_CLARITY_AD = makeAd('weak-clarity', {
  primaryText:
    "SAT scores matter but also GPA and extracurriculars plus college essays are important too and don't forget about AP classes which we also tutor for along with ACT prep and summer programs and academic coaching for middle schoolers who might want to start early because early preparation is key to success in all areas of academic life including but not limited to standardized testing.",
  headline: 'Everything Academic Under One Roof Plus More',
  description: 'SAT, ACT, AP, essays, coaching, tutoring, and more for all students everywhere',
  ctaButton: 'Sign Up',
});

// Ad with weak emotional resonance — purely factual, no emotion
// Uses compliant language so brand_voice isn't also penalized (masking the intended weakness)
const WEAK_EMOTIONAL_AD = makeAd('weak-emotional', {
  primaryText:
    'Varsity Tutors provides SAT tutoring. Our tutors hold advanced degrees. The program includes diagnostic assessments, practice tests, and strategy instruction. Sessions are 60 minutes. Scheduling is flexible.',
  headline: 'SAT Tutoring Sessions Available',
  description: '1-on-1 SAT tutoring with qualified instructors',
  ctaButton: 'Book Now',
});

describe('Dimension Independence Eval — catches specific weak dimensions', () => {
  const evaluator = new EvaluatorAgent();

  it('identifies CTA as weakest dimension in weak-CTA ad', async () => {
    const evaluation = await evaluator.evaluate(WEAK_CTA_AD);
    const weakest = identifyWeakest(evaluation.scores);

    console.log(
      'Weak-CTA scores:',
      evaluation.scores.map((s) => `${s.dimension}=${s.score}`),
    );
    console.log('Weakest:', weakest.dimension, weakest.score);

    // CTA should be among the bottom 2 dimensions
    const sorted = [...evaluation.scores].sort((a, b) => a.score - b.score);
    const bottomTwo = sorted.slice(0, 2).map((s) => s.dimension);
    expect(bottomTwo).toContain('cta' as DimensionName);
  }, 60_000);

  it('identifies clarity as weakest dimension in weak-clarity ad', async () => {
    const evaluation = await evaluator.evaluate(WEAK_CLARITY_AD);
    const weakest = identifyWeakest(evaluation.scores);

    console.log(
      'Weak-clarity scores:',
      evaluation.scores.map((s) => `${s.dimension}=${s.score}`),
    );
    console.log('Weakest:', weakest.dimension, weakest.score);

    // Clarity should be the weakest or among bottom 2
    const sorted = [...evaluation.scores].sort((a, b) => a.score - b.score);
    const bottomTwo = sorted.slice(0, 2).map((s) => s.dimension);
    expect(bottomTwo).toContain('clarity' as DimensionName);
  }, 60_000);

  it('identifies emotional_resonance as weakest in dry factual ad', async () => {
    const evaluation = await evaluator.evaluate(WEAK_EMOTIONAL_AD);
    const weakest = identifyWeakest(evaluation.scores);

    console.log(
      'Weak-emotional scores:',
      evaluation.scores.map((s) => `${s.dimension}=${s.score}`),
    );
    console.log('Weakest:', weakest.dimension, weakest.score);

    // Emotional resonance should be among bottom 2
    const sorted = [...evaluation.scores].sort((a, b) => a.score - b.score);
    const bottomTwo = sorted.slice(0, 2).map((s) => s.dimension);
    expect(bottomTwo).toContain('emotional_resonance' as DimensionName);
  }, 60_000);
});
