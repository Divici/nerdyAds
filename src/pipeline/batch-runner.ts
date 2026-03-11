import type { Ad } from '../types/ad.js';
import type { Brief } from '../types/brief.js';
import type { AdWithHistory } from '../types/pipeline.js';
import type { CompetitorPattern } from '../types/patterns.js';
import type { Evaluation, DimensionScore } from '../types/evaluation.js';
import { iterateAd, type IterationDeps } from './iteration-loop.js';
import { logger } from '../utils/logger.js';

export interface BatchRunnerDeps {
  generateBatch: (brief: Brief, count: number, patterns?: CompetitorPattern) => Promise<Ad[]>;
  evaluate: (ad: Ad, brief?: Brief) => Promise<Evaluation>;
  improve: (ad: Ad, evaluation: Evaluation, brief?: Brief) => Promise<Ad>;
  checkThreshold: (score: number, dimensionScores?: DimensionScore[]) => boolean;
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

// ── Continuous Batch Runner ──────────────────────────────────────

export type PipelineEventType =
  | 'round:start'
  | 'ad:generating'
  | 'ad:evaluating'
  | 'ad:accepted'
  | 'ad:rejected'
  | 'ad:improving';

export interface PipelineEvent {
  type: PipelineEventType;
  briefId: string;
  round?: number;
  ad?: Ad;
  adWithHistory?: AdWithHistory;
  evaluation?: Evaluation;
}

export type PipelineEventCallback = (event: PipelineEvent) => void;

export interface ContinuousBatchDeps {
  generateBatch: (brief: Brief, count: number, patterns?: CompetitorPattern) => Promise<Ad[]>;
  evaluate: (ad: Ad, brief?: Brief) => Promise<Evaluation>;
  improve: (ad: Ad, evaluation: Evaluation, brief?: Brief) => Promise<Ad>;
  checkThreshold: (score: number, dimensionScores?: DimensionScore[]) => boolean;
  maxCycles: number;
  patterns?: CompetitorPattern;
  targetAccepted: number;
  batchSize: number;
  maxRounds: number;
  /** Optional callback for streaming pipeline events to UI. */
  onEvent?: PipelineEventCallback;
}

export interface ContinuousBatchResult {
  briefId: string;
  accepted: AdWithHistory[];
  rejected: AdWithHistory[];
  roundsUsed: number;
  totalGenerated: number;
}

/**
 * Generate ads in small batches continuously until enough are accepted
 * or the max round cap is reached. Failed ads that exhaust editor cycles
 * are discarded and replaced with fresh generations.
 */
export async function runContinuousBatch(
  brief: Brief,
  deps: ContinuousBatchDeps,
): Promise<ContinuousBatchResult> {
  const accepted: AdWithHistory[] = [];
  const rejected: AdWithHistory[] = [];
  let round = 0;
  let totalGenerated = 0;

  const iterationDeps: IterationDeps = {
    evaluate: deps.evaluate,
    improve: deps.improve,
    checkThreshold: deps.checkThreshold,
    maxCycles: deps.maxCycles,
  };

  logger.info('Starting continuous batch', {
    briefId: brief.id,
    targetAccepted: deps.targetAccepted,
    batchSize: deps.batchSize,
    maxRounds: deps.maxRounds,
  });

  const emit = deps.onEvent ?? (() => {});

  while (accepted.length < deps.targetAccepted && round < deps.maxRounds) {
    round++;
    emit({ type: 'round:start', briefId: brief.id, round });

    const batch = await deps.generateBatch(brief, deps.batchSize, deps.patterns);
    totalGenerated += batch.length;

    // Emit generating events for each ad
    for (const ad of batch) {
      emit({ type: 'ad:generating', briefId: brief.id, round, ad });
    }

    // Process ads concurrently within each round
    const results = await Promise.all(
      batch.map((ad) => iterateAd(ad, iterationDeps, brief, emit)),
    );

    for (const result of results) {
      if (result.accepted) {
        emit({ type: 'ad:accepted', briefId: brief.id, round, adWithHistory: result });
        accepted.push(result);
        if (accepted.length >= deps.targetAccepted) break;
      } else {
        emit({ type: 'ad:rejected', briefId: brief.id, round, adWithHistory: result });
        rejected.push(result);
      }
    }

    logger.info('Round complete', {
      briefId: brief.id,
      round,
      accepted: accepted.length,
      rejected: rejected.length,
      totalGenerated,
    });
  }

  logger.info('Continuous batch complete', {
    briefId: brief.id,
    roundsUsed: round,
    accepted: accepted.length,
    rejected: rejected.length,
    totalGenerated,
  });

  return {
    briefId: brief.id,
    accepted,
    rejected,
    roundsUsed: round,
    totalGenerated,
  };
}
