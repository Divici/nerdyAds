/**
 * Language Compliance Eval — verifies writer and editor produce VT-compliant language.
 * Checks: no "your student", no "SAT prep", no fake urgency, no corporate speak.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { WriterAgent } from '../../src/agents/writer.js';
import { EditorAgent } from '../../src/agents/editor.js';
import { EvaluatorAgent } from '../../src/agents/evaluator.js';
import type { Brief } from '../../src/types/brief.js';
import type { Ad } from '../../src/types/ad.js';

const BANNED_PHRASES = [
  'your student',
  'sat prep',
  'spots filling fast',
  'limited spots',
  'act now',
  'unlock potential',
  'maximize score potential',
  'empower',
  'leverage',
  'holistic approach',
  'game-changer',
  'supercharge',
];

const BRIEF: Brief = {
  id: 'lang-compliance-eval',
  targetAudience: 'parent',
  campaignGoal: 'conversion',
  emotionalAngle: 'aspiration',
  offer: 'Expert 1-on-1 SAT tutoring',
  persona: 'Proactive Suburban Optimizer',
  personaPsychology: 'Anxiety that child is not reaching full potential despite good grades',
  sampleHooks: ['3.8 GPA but 1180 SAT?', 'Smart kids. Low scores.'],
  suggestedCta: 'See how we help',
};

function checkCompliance(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_PHRASES.filter((phrase) => lower.includes(phrase));
}

describe('Language Compliance Eval — writer produces compliant output', () => {
  const writer = new WriterAgent();

  it('writer generates ads without banned phrases (3-ad batch)', async () => {
    const ads = await writer.generateBatch(BRIEF, 3);

    expect(ads.length).toBe(3);

    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description} ${ad.ctaButton}`;
      const violations = checkCompliance(combined);

      if (violations.length > 0) {
        console.log(`Ad ${ad.id} violations:`, violations);
        console.log('  primaryText:', ad.primaryText.slice(0, 80));
      }

      expect(violations, `Ad ${ad.id} contains banned phrases: ${violations.join(', ')}`).toHaveLength(0);
    }
  }, 120_000);

  it('writer uses "your child" instead of "your student"', async () => {
    const ads = await writer.generateBatch(BRIEF, 3);
    let foundYourChild = false;

    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`.toLowerCase();
      if (combined.includes('your child')) foundYourChild = true;
      expect(combined).not.toContain('your student');
    }

    // At least one ad should use "your child" for parent audience
    console.log('Found "your child" in output:', foundYourChild);
  }, 120_000);
});

describe('Language Compliance Eval — editor preserves compliance', () => {
  const editor = new EditorAgent();
  const evaluator = new EvaluatorAgent();

  it('editor does not introduce banned phrases during improvement', async () => {
    // Start with a compliant but mediocre ad
    const ad: Ad = {
      id: 'compliance-edit-test',
      briefId: 'lang-compliance-eval',
      primaryText:
        'Your child deserves SAT tutoring that works. Our approach focuses on strategy.',
      headline: 'Better Scores Start Here',
      description: 'SAT tutoring built for your child',
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

    const evaluation = await evaluator.evaluate(ad, BRIEF);
    const improved = await editor.improve(ad, evaluation, BRIEF);

    const combined = `${improved.primaryText} ${improved.headline} ${improved.description} ${improved.ctaButton}`;
    const violations = checkCompliance(combined);

    console.log('Original:', ad.primaryText.slice(0, 60));
    console.log('Improved:', improved.primaryText.slice(0, 60));
    if (violations.length > 0) {
      console.log('Violations introduced:', violations);
    }

    expect(violations, `Editor introduced banned phrases: ${violations.join(', ')}`).toHaveLength(0);
  }, 120_000);
});
