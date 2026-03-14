import { z } from 'zod';

export const AdMetadataSchema = z.object({
  model: z.string(),
  seed: z.number().int(),
  promptHash: z.string(),
  tokensIn: z.number().int().nonnegative(),
  tokensOut: z.number().int().nonnegative(),
  costUsd: z.number().nonnegative(),
  generatedAt: z.string(),
});

export type AdMetadata = z.infer<typeof AdMetadataSchema>;

export const AdImageRefSchema = z.object({
  confirmedVariant: z.number().int().min(0).max(0),
  imagePath: z.string().min(1),
});
export type AdImageRef = z.infer<typeof AdImageRefSchema>;

export const AdSchema = z.object({
  id: z.string(),
  briefId: z.string(),
  primaryText: z.string().min(1),
  headline: z.string().min(1),
  description: z.string().min(1),
  ctaButton: z.string().min(1),
  version: z.number().int().nonnegative(),
  metadata: AdMetadataSchema,
  imageResult: AdImageRefSchema.optional(),
});

export type Ad = z.infer<typeof AdSchema>;
