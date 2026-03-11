import { describe, it, expect } from 'vitest';
import {
  EVALUATOR_SYSTEM_PROMPT,
  buildWriterFewShotSection,
  buildWriterUserPrompt,
  type FewShotExample,
} from '../../src/config/prompts.js';

const strongExample: FewShotExample = {
  tier: 'strong',
  primaryText: 'Your child can score 200+ points higher.',
  headline: '3.8 GPA But 1180 SAT?',
  description: 'Strategy-based SAT improvement',
  ctaButton: 'Learn more',
  tierRationale: 'Longest-running ad with proven messaging.',
};

const mediumExample: FewShotExample = {
  tier: 'medium',
  primaryText: 'Your child isn\'t struggling with the material—they\'re struggling with the test.',
  headline: 'GPA Doesn\'t Match SAT Score?',
  description: 'SAT prep that works.',
  ctaButton: 'Learn more',
  tierRationale: 'Has the core hook but lacks structured format and specific differentiators.',
};

const weakExample: FewShotExample = {
  tier: 'weak',
  primaryText: 'Improve your SAT score with expert tutoring.',
  headline: 'SAT Tutoring Available Now',
  description: 'Tutoring available.',
  ctaButton: 'Learn more',
  tierRationale: 'Generic messaging with no hook, no specificity, could be any brand.',
};

describe('EVALUATOR_SYSTEM_PROMPT', () => {
  it('includes cohesion/logical flow in Clarity criteria', () => {
    expect(EVALUATOR_SYSTEM_PROMPT.toLowerCase()).toMatch(/cohesion|logical flow|sentence.*connect/);
  });

  it('includes scoring guidance for cohesion penalties', () => {
    expect(EVALUATOR_SYSTEM_PROMPT.toLowerCase()).toMatch(/cohesion|logical flow/);
    // Should appear in a guidance/rubric section, not just the dimension definition
    const clarityGuidanceMatch = EVALUATOR_SYSTEM_PROMPT.match(/### Clarity[\s\S]*?(?=###|$)/);
    expect(clarityGuidanceMatch).not.toBeNull();
    expect(clarityGuidanceMatch![0].toLowerCase()).toMatch(/cohesion|logical flow|sentence/);
  });
});

describe('buildWriterFewShotSection', () => {
  it('formats strong, medium, and weak examples with tier labels', () => {
    const section = buildWriterFewShotSection([strongExample, mediumExample, weakExample]);

    expect(section).toContain('## Quality Reference Examples');
    expect(section).toContain('STRONG');
    expect(section).toContain('MEDIUM');
    expect(section).toContain('WEAK');
  });

  it('includes all ad fields for each example', () => {
    const section = buildWriterFewShotSection([strongExample]);

    expect(section).toContain(strongExample.primaryText);
    expect(section).toContain(strongExample.headline);
    expect(section).toContain(strongExample.description);
    expect(section).toContain(strongExample.ctaButton);
    expect(section).toContain(strongExample.tierRationale);
  });

  it('returns empty string when no examples provided', () => {
    expect(buildWriterFewShotSection([])).toBe('');
  });
});

describe('buildWriterUserPrompt with few-shot', () => {
  const brief = {
    id: 'brief-001',
    targetAudience: 'parents' as const,
    campaignGoal: 'conversion' as const,
    emotionalAngle: 'anxiety',
    offer: 'Free SAT Strategy Call',
  };

  it('includes few-shot section when examples provided', () => {
    const prompt = buildWriterUserPrompt(brief, 3, undefined, [strongExample, mediumExample, weakExample]);

    expect(prompt).toContain('Quality Reference Examples');
    expect(prompt).toContain('STRONG');
    expect(prompt).toContain('MEDIUM');
    expect(prompt).toContain('WEAK');
  });

  it('omits few-shot section when no examples provided', () => {
    const prompt = buildWriterUserPrompt(brief, 3);

    expect(prompt).not.toContain('Quality Reference Examples');
  });

  it('places few-shot section before generation instruction', () => {
    const prompt = buildWriterUserPrompt(brief, 3, undefined, [strongExample]);

    const fewShotIndex = prompt.indexOf('Quality Reference Examples');
    const generateIndex = prompt.indexOf('Generate exactly');
    expect(fewShotIndex).toBeLessThan(generateIndex);
  });
});
