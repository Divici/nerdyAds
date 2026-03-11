import type { Ad } from '../types/ad.js';
import type { Evaluation, DimensionScore } from '../types/evaluation.js';
import type { Brief } from '../types/brief.js';
import type { AdWithHistory } from '../types/pipeline.js';
import type { PipelineEventCallback } from './batch-runner.js';
import { logger } from '../utils/logger.js';

/** Dependency injection interface for testability. */
export interface IterationDeps {
  evaluate: (ad: Ad, brief?: Brief) => Promise<Evaluation>;
  improve: (ad: Ad, evaluation: Evaluation, brief?: Brief) => Promise<Ad>;
  checkThreshold: (score: number, dimensionScores?: DimensionScore[]) => boolean;
  maxCycles: number;
}

/**
 * Run the evaluate → improve loop for a single ad.
 * Returns the final ad state with full evaluation history.
 */
export async function iterateAd(
  ad: Ad,
  deps: IterationDeps,
  brief?: Brief,
  onEvent?: PipelineEventCallback,
): Promise<AdWithHistory> {
  const evaluations: Evaluation[] = [];
  const adVersions: Ad[] = [];
  let currentAd = ad;
  let cyclesUsed = 0;
  const emit = onEvent ?? (() => {});
  const briefId = brief?.id ?? 'unknown';

  // Initial evaluation
  adVersions.push(currentAd);
  emit({ type: 'ad:evaluating', briefId, ad: currentAd });
  const firstEval = await deps.evaluate(currentAd, brief);
  evaluations.push(firstEval);

  if (deps.checkThreshold(firstEval.weightedScore, firstEval.scores)) {
    logger.info('Ad accepted on first evaluation', {
      adId: currentAd.id,
      score: firstEval.weightedScore,
    });
    return { ad: currentAd, evaluations, accepted: true, cyclesUsed: 0, adVersions };
  }

  // Improvement cycles
  for (let cycle = 0; cycle < deps.maxCycles; cycle++) {
    const lastEval = evaluations[evaluations.length - 1];
    emit({ type: 'ad:improving', briefId, ad: currentAd, evaluation: lastEval, cycle: cycle + 1 });
    currentAd = await deps.improve(currentAd, lastEval, brief);
    adVersions.push(currentAd);
    cyclesUsed++;

    emit({ type: 'ad:evaluating', briefId, ad: currentAd, cycle: cycle + 1 });
    const evaluation = await deps.evaluate(currentAd, brief);
    evaluations.push(evaluation);

    if (deps.checkThreshold(evaluation.weightedScore, evaluation.scores)) {
      logger.info('Ad accepted after improvement', {
        adId: currentAd.id,
        score: evaluation.weightedScore,
        cyclesUsed,
      });
      return { ad: currentAd, evaluations, accepted: true, cyclesUsed, adVersions };
    }
  }

  logger.warn('Ad rejected after max cycles', {
    adId: currentAd.id,
    finalScore: evaluations[evaluations.length - 1].weightedScore,
    cyclesUsed,
  });

  return { ad: currentAd, evaluations, accepted: false, cyclesUsed, adVersions };
}
