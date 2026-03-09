import { z } from 'zod';
import { AdMetadataSchema } from './ad.js';

export const DimensionNameSchema = z.enum([
  'clarity',
  'value_proposition',
  'emotional_resonance',
  'cta',
  'brand_voice',
]);
export type DimensionName = z.infer<typeof DimensionNameSchema>;

export const DimensionScoreSchema = z.object({
  dimension: DimensionNameSchema,
  score: z.number().min(1).max(10),
  rationale: z.string().min(1),
  confidence: z.number().min(1).max(10),
});

export type DimensionScore = z.infer<typeof DimensionScoreSchema>;

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low']);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevelSchema>;

export const EvaluationSchema = z.object({
  adId: z.string(),
  scores: z.array(DimensionScoreSchema).length(5),
  weightedScore: z.number().min(1).max(10),
  overallConfidence: ConfidenceLevelSchema,
  metadata: AdMetadataSchema,
});

export type Evaluation = z.infer<typeof EvaluationSchema>;
