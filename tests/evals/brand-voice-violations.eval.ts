/**
 * Brand Voice Violations Eval — verifies evaluator detects and penalizes VT language violations.
 * Tests: "your student", "SAT prep", fake urgency, corporate speak, and clean baseline.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { EvaluatorAgent } from '../../src/agents/evaluator.js';
import type { Ad } from '../../src/types/ad.js';

function makeAd(id: string, overrides: Partial<Ad>): Ad {
  return {
    id,
    briefId: 'brand-voice-eval',
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

// Clean ad — no violations, should score well on brand_voice
const CLEAN_AD = makeAd('bv-clean', {
  primaryText:
    "Your child's GPA says they're capable. Their SAT score should too. Our 1-on-1 SAT tutoring identifies strategy gaps and closes them — average improvement of 200+ points.",
  headline: 'Smart Kids Deserve Smart Strategy',
  description: 'Expert SAT tutoring built for your child',
  ctaButton: 'See How It Works',
});

// "your student" violation
const YOUR_STUDENT_AD = makeAd('bv-your-student', {
  primaryText:
    "Is your student struggling with the SAT? Our expert tutors help your student build confidence and improve scores through personalized 1-on-1 sessions.",
  headline: 'Help Your Student Succeed',
  description: 'SAT tutoring for your student',
  ctaButton: 'Get Started',
});

// "SAT prep" violation
const SAT_PREP_AD = makeAd('bv-sat-prep', {
  primaryText:
    "Looking for the best SAT prep? Our SAT prep program has helped thousands of students raise their scores. Expert SAT prep tutors available now.",
  headline: 'Top-Rated SAT Prep',
  description: 'The SAT prep your child needs',
  ctaButton: 'Start SAT Prep',
});

// Fake urgency violation
const FAKE_URGENCY_AD = makeAd('bv-fake-urgency', {
  primaryText:
    "Spots are filling fast! Only 3 slots left this month. Don't miss out on our exclusive SAT tutoring program. Limited availability — act now before it's too late!",
  headline: 'Spots Filling Fast — Act Now!',
  description: 'Limited spots available for SAT tutoring',
  ctaButton: 'Claim Your Spot',
});

// Corporate/marketing speak violation
const CORPORATE_AD = makeAd('bv-corporate', {
  primaryText:
    "Unlock your child's full potential with our holistic approach to SAT tutoring. We leverage cutting-edge methodologies to maximize score potential and empower students to supercharge their academic journey.",
  headline: 'Unlock Potential. Maximize Scores.',
  description: 'A game-changer in SAT tutoring',
  ctaButton: 'Transform Today',
});

describe('Brand Voice Violations Eval — evaluator detects violations', () => {
  const evaluator = new EvaluatorAgent();

  it('clean ad scores brand_voice ≥ 7', async () => {
    const evaluation = await evaluator.evaluate(CLEAN_AD);
    const brandVoice = evaluation.scores.find((s) => s.dimension === 'brand_voice');

    console.log('Clean ad brand_voice:', brandVoice?.score, brandVoice?.rationale?.slice(0, 80));

    expect(brandVoice).toBeDefined();
    expect(brandVoice!.score).toBeGreaterThanOrEqual(7);
  }, 60_000);

  it('penalizes "your student" — brand_voice ≤ 5', async () => {
    const evaluation = await evaluator.evaluate(YOUR_STUDENT_AD);
    const brandVoice = evaluation.scores.find((s) => s.dimension === 'brand_voice');

    console.log('"your student" ad brand_voice:', brandVoice?.score, brandVoice?.rationale?.slice(0, 80));

    expect(brandVoice).toBeDefined();
    expect(brandVoice!.score).toBeLessThanOrEqual(5);
  }, 60_000);

  it('penalizes "SAT prep" — brand_voice ≤ 5', async () => {
    const evaluation = await evaluator.evaluate(SAT_PREP_AD);
    const brandVoice = evaluation.scores.find((s) => s.dimension === 'brand_voice');

    console.log('"SAT prep" ad brand_voice:', brandVoice?.score, brandVoice?.rationale?.slice(0, 80));

    expect(brandVoice).toBeDefined();
    expect(brandVoice!.score).toBeLessThanOrEqual(5);
  }, 60_000);

  it('penalizes fake urgency — brand_voice ≤ 5', async () => {
    const evaluation = await evaluator.evaluate(FAKE_URGENCY_AD);
    const brandVoice = evaluation.scores.find((s) => s.dimension === 'brand_voice');

    console.log('Fake urgency ad brand_voice:', brandVoice?.score, brandVoice?.rationale?.slice(0, 80));

    expect(brandVoice).toBeDefined();
    expect(brandVoice!.score).toBeLessThanOrEqual(5);
  }, 60_000);

  it('penalizes corporate speak — brand_voice ≤ 5', async () => {
    const evaluation = await evaluator.evaluate(CORPORATE_AD);
    const brandVoice = evaluation.scores.find((s) => s.dimension === 'brand_voice');

    console.log('Corporate ad brand_voice:', brandVoice?.score, brandVoice?.rationale?.slice(0, 80));

    expect(brandVoice).toBeDefined();
    expect(brandVoice!.score).toBeLessThanOrEqual(5);
  }, 60_000);
});
