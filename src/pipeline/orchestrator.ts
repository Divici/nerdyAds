import { randomUUID } from 'crypto';
import type { Brief } from '../types/brief.js';
import type { PipelineResult, BriefResult } from '../types/pipeline.js';
import type { CompetitorPattern } from '../types/patterns.js';
import { WriterAgent } from '../agents/writer.js';
import { EvaluatorAgent } from '../agents/evaluator.js';
import type { ModelRole } from '../utils/gemini-client.js';
import { EditorAgent } from '../agents/editor.js';
import { QualityRatchet } from '../evaluate/threshold.js';
import { MetricsTracker } from '../metrics/tracker.js';
import { runContinuousBatch, type ContinuousBatchResult } from './batch-runner.js';
import { classifyFailure } from '../evaluate/failure-taxonomy.js';
import { saveSnapshot } from '../utils/snapshot.js';
import { logger } from '../utils/logger.js';
import { createTrace, withTrace, flush as flushLangfuse } from '../utils/langfuse.js';
import { MAX_CYCLES, TARGET_ACCEPTED_PER_BRIEF, BATCH_SIZE, MAX_GENERATION_ROUNDS } from '../config/thresholds.js';
import type { CalibrationAnchor, FewShotExample } from '../config/prompts.js';

export interface OrchestratorOptions {
  /** Competitor patterns from the researcher agent. */
  patterns?: CompetitorPattern;
  /** Base directory for saving snapshots (default: 'data/output'). */
  outputDir?: string;
  /** Override default run ID (useful for reproducibility). */
  runId?: string;
  /** Override base quality threshold (default: 7.5 from config). */
  threshold?: number;
  /** Model for the evaluator agent (default: 'flash'). */
  evalModel?: ModelRole;
  /** Calibration anchors for the evaluator (strong/weak/borderline examples). */
  calibrationAnchors?: CalibrationAnchor[];
  /** Few-shot examples for the writer prompt. */
  fewShotExamples?: FewShotExample[];
}

/**
 * Process a single brief through the continuous batch pipeline.
 */
export async function processBrief(
  brief: Brief,
  options: OrchestratorOptions = {},
): Promise<ContinuousBatchResult> {
  const trace = createTrace({
    name: 'process-brief',
    metadata: {
      runId: options.runId,
      briefId: brief.id,
      evalModel: options.evalModel ?? 'flash',
    },
    tags: ['pipeline', `brief:${brief.id}`],
  });

  const writer = new WriterAgent();
  const evaluator = new EvaluatorAgent(options.evalModel);
  const editor = new EditorAgent();
  const ratchet = new QualityRatchet(options.threshold);

  const result = await withTrace(trace, () =>
    runContinuousBatch(brief, {
      generateBatch: (b, count, patterns) =>
        writer.generateBatch(b, count, patterns, options.fewShotExamples),
      evaluate: (ad, b) => evaluator.evaluate(ad, b, options.calibrationAnchors),
      improve: (ad, evaluation, b) => editor.improve(ad, evaluation, b),
      checkThreshold: (score, dimensionScores) => {
        const passes = ratchet.check(score, dimensionScores);
        if (passes) ratchet.record(score);
        return passes;
      },
      maxCycles: MAX_CYCLES,
      patterns: options.patterns,
      targetAccepted: TARGET_ACCEPTED_PER_BRIEF,
      batchSize: BATCH_SIZE,
      maxRounds: MAX_GENERATION_ROUNDS,
    }),
  );

  return result;
}

/**
 * Process all briefs through the continuous batch pipeline,
 * tracking metrics and saving snapshots.
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

  const briefResults: BriefResult[] = [];

  for (const brief of briefs) {
    const briefTrace = createTrace({
      name: 'process-brief',
      metadata: {
        runId,
        briefId: brief.id,
        evalModel: options.evalModel ?? 'flash',
        phase: 'pipeline',
      },
      tags: ['pipeline', `brief:${brief.id}`, `run:${runId}`],
    });

    const batchResult = await withTrace(briefTrace, () =>
      runContinuousBatch(brief, {
        generateBatch: (b, count, patterns) =>
          writer.generateBatch(b, count, patterns, options.fewShotExamples),
        evaluate: (ad, b) => evaluator.evaluate(ad, b, options.calibrationAnchors),
        improve: (ad, evaluation, b) => editor.improve(ad, evaluation, b),
        checkThreshold: (score, dimensionScores) => {
          const passes = ratchet.check(score, dimensionScores);
          if (passes) ratchet.record(score);
          return passes;
        },
        maxCycles: MAX_CYCLES,
        patterns: options.patterns,
        targetAccepted: TARGET_ACCEPTED_PER_BRIEF,
        batchSize: BATCH_SIZE,
        maxRounds: MAX_GENERATION_ROUNDS,
      }),
    );

    // Record metrics for all ads (accepted + rejected)
    const allAds = [...batchResult.accepted, ...batchResult.rejected];
    for (const adHistory of allAds) {
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
      ads: batchResult.accepted,
      rejected: batchResult.rejected,
      roundsUsed: batchResult.roundsUsed,
      metrics: batchMetrics,
    });
  }

  const summary = tracker.getSummary();
  const completedAt = new Date().toISOString();

  const totalRejected = summary.totalAdsGenerated - summary.totalAdsAccepted;
  const costPerAccepted = summary.totalAdsAccepted > 0
    ? summary.totalCostUsd / summary.totalAdsAccepted
    : 0;

  const pipelineResult: PipelineResult = {
    runId,
    startedAt,
    completedAt,
    briefs: briefResults,
    totalAdsGenerated: summary.totalAdsGenerated,
    totalAdsAccepted: summary.totalAdsAccepted,
    totalAdsRejected: totalRejected,
    acceptanceRate: summary.acceptanceRate,
    averageScore: summary.averageScore,
    costPerAcceptedAd: costPerAccepted,
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
    totalAdsRejected: totalRejected,
    acceptanceRate: summary.acceptanceRate.toFixed(2),
    averageScore: summary.averageScore.toFixed(2),
    costPerAcceptedAd: costPerAccepted.toFixed(4),
    totalCostUsd: summary.totalCostUsd.toFixed(4),
  });

  // Flush Langfuse traces
  await flushLangfuse();

  return pipelineResult;
}
