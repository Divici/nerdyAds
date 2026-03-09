import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  AdSchema,
  AdMetadataSchema,
  BriefSchema,
  DimensionScoreSchema,
  EvaluationSchema,
  PipelineResultSchema,
  AdWithHistorySchema,
  CompetitorPatternSchema,
} from '@types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('Ad schema', () => {
  const validAd = {
    id: 'ad-001',
    briefId: 'brief-001',
    primaryText: 'Master the SAT with expert tutors.',
    headline: 'SAT Prep That Works',
    description: 'Start your journey to a 1400+ score today.',
    ctaButton: 'Learn More',
    version: 1,
    metadata: {
      model: 'gemini-2.0-flash',
      seed: 42,
      promptHash: 'abc123',
      tokensIn: 500,
      tokensOut: 200,
      costUsd: 0.001,
      generatedAt: '2026-03-09T10:00:00Z',
    },
  };

  it('accepts a valid ad', () => {
    const result = AdSchema.safeParse(validAd);
    expect(result.success).toBe(true);
  });

  it('rejects an ad missing required fields', () => {
    const { primaryText, ...incomplete } = validAd;
    const result = AdSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it('rejects an ad with empty primaryText', () => {
    const result = AdSchema.safeParse({ ...validAd, primaryText: '' });
    expect(result.success).toBe(false);
  });

  it('rejects negative version', () => {
    const result = AdSchema.safeParse({ ...validAd, version: -1 });
    expect(result.success).toBe(false);
  });
});

describe('AdMetadata schema', () => {
  it('rejects negative token counts', () => {
    const result = AdMetadataSchema.safeParse({
      model: 'gemini-2.0-flash',
      seed: 42,
      promptHash: 'abc',
      tokensIn: -1,
      tokensOut: 200,
      costUsd: 0.001,
      generatedAt: '2026-03-09T10:00:00Z',
    });
    expect(result.success).toBe(false);
  });
});

