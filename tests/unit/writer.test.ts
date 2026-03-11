import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WriterAgent } from '../../src/agents/writer.js';
import type { Brief } from '../../src/types/brief.js';
import type { Ad } from '../../src/types/ad.js';
import type { CompetitorPattern } from '../../src/types/patterns.js';
import type { FewShotExample } from '../../src/config/prompts.js';

// Mock the gemini client
vi.mock('../../src/utils/gemini-client.js', () => ({
  callGemini: vi.fn(),
}));

import { callGemini } from '../../src/utils/gemini-client.js';
const mockCallGemini = vi.mocked(callGemini);

const MOCK_BRIEF: Brief = {
  id: 'brief-001',
  targetAudience: 'student',
  campaignGoal: 'conversion',
  emotionalAngle: 'aspiration',
  offer: 'Expert SAT tutors help you reach your target score',
};

const MOCK_PATTERN: CompetitorPattern = {
  hookTypes: ['question', 'stat'],
  emotionalAngles: ['aspiration', 'anxiety'],
  ctaStyles: ['Get offer', 'Learn More'],
  commonPhrases: ['top tutors', 'score improvement'],
  structuralPatterns: ['Hook → benefit → CTA'],
  source: 'competitor_analysis',
};

function makeMockAdResponse(ads: Array<{
  primaryText: string;
  headline: string;
  description: string;
  ctaButton: string;
}>) {
  return {
    text: JSON.stringify({ ads }),
    tokensIn: 600,
    tokensOut: 500,
    costUsd: 0.001,
    model: 'gemini-2.0-flash',
    seed: 42,
    promptHash: 'writer-hash-123',
    generatedAt: '2025-01-01T00:00:00.000Z',
  };
}

const MOCK_ADS_RAW = [
  {
    primaryText: 'Your dream SAT score is closer than you think. Our expert tutors create a personalized plan to help you succeed.',
    headline: 'SAT Prep That Gets Results',
    description: 'Join thousands of students who boosted their scores.',
    ctaButton: 'Start Now',
  },
  {
    primaryText: 'Stop stressing about the SAT. Get matched with a tutor who knows exactly how to raise your score.',
    headline: 'Expert SAT Help, Real Results',
    description: 'Personalized prep plans built for your goals.',
    ctaButton: 'Get Started',
  },
];

