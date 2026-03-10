import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EditorAgent } from '../../src/agents/editor.js';
import type { Ad } from '../../src/types/ad.js';
import type { Brief } from '../../src/types/brief.js';
import type { Evaluation, DimensionScore } from '../../src/types/evaluation.js';

// Mock the gemini client
vi.mock('../../src/utils/gemini-client.js', () => ({
  callGemini: vi.fn(),
}));

import { callGemini } from '../../src/utils/gemini-client.js';
const mockCallGemini = vi.mocked(callGemini);

const MOCK_AD: Ad = {
  id: 'ad-001',
  briefId: 'brief-001',
  primaryText: 'Boost your SAT score with expert tutors.',
  headline: 'SAT Prep That Works',
  description: 'Join students who improved.',
  ctaButton: 'Start Now',
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

const MOCK_SCORES: DimensionScore[] = [
  { dimension: 'clarity', score: 8, rationale: 'Clear message.', confidence: 8 },
  { dimension: 'value_proposition', score: 7, rationale: 'Solid value.', confidence: 7 },
  { dimension: 'emotional_resonance', score: 4, rationale: 'Lacks emotional depth.', confidence: 6 },
  { dimension: 'cta', score: 8, rationale: 'Strong CTA.', confidence: 8 },
  { dimension: 'brand_voice', score: 7, rationale: 'On-brand tone.', confidence: 7 },
];

const MOCK_EVALUATION: Evaluation = {
  adId: 'ad-001',
  scores: MOCK_SCORES,
  weightedScore: 6.8,
  overallConfidence: 'high' as const,
  metadata: {
    model: 'gemini-2.0-pro',
    seed: 42,
    promptHash: 'eval-hash',
    tokensIn: 500,
    tokensOut: 300,
    costUsd: 0.002,
    generatedAt: '2025-01-01T00:00:00.000Z',
  },
};

function makeMockEditResponse(ad: {
  primaryText: string;
  headline: string;
  description: string;
  ctaButton: string;
}) {
  return {
    text: JSON.stringify({ ad }),
    tokensIn: 400,
    tokensOut: 300,
    costUsd: 0.001,
    model: 'gemini-2.0-flash',
    seed: 42,
    promptHash: 'editor-hash-123',
    generatedAt: '2025-01-01T00:00:00.000Z',
  };
}

const IMPROVED_AD_RAW = {
  primaryText: 'Picture this: walking out of the SAT knowing you gave it your best shot. Our expert tutors make that feeling real.',
  headline: 'SAT Prep That Inspires Confidence',
  description: 'Join students who didn\'t just improve — they transformed.',
  ctaButton: 'Start Now',
};

describe('EditorAgent', () => {
  let editor: EditorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    editor = new EditorAgent();
  });

  it('improves an ad targeting the weakest dimension', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    const improved = await editor.improve(MOCK_AD, MOCK_EVALUATION);

    expect(improved.primaryText).toBe(IMPROVED_AD_RAW.primaryText);
    expect(improved.headline).toBe(IMPROVED_AD_RAW.headline);
  });

  it('increments the version number', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    const improved = await editor.improve(MOCK_AD, MOCK_EVALUATION);

    expect(improved.version).toBe(1);
  });

  it('preserves the original ad ID and briefId', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    const improved = await editor.improve(MOCK_AD, MOCK_EVALUATION);

    expect(improved.id).toBe('ad-001');
    expect(improved.briefId).toBe('brief-001');
  });

  it('calls Gemini with flash role and JSON mode', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    await editor.improve(MOCK_AD, MOCK_EVALUATION);

    expect(mockCallGemini).toHaveBeenCalledOnce();
    const [role, , , options] = mockCallGemini.mock.calls[0];
    expect(role).toBe('flash');
    expect(options?.jsonMode).toBe(true);
  });

  it('includes weakness info in the prompt', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    await editor.improve(MOCK_AD, MOCK_EVALUATION);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('emotional_resonance');
    expect(userPrompt).toContain('Lacks emotional depth');
  });

  it('includes the original ad text in the prompt', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    await editor.improve(MOCK_AD, MOCK_EVALUATION);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('Boost your SAT score');
    expect(userPrompt).toContain('SAT Prep That Works');
  });

  it('tracks version across multiple improvements', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    const v1 = await editor.improve(MOCK_AD, MOCK_EVALUATION);
    expect(v1.version).toBe(1);

    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse({
      ...IMPROVED_AD_RAW,
      primaryText: 'Even better version of the ad.',
    }));

    const v2 = await editor.improve(v1, MOCK_EVALUATION);
    expect(v2.version).toBe(2);
  });

  it('updates metadata from the new Gemini response', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    const improved = await editor.improve(MOCK_AD, MOCK_EVALUATION);

    expect(improved.metadata.model).toBe('gemini-2.0-flash');
    expect(improved.metadata.promptHash).toBe('editor-hash-123');
    expect(improved.metadata.tokensIn).toBe(400);
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

    await expect(editor.improve(MOCK_AD, MOCK_EVALUATION)).rejects.toThrow();
  });

  it('includes all dimension scores for context', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    await editor.improve(MOCK_AD, MOCK_EVALUATION);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('clarity');
    expect(userPrompt).toContain('value_proposition');
    expect(userPrompt).toContain('cta');
    expect(userPrompt).toContain('brand_voice');
  });

  it('includes brief context in prompt when provided', async () => {
    mockCallGemini.mockResolvedValueOnce(makeMockEditResponse(IMPROVED_AD_RAW));

    const brief: Brief = {
      id: 'brief-001',
      targetAudience: 'parent',
      campaignGoal: 'conversion',
      emotionalAngle: 'anxiety',
      offer: 'SAT prep without the family stress',
    };

    await editor.improve(MOCK_AD, MOCK_EVALUATION, brief);

    const [, , userPrompt] = mockCallGemini.mock.calls[0];
    expect(userPrompt).toContain('parent');
    expect(userPrompt).toContain('conversion');
    expect(userPrompt).toContain('anxiety');
    expect(userPrompt).toContain('SAT prep without the family stress');
  });
});
