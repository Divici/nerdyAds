import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EvaluatorAgent } from '../../src/agents/evaluator.js';
import type { Ad } from '../../src/types/ad.js';
import type { Brief } from '../../src/types/brief.js';
import type { CalibrationAnchor } from '../../src/config/prompts.js';

// Mock the gemini client
vi.mock('../../src/utils/gemini-client.js', () => ({
  callGemini: vi.fn(),
}));

import { callGemini } from '../../src/utils/gemini-client.js';
const mockCallGemini = vi.mocked(callGemini);

const MOCK_AD: Ad = {
  id: 'ad-001',
  briefId: 'brief-001',
  primaryText: 'Boost your SAT score with expert tutors who know what it takes to succeed.',
  headline: 'SAT Prep That Works',
  description: 'Join thousands of students who improved their scores.',
  ctaButton: 'Sign Up',
  version: 0,
  metadata: {
    model: 'gemini-2.0-flash',
    seed: 42,
    promptHash: 'abc123',
    tokensIn: 100,
    tokensOut: 200,
    costUsd: 0.001,
    generatedAt: '2025-01-01T00:00:00.000Z',
  },
};

const MOCK_BRIEF: Brief = {
  id: 'brief-001',
  targetAudience: 'student',
  campaignGoal: 'conversion',
  emotionalAngle: 'aspiration',
  offer: 'Expert SAT tutors help you reach your target score',
};

function makeMockGeminiResponse(scores: Array<{
  dimension: string;
  score: number;
  rationale: string;
  confidence: number;
}>) {
  return {
    text: JSON.stringify({ scores }),
    tokensIn: 500,
    tokensOut: 300,
    costUsd: 0.002,
    model: 'gemini-2.0-pro',
    seed: 42,
    promptHash: 'eval-hash-123',
    generatedAt: '2025-01-01T00:00:00.000Z',
  };
}

const GOOD_SCORES = [
  { dimension: 'clarity', score: 8, rationale: 'Clear message about SAT prep.', confidence: 8 },
  { dimension: 'value_proposition', score: 7, rationale: 'Expert tutors is a solid value prop.', confidence: 7 },
  { dimension: 'emotional_resonance', score: 7, rationale: 'Aspiration framing works well.', confidence: 6 },
  { dimension: 'cta', score: 8, rationale: 'Start Now is clear and actionable.', confidence: 8 },
  { dimension: 'brand_voice', score: 7, rationale: 'Supportive and expert tone.', confidence: 7 },
];

const WEAK_SCORES = [
  { dimension: 'clarity', score: 4, rationale: 'Message is confusing.', confidence: 5 },
  { dimension: 'value_proposition', score: 3, rationale: 'No clear differentiation.', confidence: 6 },
  { dimension: 'emotional_resonance', score: 5, rationale: 'Some emotion but generic.', confidence: 5 },
  { dimension: 'cta', score: 2, rationale: 'CTA is vague.', confidence: 7 },
  { dimension: 'brand_voice', score: 5, rationale: 'Sounds generic.', confidence: 6 },
];

describe('EvaluatorAgent', () => {
  let evaluator: EvaluatorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    evaluator = new EvaluatorAgent();
  });

  it('evaluates an ad and returns a valid Evaluation', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(GOOD_SCORES));

    const evaluation = await evaluator.evaluate(MOCK_AD);

    expect(evaluation.adId).toBe('ad-001');
    expect(evaluation.scores).toHaveLength(5);
    expect(evaluation.weightedScore).toBeGreaterThanOrEqual(1);
    expect(evaluation.weightedScore).toBeLessThanOrEqual(10);
    expect(['high', 'medium', 'low']).toContain(evaluation.overallConfidence);
  });

  it('defaults to flash model for speed', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(GOOD_SCORES));

    await evaluator.evaluate(MOCK_AD);

    expect(mockCallGemini).toHaveBeenCalledOnce();
    const [role] = mockCallGemini.mock.calls[0];
    expect(role).toBe('flash');
  });

  it('calls Gemini with JSON mode', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(GOOD_SCORES));

    await evaluator.evaluate(MOCK_AD);

    expect(mockCallGemini).toHaveBeenCalledOnce();
    const [, , , options] = mockCallGemini.mock.calls[0];
    expect(options?.jsonMode).toBe(true);
  });

  it('includes brief context in prompt when provided', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(GOOD_SCORES));

    await evaluator.evaluate(MOCK_AD, MOCK_BRIEF);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('student');
    expect(userPrompt).toContain('conversion');
    expect(userPrompt).toContain('aspiration');
  });

  it('computes weighted score from dimension scores', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(GOOD_SCORES));

    const evaluation = await evaluator.evaluate(MOCK_AD);

    // clarity=8(25%) + value=7(25%) + emotion=7(20%) + cta=8(15%) + brand=7(15%)
    // = (200 + 175 + 140 + 120 + 105) / 100 = 7.4
    expect(evaluation.weightedScore).toBeCloseTo(7.4, 1);
  });

  it('computes confidence level correctly', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(GOOD_SCORES));

    const evaluation = await evaluator.evaluate(MOCK_AD);

    // avg confidence = (8+7+6+8+7)/5 = 7.2 → high
    expect(evaluation.overallConfidence).toBe('high');
  });

  it('handles weak ads with low scores', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(WEAK_SCORES));

    const evaluation = await evaluator.evaluate(MOCK_AD);

    expect(evaluation.weightedScore).toBeLessThan(7.0);
    expect(evaluation.overallConfidence).toBe('medium');
  });

  it('includes metadata from gemini response', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(GOOD_SCORES));

    const evaluation = await evaluator.evaluate(MOCK_AD);

    expect(evaluation.metadata.model).toBe('gemini-2.0-pro');
    expect(evaluation.metadata.tokensIn).toBe(500);
    expect(evaluation.metadata.tokensOut).toBe(300);
    expect(evaluation.metadata.costUsd).toBe(0.002);
  });

  it('throws on invalid JSON response from Gemini', async () => {
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

    await expect(evaluator.evaluate(MOCK_AD)).rejects.toThrow();
  });

  it('throws on response missing required dimensions', async () => {
    const incompleteScores = GOOD_SCORES.slice(0, 3); // only 3 dimensions
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(incompleteScores));

    await expect(evaluator.evaluate(MOCK_AD)).rejects.toThrow();
  });

  it('includes calibration anchors in prompt when provided', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockGeminiResponse(GOOD_SCORES));

    const anchors: CalibrationAnchor[] = [
      {
        label: 'strong',
        primaryText: 'A strong example ad text.',
        headline: 'Strong Headline',
        expectedScoreRange: '8-9',
      },
      {
        label: 'weak',
        primaryText: 'A weak example ad text.',
        headline: 'Weak Headline',
        expectedScoreRange: '3-4',
      },
    ];

    await evaluator.evaluate(MOCK_AD, undefined, anchors);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('Calibration Reference');
    expect(userPrompt).toContain('STRONG example');
    expect(userPrompt).toContain('WEAK example');
    expect(userPrompt).toContain('A strong example ad text.');
    expect(userPrompt).toContain('8-9');
  });
});
