import { describe, it, expect } from 'vitest';
import {
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

const weakExample: FewShotExample = {
  tier: 'weak',
  primaryText: 'We help with SAT prep.',
  headline: 'SAT Tutoring',
  description: 'Tutoring available.',
  ctaButton: 'Learn more',
  tierRationale: 'Generic messaging with no hook or specificity.',
};

describe('buildWriterFewShotSection', () => {
  it('formats strong and weak examples with tier labels', () => {
    const section = buildWriterFewShotSection([strongExample, weakExample]);

    expect(section).toContain('## Quality Reference Examples');
    expect(section).toContain('STRONG');
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
    const prompt = buildWriterUserPrompt(brief, 3, undefined, [strongExample, weakExample]);

    expect(prompt).toContain('Quality Reference Examples');
    expect(prompt).toContain('STRONG');
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