describe('Brief schema', () => {
  const validBrief = {
    id: 'brief-001',
    targetAudience: 'student' as const,
    campaignGoal: 'awareness' as const,
    emotionalAngle: 'aspiration',
    keyMessage: 'Expert SAT tutoring that gets results',
    constraints: ['Must mention score guarantee'],
  };

  it('accepts a valid brief', () => {
    const result = BriefSchema.safeParse(validBrief);
    expect(result.success).toBe(true);
  });

  it('rejects invalid targetAudience', () => {
    const result = BriefSchema.safeParse({ ...validBrief, targetAudience: 'alien' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid campaignGoal', () => {
    const result = BriefSchema.safeParse({ ...validBrief, campaignGoal: 'world_domination' });
    expect(result.success).toBe(false);
  });

  it('allows brief without constraints', () => {
    const { constraints, ...noConstraints } = validBrief;
    const result = BriefSchema.safeParse(noConstraints);
    expect(result.success).toBe(true);
  });
});

describe('DimensionScore schema', () => {
  it('accepts scores in valid range (1-10)', () => {
    const result = DimensionScoreSchema.safeParse({
      dimension: 'clarity',
      score: 8.5,
      rationale: 'Clear and concise messaging.',
      confidence: 9,
    });
    expect(result.success).toBe(true);
  });

  it('rejects scores above 10', () => {
    const result = DimensionScoreSchema.safeParse({
      dimension: 'clarity',
      score: 11,
      rationale: 'Too good.',
      confidence: 9,
    });
    expect(result.success).toBe(false);
  });

  it('rejects scores below 1', () => {
    const result = DimensionScoreSchema.safeParse({
      dimension: 'clarity',
      score: 0,
      rationale: 'Zero.',
      confidence: 9,
    });
    expect(result.success).toBe(false);
  });
});

describe('Evaluation schema', () => {
  const validEvaluation = {
    adId: 'ad-001',
    scores: [
      { dimension: 'clarity' as const, score: 8, rationale: 'Clear.', confidence: 8 },
      { dimension: 'value_proposition' as const, score: 7, rationale: 'Good value.', confidence: 7 },
      { dimension: 'emotional_resonance' as const, score: 6, rationale: 'Decent emotion.', confidence: 6 },
      { dimension: 'cta' as const, score: 7, rationale: 'Solid CTA.', confidence: 8 },
      { dimension: 'brand_voice' as const, score: 8, rationale: 'On brand.', confidence: 9 },
    ],
    weightedScore: 7.3,
    overallConfidence: 'high' as const,
    metadata: {
      model: 'gemini-2.0-pro',
      seed: 42,
      promptHash: 'eval123',
      tokensIn: 800,
      tokensOut: 400,
      costUsd: 0.01,
      generatedAt: '2026-03-09T10:05:00Z',
    },
  };

  it('accepts a valid evaluation', () => {
    const result = EvaluationSchema.safeParse(validEvaluation);
    expect(result.success).toBe(true);
  });

  it('rejects evaluation with fewer than 5 dimension scores', () => {
    const result = EvaluationSchema.safeParse({
      ...validEvaluation,
      scores: validEvaluation.scores.slice(0, 3),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid confidence level', () => {
    const result = EvaluationSchema.safeParse({
      ...validEvaluation,
      overallConfidence: 'maybe',
    });
    expect(result.success).toBe(false);
  });
});

describe('PipelineResult schema', () => {
  it('accepts a valid pipeline result', () => {
    const result = PipelineResultSchema.safeParse({
      runId: 'run-001',
      startedAt: '2026-03-09T10:00:00Z',
      completedAt: '2026-03-09T10:30:00Z',
      briefs: [],
      totalAdsGenerated: 50,
      totalAdsAccepted: 40,
      acceptanceRate: 0.8,
      averageScore: 7.8,
      totalCostUsd: 0.5,
      totalTokensIn: 50000,
      totalTokensOut: 25000,
    });
    expect(result.success).toBe(true);
  });
});

describe('AdWithHistory schema', () => {
  it('accepts an ad with evaluation history', () => {
    const result = AdWithHistorySchema.safeParse({
      ad: {
        id: 'ad-001',
        briefId: 'brief-001',
        primaryText: 'Test ad copy.',
        headline: 'Test Headline',
        description: 'Test description.',
        ctaButton: 'Sign Up',
        version: 2,
        metadata: {
          model: 'gemini-2.0-flash',
          seed: 42,
          promptHash: 'h1',
          tokensIn: 100,
          tokensOut: 50,
          costUsd: 0.001,
          generatedAt: '2026-03-09T10:00:00Z',
        },
      },
      evaluations: [],
      accepted: true,
      cyclesUsed: 2,
    });
    expect(result.success).toBe(true);
  });
});

describe('CompetitorPattern schema', () => {
  it('accepts a valid pattern', () => {
    const result = CompetitorPatternSchema.safeParse({
      hookTypes: ['question', 'stat'],
      emotionalAngles: ['aspiration', 'anxiety'],
      ctaStyles: ['Get offer', 'Learn More'],
      commonPhrases: ['expert tutors', 'score guarantee'],
      structuralPatterns: ['Hook → benefit → social proof → CTA'],
      source: 'competitor_ads.json',
    });
    expect(result.success).toBe(true);
  });
});

describe('briefs.json', () => {
  const briefs = JSON.parse(readFileSync(resolve(__dirname, '../../data/briefs.json'), 'utf-8'));

  it('contains exactly 10 briefs', () => {
    expect(briefs).toHaveLength(10);
  });

  it('every brief passes BriefSchema validation', () => {
    for (const brief of briefs) {
      const result = BriefSchema.safeParse(brief);
      expect(result.success, `Brief ${brief.id} failed: ${JSON.stringify(result.error?.issues)}`).toBe(true);
    }
  });

  it('covers all three audience types', () => {
    const audiences = new Set(briefs.map((b: { targetAudience: string }) => b.targetAudience));
    expect(audiences).toContain('student');
    expect(audiences).toContain('parent');
    expect(audiences).toContain('both');
  });

  it('covers all three campaign goals', () => {
    const goals = new Set(briefs.map((b: { campaignGoal: string }) => b.campaignGoal));
    expect(goals).toContain('awareness');
    expect(goals).toContain('conversion');
    expect(goals).toContain('engagement');
  });

  it('has unique IDs', () => {
    const ids = briefs.map((b: { id: string }) => b.id);
    expect(new Set(ids).size).toBe(10);
  });
});
