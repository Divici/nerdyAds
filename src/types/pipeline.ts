import { z } from 'zod';
import { AdSchema } from './ad.js';
import { EvaluationSchema } from './evaluation.js';

export const AdWithHistorySchema = z.object({
  ad: AdSchema,
  evaluations: z.array(EvaluationSchema),
  accepted: z.boolean(),
  cyclesUsed: z.number().int().nonnegative(),
  /** All ad versions: index 0 = original, index N = after Nth edit cycle */
  adVersions: z.array(AdSchema).optional(),
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

export const BriefResultSchema = z.object({
  briefId: z.string(),
  ads: z.array(AdWithHistorySchema).optional(),
  rejected: z.array(AdWithHistorySchema).optional(),
  roundsUsed: z.number().int().nonnegative().optional(),
  metrics: BatchMetricsSchema.optional(),
});

export type BriefResult = z.infer<typeof BriefResultSchema>;

export const PipelineResultSchema = z.object({
  runId: z.string(),
  startedAt: z.string(),
  completedAt: z.string(),
  briefs: z.array(BriefResultSchema).optional(),
  totalAdsGenerated: z.number().int().nonnegative(),
  totalAdsAccepted: z.number().int().nonnegative(),
  totalAdsRejected: z.number().int().nonnegative(),
  acceptanceRate: z.number().min(0).max(1),
  averageScore: z.number(),
  costPerAcceptedAd: z.number().nonnegative(),
  totalCostUsd: z.number().nonnegative(),
  totalTokensIn: z.number().int().nonnegative(),
  totalTokensOut: z.number().int().nonnegative(),
});

export type PipelineResult = z.infer<typeof PipelineResultSchema>;