describe('WriterAgent', () => {
  let writer: WriterAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    writer = new WriterAgent();
  });

  it('generates a single ad from a brief', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    const ad = await writer.generateAd(MOCK_BRIEF);

    expect(ad.briefId).toBe('brief-001');
    expect(ad.primaryText).toBe(MOCK_ADS_RAW[0].primaryText);
    expect(ad.headline).toBe(MOCK_ADS_RAW[0].headline);
    expect(ad.description).toBe(MOCK_ADS_RAW[0].description);
    expect(ad.ctaButton).toBe(MOCK_ADS_RAW[0].ctaButton);
    expect(ad.version).toBe(0);
    expect(ad.id).toBeTruthy();
  });

  it('generates a batch of ads from a brief', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse(MOCK_ADS_RAW));

    const ads = await writer.generateBatch(MOCK_BRIEF, 2);

    expect(ads).toHaveLength(2);
    expect(ads[0].briefId).toBe('brief-001');
    expect(ads[1].briefId).toBe('brief-001');
    expect(ads[0].id).not.toBe(ads[1].id);
    expect(ads.every((ad: Ad) => ad.version === 0)).toBe(true);
  });

  it('calls Gemini with flash role and JSON mode', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    await writer.generateAd(MOCK_BRIEF);

    expect(mockCallGemini).toHaveBeenCalledOnce();
    const [role, , , options] = mockCallGemini.mock.calls[0];
    expect(role).toBe('flash');
    expect(options?.jsonMode).toBe(true);
  });

  it('includes brief context in the prompt', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    await writer.generateAd(MOCK_BRIEF);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('student');
    expect(userPrompt).toContain('conversion');
    expect(userPrompt).toContain('aspiration');
    expect(userPrompt).toContain('Expert SAT tutors');
  });

  it('includes competitor patterns in prompt when provided', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    await writer.generateAd(MOCK_BRIEF, MOCK_PATTERN);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('question');
    expect(userPrompt).toContain('aspiration');
    expect(userPrompt).toContain('Hook → benefit → CTA');
  });

  it('includes metadata from Gemini response in each ad', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    const ad = await writer.generateAd(MOCK_BRIEF);

    expect(ad.metadata.model).toBe('gemini-2.0-flash');
    expect(ad.metadata.tokensIn).toBe(600);
    expect(ad.metadata.tokensOut).toBe(500);
    expect(ad.metadata.costUsd).toBe(0.001);
    expect(ad.metadata.seed).toBe(42);
  });

  it('throws on invalid JSON response', async () => {
    mockCallGemini.mockResolvedValueOnce({
      text: 'not json',
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.001,
      model: 'gemini-2.0-flash',
      seed: 42,
      promptHash: 'hash',
      generatedAt: '2025-01-01T00:00:00.000Z',
    });

    await expect(writer.generateAd(MOCK_BRIEF)).rejects.toThrow();
  });

  it('throws when batch response has fewer ads than requested', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    await expect(writer.generateBatch(MOCK_BRIEF, 5)).rejects.toThrow();
  });

  it('assigns unique IDs to each ad in a batch', async () => {
    const fiveAds = Array.from({ length: 5 }, (_, i) => ({
      primaryText: `Ad text ${i}`,
      headline: `Headline ${i}`,
      description: `Description ${i}`,
      ctaButton: 'CTA',
    }));
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse(fiveAds));

    const ads = await writer.generateBatch(MOCK_BRIEF, 5);

    const ids = ads.map((ad: Ad) => ad.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(5);
  });

  it('splits cost evenly across ads in a batch', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse(MOCK_ADS_RAW));

    const ads = await writer.generateBatch(MOCK_BRIEF, 2);

    // Original call: tokensIn=600, tokensOut=500, costUsd=0.001
    // Split across 2 ads: 300, 250, 0.0005
    expect(ads[0].metadata.tokensIn).toBe(300);
    expect(ads[0].metadata.tokensOut).toBe(250);
    expect(ads[0].metadata.costUsd).toBeCloseTo(0.0005, 6);
    expect(ads[1].metadata.costUsd).toBeCloseTo(0.0005, 6);
  });

  it('varies seed by round and seedOffset when both provided', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    await writer.generateAd(MOCK_BRIEF, undefined, undefined, 3, 1000);

    const [, , , options] = mockCallGemini.mock.calls[0];
    // DEFAULT_SEED (42) + seedOffset (1000) + round (3) = 1045
    expect(options?.seed).toBe(1045);
  });

  it('varies seed by round only when no seedOffset provided', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    await writer.generateAd(MOCK_BRIEF, undefined, undefined, 3);

    const [, , , options] = mockCallGemini.mock.calls[0];
    // DEFAULT_SEED (42) + round (3) = 45
    expect(options?.seed).toBe(45);
  });

  it('uses default seed when no round or seedOffset is provided', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    await writer.generateAd(MOCK_BRIEF);

    const [, , , options] = mockCallGemini.mock.calls[0];
    expect(options?.seed).toBeUndefined();
  });

  it('includes few-shot examples in prompt when provided', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockAdResponse([MOCK_ADS_RAW[0]]));

    const fewShotExamples: FewShotExample[] = [
      {
        tier: 'strong',
        primaryText: 'Strong ad copy here.',
        headline: 'Strong Headline',
        description: 'Strong description.',
        ctaButton: 'Learn more',
        tierRationale: 'Longest-running ad.',
      },
      {
        tier: 'weak',
        primaryText: 'Weak ad copy.',
        headline: 'Weak Headline',
        description: 'Weak description.',
        ctaButton: 'Learn more',
        tierRationale: 'Generic messaging.',
      },
    ];

    await writer.generateAd(MOCK_BRIEF, undefined, fewShotExamples);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('Quality Reference Examples');
    expect(userPrompt).toContain('STRONG');
    expect(userPrompt).toContain('WEAK');
    expect(userPrompt).toContain('Strong ad copy here.');
    expect(userPrompt).toContain('Weak ad copy.');
  });
});
