import { randomUUID } from 'crypto';
import type { Brief } from '../types/brief.js';
import type { PipelineResult } from '../types/pipeline.js';
import type { CompetitorPattern } from '../types/patterns.js';
import { WriterAgent } from '../agents/writer.js';
import { EvaluatorAgent } from '../agents/evaluator.js';
import type { ModelRole } from '../utils/gemini-client.js';
import { EditorAgent } from '../agents/editor.js';
import { QualityRatchet } from '../evaluate/threshold.js';
import { MetricsTracker } from '../metrics/tracker.js';
import { runBatch, type BatchResult } from './batch-runner.js';
import { classifyFailure } from '../evaluate/failure-taxonomy.js';
import { saveSnapshot } from '../utils/snapshot.js';
import { logger } from '../utils/logger.js';
import { MAX_CYCLES } from '../config/thresholds.js';

export interface OrchestratorOptions {
  /** Number of ads per brief (default: 5). */
  adsPerBrief?: number;
  /** Competitor patterns from the researcher agent. */
  patterns?: CompetitorPattern;
  /** Base directory for saving snapshots (default: 'data/output'). */
  outputDir?: string;
  /** Override default run ID (useful for reproducibility). */
  runId?: string;
  /** Override base quality threshold (default: 7.0 from config). */
  threshold?: number;
  /** Model for the evaluator agent (default: 'pro'). */
  evalModel?: ModelRole;
}

/**
 * Process a single brief through the full pipeline.
 */
export async function processBrief(
  brief: Brief,
  options: OrchestratorOptions = {},
): Promise<BatchResult> {
  const writer = new WriterAgent();
  const evaluator = new EvaluatorAgent(options.evalModel);
  const editor = new EditorAgent();
  const ratchet = new QualityRatchet(options.threshold);

  const result = await runBatch(brief, options.adsPerBrief ?? 5, {
    generateBatch: (b, count, patterns) => writer.generateBatch(b, count, patterns),
    evaluate: (ad, b) => evaluator.evaluate(ad, b),
    improve: (ad, evaluation, b) => editor.improve(ad, evaluation, b),
    checkThreshold: (score, dimensionScores) => {
      const passes = ratchet.check(score, dimensionScores);
      if (passes) ratchet.record(score);
      return passes;
    },
    maxCycles: MAX_CYCLES,
  }, options.patterns);

  return result;
}

/**
 * Process all briefs through the full pipeline, tracking metrics and saving snapshots.
 */
export async function processAllBriefs(
  briefs: Brief[],
  options: OrchestratorOptions = {},
): Promise<PipelineResult> {
  const runId = options.runId ?? randomUUID();
  const startedAt = new Date().toISOString();
  const outputDir = options.outputDir ?? 'data/output';

  const writer = new WriterAgent();
  const evaluator = new EvaluatorAgent(options.evalModel);
  const editor = new EditorAgent();
  const ratchet = new QualityRatchet(options.threshold);
  const tracker = new MetricsTracker();

  logger.info('Pipeline starting', { runId, briefCount: briefs.length });

  const briefResults: PipelineResult['briefs'] = [];

  for (const brief of briefs) {
    const batchResult = await runBatch(brief, options.adsPerBrief ?? 5, {
      generateBatch: (b, count, patterns) => writer.generateBatch(b, count, patterns),
      evaluate: (ad, b) => evaluator.evaluate(ad, b),
      improve: (ad, evaluation, b) => editor.improve(ad, evaluation, b),
      checkThreshold: (score) => {
        const passes = ratchet.check(score);
        if (passes) ratchet.record(score);
        return passes;
      },
      maxCycles: MAX_CYCLES,
    }, options.patterns);

    // Record metrics for each ad
    for (const adHistory of batchResult.ads) {
      const lastEval = adHistory.evaluations[adHistory.evaluations.length - 1];
      const totalCost = adHistory.evaluations.reduce(
        (sum, e) => sum + e.metadata.costUsd,
        adHistory.ad.metadata.costUsd,
      );
      const totalTokensIn = adHistory.evaluations.reduce(
        (sum, e) => sum + e.metadata.tokensIn,
        adHistory.ad.metadata.tokensIn,
      );
      const totalTokensOut = adHistory.evaluations.reduce(
        (sum, e) => sum + e.metadata.tokensOut,
        adHistory.ad.metadata.tokensOut,
      );

      tracker.recordAd({
        accepted: adHistory.accepted,
        score: lastEval.weightedScore,
        costUsd: totalCost,
        tokensIn: totalTokensIn,
        tokensOut: totalTokensOut,
        briefId: brief.id,
      });

      if (!adHistory.accepted) {
        const failure = classifyFailure(lastEval.scores);
        tracker.recordFailure(failure.label);
      }
    }

    const batchMetrics = tracker.getBatchMetrics(brief.id);
    briefResults.push({
      briefId: brief.id,
      ads: batchResult.ads,
      metrics: batchMetrics,
    });
  }

  const summary = tracker.getSummary();
  const completedAt = new Date().toISOString();

  const pipelineResult: PipelineResult = {
    runId,
    startedAt,
    completedAt,
    briefs: briefResults,
    totalAdsGenerated: summary.totalAdsGenerated,
    totalAdsAccepted: summary.totalAdsAccepted,
    acceptanceRate: summary.acceptanceRate,
    averageScore: summary.averageScore,
    totalCostUsd: summary.totalCostUsd,
    totalTokensIn: summary.totalTokensIn,
    totalTokensOut: summary.totalTokensOut,
  };

  // Save snapshot
  try {
    await saveSnapshot(outputDir, runId, 'pipeline-result.json', pipelineResult);
    logger.info('Pipeline result saved', { runId, outputDir });
  } catch (err) {
    logger.warn('Failed to save pipeline snapshot', { error: String(err) });
  }

  logger.info('Pipeline complete', {
    runId,
    totalAdsGenerated: summary.totalAdsGenerated,
    totalAdsAccepted: summary.totalAdsAccepted,
    acceptanceRate: summary.acceptanceRate.toFixed(2),
    averageScore: summary.averageScore.toFixed(2),
    totalCostUsd: summary.totalCostUsd.toFixed(4),
  });

  return pipelineResult;
}
