import { describe, it, expect } from 'vitest';
import {
  EVALUATOR_SYSTEM_PROMPT,
  WRITER_SYSTEM_PROMPT,
  EDITOR_SYSTEM_PROMPT,
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

  it('penalizes markdown formatting in ad copy', () => {
    const lower = EVALUATOR_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toMatch(/markdown|asterisk|\\\*/);
  });

  it('penalizes "your student" in brand voice guidance', () => {
    expect(EVALUATOR_SYSTEM_PROMPT).toContain('your student');
    // Should be in a penalty context
    const brandSection = EVALUATOR_SYSTEM_PROMPT.match(/### Brand Voice Violations[\s\S]*?(?=###|## |$)/);
    expect(brandSection).not.toBeNull();
    expect(brandSection![0]).toContain('your student');
    expect(brandSection![0]).toContain('penalize brand voice');
  });

  it('penalizes "SAT prep" in brand voice guidance', () => {
    const brandSection = EVALUATOR_SYSTEM_PROMPT.match(/### Brand Voice Violations[\s\S]*?(?=###|## |$)/);
    expect(brandSection).not.toBeNull();
    expect(brandSection![0]).toContain('SAT prep');
  });

  it('penalizes fake urgency in brand voice guidance', () => {
    const brandSection = EVALUATOR_SYSTEM_PROMPT.match(/### Brand Voice Violations[\s\S]*?(?=###|## |$)/);
    expect(brandSection).not.toBeNull();
    expect(brandSection![0]).toContain('spots filling fast');
  });

  it('penalizes corporate language in brand voice guidance', () => {
    const brandSection = EVALUATOR_SYSTEM_PROMPT.match(/### Brand Voice Violations[\s\S]*?(?=###|## |$)/);
    expect(brandSection).not.toBeNull();
    expect(brandSection![0]).toContain('unlock potential');
  });

  it('caps brand voice score at 5 for violations', () => {
    expect(EVALUATOR_SYSTEM_PROMPT).toContain('no higher than 5');
  });

  it('includes VT language rules in brand voice dimension definition', () => {
    expect(EVALUATOR_SYSTEM_PROMPT).toContain('your child');
    expect(EVALUATOR_SYSTEM_PROMPT).toContain('SAT tutoring');
  });
});

describe('WRITER_SYSTEM_PROMPT', () => {
  it('bans markdown formatting in ad copy', () => {
    const lower = WRITER_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toMatch(/no markdown|no asterisks|no \*|no formatting/);
  });

  it('includes word count or conciseness guidance for primary text', () => {
    const lower = WRITER_SYSTEM_PROMPT.toLowerCase();
    expect(lower).toMatch(/concise|word|short|tight|brief/);
    // Should have specific length guidance in the Ad Format section
    expect(WRITER_SYSTEM_PROMPT).toMatch(/\d+\s*[-–]\s*\d+\s*words/i);
  });

  it('bans "your student" phrasing in favor of "your child"', () => {
    expect(WRITER_SYSTEM_PROMPT).toContain('your child');
    expect(WRITER_SYSTEM_PROMPT).toMatch(/not.*your student/i);
  });

  it('bans "SAT prep" in favor of "SAT tutoring"', () => {
    expect(WRITER_SYSTEM_PROMPT).toContain('SAT tutoring');
    expect(WRITER_SYSTEM_PROMPT).toMatch(/not.*SAT prep/i);
  });

  it('bans fake urgency language', () => {
    expect(WRITER_SYSTEM_PROMPT).toContain('spots filling fast');
    expect(WRITER_SYSTEM_PROMPT).toContain('Never use fake scarcity');
  });

  it('bans corporate/marketing language', () => {
    expect(WRITER_SYSTEM_PROMPT).toContain('unlock potential');
    expect(WRITER_SYSTEM_PROMPT).toContain('maximize score potential');
  });

  it('includes approved claims with specific numbers', () => {
    expect(WRITER_SYSTEM_PROMPT).toContain('100 points/month');
    expect(WRITER_SYSTEM_PROMPT).toContain('10x');
    expect(WRITER_SYSTEM_PROMPT).toContain('2.6x');
  });

  it('includes digital SAT differentiator', () => {
    expect(WRITER_SYSTEM_PROMPT).toContain('60%');
    expect(WRITER_SYSTEM_PROMPT).toContain('built-in');
    expect(WRITER_SYSTEM_PROMPT).toContain('digital');
  });

  it('bans "online tutoring" positioning', () => {
    expect(WRITER_SYSTEM_PROMPT).toContain('online tutoring');
    // Should be in a NEVER/ban context
    expect(WRITER_SYSTEM_PROMPT).toMatch(/NEVER.*position.*online tutoring/i);
  });

  it('includes offer details with pricing', () => {
    expect(WRITER_SYSTEM_PROMPT).toContain('$349');
    expect(WRITER_SYSTEM_PROMPT).toContain('$639');
    expect(WRITER_SYSTEM_PROMPT).toContain('monthly');
  });

  it('requires conditioned score claims', () => {
    expect(WRITER_SYSTEM_PROMPT).toMatch(/condition|conditioned/i);
    expect(WRITER_SYSTEM_PROMPT).toContain('16 sessions');
  });
});

describe('EDITOR_SYSTEM_PROMPT', () => {
  it('includes VT language rules', () => {
    expect(EDITOR_SYSTEM_PROMPT).toContain('your child');
    expect(EDITOR_SYSTEM_PROMPT).toContain('SAT tutoring');
    expect(EDITOR_SYSTEM_PROMPT).toContain('spots filling fast');
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

describe('buildWriterUserPrompt with persona context', () => {
  const personaBrief = {
    id: 'test-persona',
    targetAudience: 'parent' as const,
    campaignGoal: 'conversion' as const,
    emotionalAngle: 'urgency',
    offer: 'Varsity Tutors SAT tutoring',
    persona: 'Athlete-Recruit Gatekeeper',
    personaPsychology: 'Fear of missed recruiting window',
    sampleHooks: ['The coach wants him.', 'SAT score blocks scholarship.'],
    suggestedCta: 'Talk to a specialist today.',
  };

  const plainBrief = {
    id: 'test-plain',
    targetAudience: 'parent' as const,
    campaignGoal: 'conversion' as const,
    emotionalAngle: 'anxiety',
    offer: 'Varsity Tutors SAT tutoring',
  };

  it('includes persona context when provided', () => {
    const prompt = buildWriterUserPrompt(personaBrief, 3);
    expect(prompt).toContain('Athlete-Recruit Gatekeeper');
    expect(prompt).toContain('Fear of missed recruiting window');
    expect(prompt).toContain('Talk to a specialist today.');
  });

  it('includes sample hooks when provided', () => {
    const prompt = buildWriterUserPrompt(personaBrief, 3);
    expect(prompt).toContain('Persona-Specific Hook Examples');
    expect(prompt).toContain('The coach wants him.');
    expect(prompt).toContain('SAT score blocks scholarship.');
  });

  it('omits persona section when no persona fields in brief', () => {
    const prompt = buildWriterUserPrompt(plainBrief, 3);
    expect(prompt).not.toContain('Persona');
    expect(prompt).not.toContain('Persona-Specific Hook Examples');
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
