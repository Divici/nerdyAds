/**
 * Persona Alignment Eval — verifies writer adapts output to persona context.
 * Tests: persona-specific language appears, cross-persona discrimination.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { WriterAgent } from '../../src/agents/writer.js';
import type { Brief } from '../../src/types/brief.js';

const ATHLETE_BRIEF: Brief = {
  id: 'persona-athlete',
  targetAudience: 'parent',
  campaignGoal: 'conversion',
  emotionalAngle: 'urgency',
  offer: 'Expert 1-on-1 SAT tutoring',
  persona: 'Athlete-Recruit Gatekeeper',
  personaPsychology: 'Fear of missed recruiting window — coach wants the kid but SAT blocks scholarship',
  sampleHooks: [
    'The coach wants him. The SAT score doesn\'t.',
    'D1 coach called. Then asked for his SAT score.',
    'Scholarship offer. One condition: SAT score.',
  ],
  suggestedCta: 'Talk to a specialist today',
};

const NEURODIVERGENT_BRIEF: Brief = {
  id: 'persona-neuro',
  targetAudience: 'parent',
  campaignGoal: 'conversion',
  emotionalAngle: 'frustration',
  offer: 'Expert 1-on-1 SAT tutoring',
  persona: 'Neurodivergent Advocate',
  personaPsychology: 'Child is brilliant but traditional test methods fail them — needs accommodation-aware approach',
  sampleHooks: [
    'Your child is brilliant. The SAT just can\'t tell yet.',
    'Same material. Different brain. Different strategy needed.',
    'Standard test prep failed them. This won\'t.',
  ],
  suggestedCta: 'See how we adapt',
};

const OPTIMIZER_BRIEF: Brief = {
  id: 'persona-optimizer',
  targetAudience: 'parent',
  campaignGoal: 'conversion',
  emotionalAngle: 'aspiration',
  offer: 'Expert 1-on-1 SAT tutoring',
  persona: 'System Optimizer',
  personaPsychology: 'Treats SAT as an optimization problem — wants data-driven, efficient approach',
  sampleHooks: [
    '3.8 GPA. 1180 SAT. The system is broken.',
    'Their GPA proves they can learn. Their SAT score proves they need strategy.',
    'What if 16 sessions could change everything?',
  ],
  suggestedCta: 'See the data',
};

// Keywords expected for each persona
const ATHLETE_KEYWORDS = ['recruit', 'coach', 'scholarship', 'athlete', 'D1', 'sport', 'team', 'commit'];
const NEURO_KEYWORDS = ['brilliant', 'different', 'adapt', 'unique', 'brain', 'approach', 'strategy', 'accommodate', 'learn differently'];
const OPTIMIZER_KEYWORDS = ['GPA', 'data', 'strategy', 'system', 'efficient', 'optimize', 'gap', 'diagnostic', 'sessions'];

function countKeywordHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw.toLowerCase())).length;
}

describe('Persona Alignment Eval — writer adapts to persona', () => {
  const writer = new WriterAgent();

  it('athlete persona ads contain recruiting/sports language', async () => {
    const ads = await writer.generateBatch(ATHLETE_BRIEF, 3);

    let totalHits = 0;
    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`;
      const hits = countKeywordHits(combined, ATHLETE_KEYWORDS);
      totalHits += hits;
      console.log(`Athlete ad ${ad.id}: ${hits} keyword hits — ${combined.slice(0, 80)}`);
    }

    // At least 3 keyword hits across 3 ads
    expect(totalHits).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('neurodivergent persona ads contain adapted-approach language', async () => {
    const ads = await writer.generateBatch(NEURODIVERGENT_BRIEF, 3);

    let totalHits = 0;
    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`;
      const hits = countKeywordHits(combined, NEURO_KEYWORDS);
      totalHits += hits;
      console.log(`Neuro ad ${ad.id}: ${hits} keyword hits — ${combined.slice(0, 80)}`);
    }

    expect(totalHits).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('optimizer persona ads contain data/strategy language', async () => {
    const ads = await writer.generateBatch(OPTIMIZER_BRIEF, 3);

    let totalHits = 0;
    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`;
      const hits = countKeywordHits(combined, OPTIMIZER_KEYWORDS);
      totalHits += hits;
      console.log(`Optimizer ad ${ad.id}: ${hits} keyword hits — ${combined.slice(0, 80)}`);
    }

    expect(totalHits).toBeGreaterThanOrEqual(3);
  }, 120_000);

  it('cross-persona discrimination: athlete ads score higher on athlete keywords than optimizer keywords', async () => {
    const athleteAds = await writer.generateBatch(ATHLETE_BRIEF, 3);

    let athleteHits = 0;
    let optimizerHits = 0;

    for (const ad of athleteAds) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`;
      athleteHits += countKeywordHits(combined, ATHLETE_KEYWORDS);
      optimizerHits += countKeywordHits(combined, OPTIMIZER_KEYWORDS);
    }

    console.log(`Athlete brief → athlete keywords: ${athleteHits}, optimizer keywords: ${optimizerHits}`);
    expect(athleteHits).toBeGreaterThan(optimizerHits);
  }, 120_000);

  it('persona-specific hooks influence output language', async () => {
    const ads = await writer.generateBatch(ATHLETE_BRIEF, 3);

    // At least one ad should reference recruiting/scholarship themes from the hooks
    let foundTheme = false;
    for (const ad of ads) {
      const lower = `${ad.primaryText} ${ad.headline}`.toLowerCase();
      if (lower.includes('coach') || lower.includes('recruit') || lower.includes('scholarship') || lower.includes('d1')) {
        foundTheme = true;
        break;
      }
    }

    console.log('Found recruiting/scholarship theme in athlete ads:', foundTheme);
    expect(foundTheme).toBe(true);
  }, 120_000);
});
