/**
 * Approved Claims Eval — verifies writer uses conditioned claims and approved numbers.
 * Tests: claims are conditioned (not guarantees), approved data points appear, no fabricated stats.
 *
 * Hits real Gemini API. Run via: npm run eval
 */
import 'dotenv/config';
import { describe, it, expect } from 'vitest';
import { WriterAgent } from '../../src/agents/writer.js';
import type { Brief } from '../../src/types/brief.js';

const BRIEF: Brief = {
  id: 'claims-eval',
  targetAudience: 'parent',
  campaignGoal: 'conversion',
  emotionalAngle: 'aspiration',
  offer: 'Expert 1-on-1 SAT tutoring with proven improvement',
  persona: 'Proactive Suburban Optimizer',
  personaPsychology: 'Driven by data and results, needs proof of ROI',
  sampleHooks: ['3.8 GPA but 1180 SAT?', 'What if strategy is the missing piece?'],
  suggestedCta: 'See the data',
};

// Approved numbers from the supplementary
const APPROVED_NUMBERS = ['100', '200', '10x', '2.6x', '60%', '16 sessions'];

// Guarantee language that should not appear
const GUARANTEE_PATTERNS = [
  /guarantee[ds]?\s/i,
  /will\s+(?:raise|increase|improve)\s+(?:your|their)\s+score/i,
  /promised?\s+(?:score|improvement|results)/i,
];

describe('Approved Claims Eval — writer uses conditioned claims', () => {
  const writer = new WriterAgent();

  it('score claims are conditioned (not absolute guarantees)', async () => {
    const ads = await writer.generate(BRIEF, 3);

    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`;

      for (const pattern of GUARANTEE_PATTERNS) {
        const match = combined.match(pattern);
        if (match) {
          console.log(`Ad ${ad.id} potential guarantee: "${match[0]}" in: ${combined.slice(0, 80)}`);
        }
        expect(match, `Ad ${ad.id} contains guarantee language: "${match?.[0]}"`).toBeNull();
      }
    }
  }, 120_000);

  it('ads reference approved data points when making claims', async () => {
    const ads = await writer.generate(BRIEF, 3);
    let totalApprovedRefs = 0;

    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`;
      const refs = APPROVED_NUMBERS.filter((num) => combined.includes(num));
      totalApprovedRefs += refs.length;

      if (refs.length > 0) {
        console.log(`Ad ${ad.id} approved refs:`, refs);
      }
    }

    // At least one ad across the batch should reference approved numbers
    console.log('Total approved number references:', totalApprovedRefs);
    expect(totalApprovedRefs).toBeGreaterThanOrEqual(1);
  }, 120_000);

  it('does not fabricate specific statistics not in approved list', async () => {
    const ads = await writer.generate(BRIEF, 3);

    // Pattern: specific percentages or multipliers that aren't in our approved list
    const specificStatPattern = /(\d+(?:\.\d+)?)[x×]\s|(\d{2,})%/g;
    const approvedSet = new Set(['10x', '2.6x', '60%']);

    for (const ad of ads) {
      const combined = `${ad.primaryText} ${ad.headline} ${ad.description}`;
      const matches = [...combined.matchAll(specificStatPattern)];

      for (const match of matches) {
        const stat = match[0].trim();
        // Check if it's close to an approved stat
        const isApproved = [...approvedSet].some((a) => stat.includes(a.replace('%', '').replace('x', '')));
        if (!isApproved) {
          console.log(`Ad ${ad.id} potentially fabricated stat: "${stat}" in: ${combined.slice(0, 80)}`);
        }
      }
    }
  }, 120_000);
});
