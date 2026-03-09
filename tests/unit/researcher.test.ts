import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResearcherAgent } from '../../src/agents/researcher.js';
import type { CompetitorPattern } from '../../src/types/patterns.js';

// Mock the gemini client
vi.mock('../../src/utils/gemini-client.js', () => ({
  callGemini: vi.fn(),
}));

import { callGemini } from '../../src/utils/gemini-client.js';
const mockCallGemini = vi.mocked(callGemini);

const MOCK_COMPETITOR_ADS = [
  {
    competitor: 'Princeton Review',
    primary_text: 'Learn from top SAT tutors with 40+ years of experience.',
    headline: 'In-Person SAT 1400+ Course',
    description: 'Score a 1400+ or get a refund.',
    cta_button: 'Get offer',
    hook_type: 'question',
    target_audience: 'both',
    emotional_angle: 'aspiration',
  },
  {
    competitor: 'Kaplan',
    primary_text: '4 points can be all that separate a good ACT score from a great one.',
    headline: 'The Realistic ACT Practice You Need',
    description: 'Find your prep today.',
    cta_button: 'Learn More',
    hook_type: 'stat',
    target_audience: 'student',
    emotional_angle: 'aspiration',
  },
];

function makeMockPatternResponse(pattern: CompetitorPattern) {
  return {
    text: JSON.stringify(pattern),
    tokensIn: 800,
    tokensOut: 400,
    costUsd: 0.005,
    model: 'gemini-2.0-pro',
    seed: 42,
    promptHash: 'researcher-hash-123',
    generatedAt: '2025-01-01T00:00:00.000Z',
  };
}

const MOCK_PATTERN: CompetitorPattern = {
  hookTypes: ['question', 'stat', 'fear'],
  emotionalAngles: ['aspiration', 'anxiety', 'social_proof'],
  ctaStyles: ['Get offer', 'Learn More', 'Sign Up'],
  commonPhrases: ['top SAT tutors', 'score a 1400+', 'expert guidance'],
  structuralPatterns: [
    'Hook question → benefit → score guarantee → CTA',
    'Stat hook → credibility → CTA',
  ],
  source: 'competitor_analysis',
};

describe('ResearcherAgent', () => {
  let researcher: ResearcherAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    researcher = new ResearcherAgent();
  });

  it('analyzes competitor ads and returns a valid CompetitorPattern', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockPatternResponse(MOCK_PATTERN));

    const result = await researcher.analyzePatterns(MOCK_COMPETITOR_ADS);

    expect(result.pattern.hookTypes).toEqual(expect.arrayContaining(['question', 'stat']));
    expect(result.pattern.emotionalAngles.length).toBeGreaterThan(0);
    expect(result.pattern.ctaStyles.length).toBeGreaterThan(0);
    expect(result.pattern.commonPhrases.length).toBeGreaterThan(0);
    expect(result.pattern.structuralPatterns.length).toBeGreaterThan(0);
    expect(result.pattern.source).toBe('competitor_analysis');
  });

  it('calls Gemini with pro role and JSON mode', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockPatternResponse(MOCK_PATTERN));

    await researcher.analyzePatterns(MOCK_COMPETITOR_ADS);

    expect(mockCallGemini).toHaveBeenCalledOnce();
    const [role, , , options] = mockCallGemini.mock.calls[0];
    expect(role).toBe('pro');
    expect(options?.jsonMode).toBe(true);
  });

  it('includes competitor ad data in the prompt', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockPatternResponse(MOCK_PATTERN));

    await researcher.analyzePatterns(MOCK_COMPETITOR_ADS);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('Princeton Review');
    expect(userPrompt).toContain('Kaplan');
    expect(userPrompt).toContain('40+ years of experience');
  });

  it('returns metadata from Gemini response', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockPatternResponse(MOCK_PATTERN));

    const result = await researcher.analyzePatterns(MOCK_COMPETITOR_ADS);

    expect(result.metadata.model).toBe('gemini-2.0-pro');
    expect(result.metadata.tokensIn).toBe(800);
    expect(result.metadata.costUsd).toBe(0.005);
  });

  it('throws on invalid JSON response', async () => {
    mockCallGemini.mockResolvedValueOnce({
      text: 'not valid json',
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.001,
      model: 'gemini-2.0-pro',
      seed: 42,
      promptHash: 'hash',
      generatedAt: '2025-01-01T00:00:00.000Z',
    });

    await expect(researcher.analyzePatterns(MOCK_COMPETITOR_ADS)).rejects.toThrow();
  });

  it('throws on response missing required fields', async () => {
    const incompletePattern = { hookTypes: ['question'] }; // missing other fields
    mockCallGemini.mockResolvedValueOnce({
      text: JSON.stringify(incompletePattern),
      tokensIn: 100,
      tokensOut: 50,
      costUsd: 0.001,
      model: 'gemini-2.0-pro',
      seed: 42,
      promptHash: 'hash',
      generatedAt: '2025-01-01T00:00:00.000Z',
    });

    await expect(researcher.analyzePatterns(MOCK_COMPETITOR_ADS)).rejects.toThrow();
  });
});
