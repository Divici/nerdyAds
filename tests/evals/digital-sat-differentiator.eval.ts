/**
 * Digital SAT Differentiator Eval — verifies writer incorporates digital SAT messaging.
 * Tests: digital SAT mentioned naturally, "online tutoring" positioning avoided.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { WriterAgent } from '../../src/agents/writer.js';
import type { Brief } from '../../src/types/brief.js';

const BRIEF: Brief = {
  id: 'digital-sat-eval',
  targetAudience: 'parent',
  campaignGoal: 'awareness',
  emotionalAngle: 'aspiration',
  offer: 'Expert 1-on-1 SAT tutoring for the digital SAT era',
  persona: 'System Optimizer',
  personaPsychology: 'Treats SAT as an optimization problem — wants data-driven, efficient approach',
  sampleHooks: [
    'The SAT went digital. Most prep didn\'t.',
    '60% of digital SAT math is solvable with built-in tools most students ignore.',
    'What if 16 sessions could change everything?',
  ],
  suggestedCta: 'See the difference',
};

describe('Digital SAT Differentiator Eval', () => {
  const writer = new WriterAgent();

  it('at least one ad references digital SAT or digital-era advantages', async () => {
    const ads = await writer.generateBatch(BRIEF, 3);

    let foundDigital = false;
    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`.toLowerCase();
      if (
        combined.includes('digital') ||
        combined.includes('built-in') ||
        combined.includes('calculator') ||
        combined.includes('desmos') ||
        combined.includes('interface')
      ) {
        foundDigital = true;
        console.log(`Digital SAT reference found in ad ${ad.id}: ${combined.slice(0, 80)}`);
      }
    }

    expect(foundDigital).toBe(true);
  }, 120_000);

  it('does not position as "online tutoring" — reframes as digital SAT expertise', async () => {
    const ads = await writer.generateBatch(BRIEF, 3);

    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`.toLowerCase();

      // Should not position as generic "online tutoring"
      const hasOnlineTutoring = combined.includes('online tutoring') || combined.includes('virtual tutoring');
      if (hasOnlineTutoring) {
        console.log(`Ad ${ad.id} positioned as online tutoring: ${combined.slice(0, 80)}`);
      }

      expect(hasOnlineTutoring, `Ad ${ad.id} uses "online tutoring" positioning`).toBe(false);
    }
  }, 120_000);
});
