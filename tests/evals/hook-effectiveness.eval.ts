/**
 * Hook Effectiveness Eval — verifies writer creates strong opening hooks.
 * Tests: first line follows proven hook patterns, persona-specific hooks used.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { WriterAgent } from '../../src/agents/writer.js';
import type { Brief } from '../../src/types/brief.js';

const BRIEF: Brief = {
  id: 'hook-eval',
  targetAudience: 'parent',
  campaignGoal: 'conversion',
  emotionalAngle: 'aspiration',
  offer: 'Expert 1-on-1 SAT tutoring',
  persona: 'Proactive Suburban Optimizer',
  personaPsychology: 'Data-driven parent who sees GPA-SAT disconnect as a system problem',
  sampleHooks: [
    '3.8 GPA but 1180 SAT?',
    'Their GPA proves they can learn. Their SAT score proves they need strategy.',
    'What if 16 sessions could change everything?',
  ],
  suggestedCta: 'See the data',
};

// Hook pattern categories from the supplementary
const HOOK_PATTERNS = {
  question: /\?/,                                    // Questions
  statistic: /\d+[\.\d]*[%x×]|\d{3,}/,             // Numbers/stats
  contrast: /but|yet|however|though|instead/i,       // Contrast/tension
  direct_address: /your\s/i,                         // Direct "your" address
  emotional: /struggle|fear|worry|dream|hope|brilliant|smart/i,  // Emotional words
};

describe('Hook Effectiveness Eval — first lines follow patterns', () => {
  const writer = new WriterAgent();

  it('first line of primary text uses a recognized hook pattern', async () => {
    const ads = await writer.generate(BRIEF, 3);
    let patternsMatched = 0;

    for (const ad of ads) {
      // Extract first line/sentence
      const firstLine = ad.primaryText.split(/[.\n!]/)[0].trim();
      const matchedPatterns: string[] = [];

      for (const [name, pattern] of Object.entries(HOOK_PATTERNS)) {
        if (pattern.test(firstLine)) {
          matchedPatterns.push(name);
        }
      }

      console.log(`Ad ${ad.id} first line: "${firstLine}" — patterns: [${matchedPatterns.join(', ')}]`);

      if (matchedPatterns.length > 0) patternsMatched++;
    }

    // At least 2 out of 3 ads should open with a recognized hook pattern
    expect(patternsMatched).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it('ads with persona hooks produce thematically aligned openings', async () => {
    const athleteBrief: Brief = {
      id: 'hook-athlete-eval',
      targetAudience: 'parent',
      campaignGoal: 'conversion',
      emotionalAngle: 'urgency',
      offer: 'Expert 1-on-1 SAT tutoring',
      persona: 'Athlete-Recruit Gatekeeper',
      personaPsychology: 'Coach wants the kid but SAT blocks scholarship',
      sampleHooks: [
        'The coach wants him. The SAT score doesn\'t.',
        'D1 coach called. Then asked for his SAT score.',
        'Scholarship offer. One condition: SAT score.',
      ],
      suggestedCta: 'Talk to a specialist',
    };

    const ads = await writer.generate(athleteBrief, 3);

    // Check that at least one ad's opening reflects the athletic/recruiting theme
    let themeFound = false;
    const athleteTerms = ['coach', 'recruit', 'scholarship', 'athlete', 'sport', 'd1', 'commit', 'team', 'play'];

    for (const ad of ads) {
      const firstLine = ad.primaryText.split(/[.\n!]/)[0].trim().toLowerCase();
      const matches = athleteTerms.filter((t) => firstLine.includes(t));
      if (matches.length > 0) {
        themeFound = true;
        console.log(`Athlete-themed hook found: "${firstLine}" — matches: [${matches.join(', ')}]`);
      }
    }

    console.log('Athlete theme in hook:', themeFound);
    expect(themeFound).toBe(true);
  }, 120_000);
});
