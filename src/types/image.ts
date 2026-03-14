import { z } from 'zod';
import { AdMetadataSchema } from './ad.js';

export const VisualDimensionNameSchema = z.enum([
  'brand_consistency',
  'copy_alignment',
  'engagement_potential',
]);
export type VisualDimensionName = z.infer<typeof VisualDimensionNameSchema>;

export const VisualDimensionScoreSchema = z.object({
  dimension: VisualDimensionNameSchema,
  score: z.number().min(1).max(10),
  rationale: z.string().min(1),
  confidence: z.number().min(1).max(10),
});
export type VisualDimensionScore = z.infer<typeof VisualDimensionScoreSchema>;

export const ImageVariantSchema = z.object({
  variantIndex: z.number().int().min(0).max(0),
  imagePath: z.string().min(1),
  blurb: z.string().min(1),
  visualScores: z.array(VisualDimensionScoreSchema).length(3).optional(),
  metadata: AdMetadataSchema,
});
export type ImageVariant = z.infer<typeof ImageVariantSchema>;

export const AdImageResultSchema = z.object({
  adId: z.string(),
  runId: z.string(),
  variants: z.array(ImageVariantSchema).length(1),
  confirmedVariant: z.number().int().min(0).max(0).optional(),
  generatedAt: z.string(),
});
export type AdImageResult = z.infer<typeof AdImageResultSchema>;
