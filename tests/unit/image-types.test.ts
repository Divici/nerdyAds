import { describe, it, expect } from 'vitest';
import {
  VisualDimensionNameSchema,
  VisualDimensionScoreSchema,
  ImageVariantSchema,
  AdImageResultSchema,
} from '../../src/types/image.js';
import { AdSchema } from '../../src/types/ad.js';

describe('VisualDimensionNameSchema', () => {
  it('accepts valid visual dimension names', () => {
    expect(VisualDimensionNameSchema.parse('brand_consistency')).toBe('brand_consistency');
    expect(VisualDimensionNameSchema.parse('copy_alignment')).toBe('copy_alignment');
    expect(VisualDimensionNameSchema.parse('engagement_potential')).toBe('engagement_potential');
  });

  it('rejects invalid dimension names', () => {
    expect(() => VisualDimensionNameSchema.parse('clarity')).toThrow();
    expect(() => VisualDimensionNameSchema.parse('invalid')).toThrow();
  });
});

describe('VisualDimensionScoreSchema', () => {
  const validScore = {
    dimension: 'brand_consistency',
    score: 8,
    rationale: 'Strong VT brand colors used throughout',
    confidence: 7,
  };

  it('accepts a valid visual dimension score', () => {
    const result = VisualDimensionScoreSchema.parse(validScore);
    expect(result.dimension).toBe('brand_consistency');
    expect(result.score).toBe(8);
  });

  it('rejects score outside 1-10 range', () => {
    expect(() => VisualDimensionScoreSchema.parse({ ...validScore, score: 0 })).toThrow();
    expect(() => VisualDimensionScoreSchema.parse({ ...validScore, score: 11 })).toThrow();
  });

  it('rejects empty rationale', () => {
    expect(() => VisualDimensionScoreSchema.parse({ ...validScore, rationale: '' })).toThrow();
  });
});

const makeMetadata = () => ({
  model: 'gemini-2.5-flash',
  seed: 42,
  promptHash: 'abc123',
  tokensIn: 100,
  tokensOut: 200,
  costUsd: 0.04,
  generatedAt: '2026-03-13T00:00:00Z',
});

const makeVariant = (index: number) => ({
  variantIndex: index,
  imagePath: `/api/output/run-123/images/ad-1-variant-${index}.png`,
  blurb: `A student studying for the SAT in variant ${index}`,
  metadata: makeMetadata(),
});

describe('ImageVariantSchema', () => {
  it('accepts a valid image variant without scores', () => {
    const result = ImageVariantSchema.parse(makeVariant(0));
    expect(result.variantIndex).toBe(0);
    expect(result.visualScores).toBeUndefined();
  });

  it('accepts a valid image variant with visual scores', () => {
    const variant = {
      ...makeVariant(0),
      visualScores: [
        { dimension: 'brand_consistency', score: 8, rationale: 'Good', confidence: 7 },
        { dimension: 'copy_alignment', score: 7, rationale: 'Matches', confidence: 6 },
        { dimension: 'engagement_potential', score: 9, rationale: 'Strong', confidence: 8 },
      ],
    };
    const result = ImageVariantSchema.parse(variant);
    expect(result.visualScores).toHaveLength(3);
  });

  it('rejects variantIndex outside 0', () => {
    expect(() => ImageVariantSchema.parse({ ...makeVariant(0), variantIndex: 1 })).toThrow();
    expect(() => ImageVariantSchema.parse({ ...makeVariant(0), variantIndex: -1 })).toThrow();
  });

  it('rejects empty imagePath', () => {
    expect(() => ImageVariantSchema.parse({ ...makeVariant(0), imagePath: '' })).toThrow();
  });
});

describe('AdImageResultSchema', () => {
  const validResult = {
    adId: 'ad-1',
    runId: 'run-123',
    variants: [makeVariant(0)],
    generatedAt: '2026-03-13T00:00:00Z',
  };

  it('accepts a valid result without confirmed variant', () => {
    const result = AdImageResultSchema.parse(validResult);
    expect(result.confirmedVariant).toBeUndefined();
    expect(result.variants).toHaveLength(1);
  });

  it('accepts a valid result with confirmed variant', () => {
    const result = AdImageResultSchema.parse({ ...validResult, confirmedVariant: 0 });
    expect(result.confirmedVariant).toBe(0);
  });

  it('rejects confirmedVariant outside 0', () => {
    expect(() => AdImageResultSchema.parse({ ...validResult, confirmedVariant: 1 })).toThrow();
  });

  it('requires exactly 1 variant', () => {
    expect(() => AdImageResultSchema.parse({ ...validResult, variants: [makeVariant(0), makeVariant(0)] })).toThrow();
  });
});

describe('AdSchema backwards compatibility', () => {
  const validAd = {
    id: 'ad-1',
    briefId: 'brief-001',
    primaryText: 'Your child is smarter than their score.',
    headline: 'SAT Prep That Works',
    description: 'Expert 1-on-1 tutoring',
    ctaButton: 'Get Started',
    version: 0,
    metadata: makeMetadata(),
  };

  it('parses an ad without imageResult (v1 compat)', () => {
    const result = AdSchema.parse(validAd);
    expect(result.imageResult).toBeUndefined();
  });

  it('parses an ad with imageResult (v2)', () => {
    const result = AdSchema.parse({
      ...validAd,
      imageResult: {
        confirmedVariant: 0,
        imagePath: '/api/output/run-123/images/ad-1-variant-0.png',
      },
    });
    expect(result.imageResult?.confirmedVariant).toBe(0);
    expect(result.imageResult?.imagePath).toContain('variant-0');
  });
});
