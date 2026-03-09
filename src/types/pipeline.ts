import { z } from 'zod';
import { AdSchema } from './ad.js';
import { EvaluationSchema } from './evaluation.js';

export const AdWithHistorySchema = z.object({
  ad: AdSchema,
  evaluations: z.array(EvaluationSchema),
  accepted: z.boolean(),
  cyclesUsed: z.number().int().nonnegative(),
});

export type AdWithHistory = z.infer<typeof AdWithHistorySchema>;

export const BatchMetricsSchema = z.object({
  briefId: z.string(),
  adsGenerated: z.number().int().nonnegative(),
  adsAccepted: z.number().int().nonnegative(),
  acceptanceRate: z.number().min(0).max(1),
  averageScore: z.number(),
  costUsd: z.number().nonnegative(),
});

export type BatchMetrics = z.infer<typeof BatchMetricsSchema>;

export const PipelineResultSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  briefs: z.array(z.object({
    briefId: z.string(),
    ads: z.array(AdWithHistorySchema).optional(),
    metrics: BatchMetricsSchema.optional(),
  })).optional(),
  totalAdsGenerated: z.number().int().nonnegative(),
  totalAdsAccepted: z.number().int().nonnegative(),
  acceptanceRate: z.number().min(0).max(1),
  averageScore: z.number(),
  totalCostUsd: z.number().nonnegative(),
  totalTokensIn: z.number().int().nonnegative(),
  totalTokensOut: z.number().int().nonnegative(),
});

export type PipelineResult = z.infer<typeof PipelineResultSchema>;
