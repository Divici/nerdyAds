import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VisualEvaluatorAgent } from '../../src/agents/visual-evaluator.js';
import type { Ad } from '../../src/types/ad.js';
import type { Brief } from '../../src/types/brief.js';
import type { ImageVariant } from '../../src/types/image.js';

const mockEvalResponse = {
  scores: [
    { dimension: 'brand_consistency', score: 8, rationale: 'Strong navy palette', confidence: 7 },
    { dimension: 'copy_alignment', score: 7, rationale: 'Image matches anxiety theme', confidence: 6 },
    { dimension: 'engagement_potential', score: 9, rationale: 'Strong focal point', confidence: 8 },
  ],
};

vi.mock('../../src/utils/gemini-client.js', () => ({
  callGemini: vi.fn().mockResolvedValue({
    text: JSON.stringify({
      scores: [
        { dimension: 'brand_consistency', score: 8, rationale: 'Strong navy palette', confidence: 7 },
        { dimension: 'copy_alignment', score: 7, rationale: 'Image matches anxiety theme', confidence: 6 },
        { dimension: 'engagement_potential', score: 9, rationale: 'Strong focal point', confidence: 8 },
      ],
    }),
    tokensIn: 300,
    tokensOut: 150,
    costUsd: 0.005,
    model: 'gemini-2.5-flash',
    seed: 42,
    promptHash: 'eval-hash',
    generatedAt: '2026-03-13T00:00:00Z',
  }),
  resetClient: vi.fn(),
}));

import { callGemini } from '../../src/utils/gemini-client.js';

const makeMetadata = () => ({
  model: 'gemini-2.5-flash',
  seed: 42,
  promptHash: 'abc',
  tokensIn: 200,
  tokensOut: 1290,
  costUsd: 0.04,
  generatedAt: '2026-03-13T00:00:00Z',
});

const mockVariant: ImageVariant = {
  variantIndex: 0,
  imagePath: '/run-123/images/ad-001-variant-0.png',
  blurb: 'A student studying at a desk with warm lighting and navy blue accents',
  metadata: makeMetadata(),
};

const mockAd: Ad = {
  id: 'ad-001',
  briefId: 'brief-001',
  primaryText: 'Your child is smarter than their SAT score.',
  headline: 'SAT Prep That Works',
  description: 'Expert 1-on-1 tutoring',
  ctaButton: 'Learn More',
  version: 0,
  metadata: makeMetadata(),
};

const mockBrief: Brief = {
  id: 'brief-001',
  targetAudience: 'parent',
  campaignGoal: 'conversion',
  emotionalAngle: 'anxiety',
  offer: 'Varsity Tutors SAT test prep',
};

describe('VisualEvaluatorAgent', () => {
  const agent = new VisualEvaluatorAgent();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 3 visual dimension scores', async () => {
    const scores = await agent.evaluate(mockVariant, mockAd, mockBrief);

    expect(scores).toHaveLength(3);
    expect(scores.map((s) => s.dimension)).toEqual([
      'brand_consistency',
      'copy_alignment',
      'engagement_potential',
    ]);
  });

  it('scores are in the 1-10 range', async () => {
    const scores = await agent.evaluate(mockVariant, mockAd, mockBrief);

    for (const score of scores) {
      expect(score.score).toBeGreaterThanOrEqual(1);
      expect(score.score).toBeLessThanOrEqual(10);
    }
  });

  it('each score has a rationale and confidence', async () => {
    const scores = await agent.evaluate(mockVariant, mockAd, mockBrief);

    for (const score of scores) {
      expect(score.rationale).toBeTruthy();
      expect(score.confidence).toBeGreaterThanOrEqual(1);
      expect(score.confidence).toBeLessThanOrEqual(10);
    }
  });

  it('calls callGemini with flash role and jsonMode', async () => {
    await agent.evaluate(mockVariant, mockAd, mockBrief);

    expect(callGemini).toHaveBeenCalledWith(
      'flash',
      expect.stringContaining('visual ad evaluator'),
      expect.stringContaining('A student studying'),
      expect.objectContaining({ jsonMode: true }),
    );
  });

  it('includes ad copy and brief context in the prompt', async () => {
    await agent.evaluate(mockVariant, mockAd, mockBrief);

    const userPrompt = vi.mocked(callGemini).mock.calls[0][2];
    expect(userPrompt).toContain('Your child is smarter');
    expect(userPrompt).toContain('parent');
    expect(userPrompt).toContain('anxiety');
  });

  it('throws on invalid JSON response', async () => {
    vi.mocked(callGemini).mockResolvedValueOnce({
      text: '{"scores": []}',
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.001,
      model: 'gemini-2.5-flash',
      seed: 42,
      promptHash: 'x',
      generatedAt: '2026-03-13T00:00:00Z',
    });

    await expect(agent.evaluate(mockVariant, mockAd, mockBrief)).rejects.toThrow();
  });
});
