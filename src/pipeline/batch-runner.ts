import type { Ad } from '../types/ad.js';
import type { Brief } from '../types/brief.js';
import type { AdWithHistory } from '../types/pipeline.js';
import type { CompetitorPattern } from '../types/patterns.js';
import type { Evaluation } from '../types/evaluation.js';
import { iterateAd, type IterationDeps } from './iteration-loop.js';
import { logger } from '../utils/logger.js';

export interface BatchRunnerDeps {
  generateBatch: (brief: Brief, count: number, patterns?: CompetitorPattern) => Promise<Ad[]>;
  evaluate: (ad: Ad, brief?: Brief) => Promise<Evaluation>;
  improve: (ad: Ad, evaluation: Evaluation, brief?: Brief) => Promise<Ad>;
  checkThreshold: (score: number) => boolean;
  maxCycles: number;
}

export interface BatchResult {
  briefId: string;
  ads: AdWithHistory[];
}

/**
 * Generate a batch of ads for a single brief, then iterate each through
 * the evaluate→improve loop.
 */
export async function runBatch(
  brief: Brief,
  count: number,
  deps: BatchRunnerDeps,
  patterns?: CompetitorPattern,
): Promise<BatchResult> {
  logger.info('Starting batch for brief', { briefId: brief.id, count });

  const rawAds = await deps.generateBatch(brief, count, patterns);

  const iterationDeps: IterationDeps = {
    evaluate: deps.evaluate,
    improve: deps.improve,
    checkThreshold: deps.checkThreshold,
    maxCycles: deps.maxCycles,
  };

  // Process ads concurrently
  const results = await Promise.all(
    rawAds.map((ad) => iterateAd(ad, iterationDeps, brief)),
  );

  const accepted = results.filter((r) => r.accepted).length;
  logger.info('Batch complete', {
    briefId: brief.id,
    generated: rawAds.length,
    accepted,
  });

  return { briefId: brief.id, ads: results };
}
