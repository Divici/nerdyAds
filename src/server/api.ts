import express from 'express';
import cors from 'cors';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import type { PipelineEventCallback } from '../pipeline/batch-runner.js';
import type { Brief } from '../types/brief.js';
import type { CalibrationAnchor, FewShotExample } from '../config/prompts.js';
import { WriterAgent } from '../agents/writer.js';
import { loadCalibrationAnchors, loadWriterFewShotExamples } from '../utils/calibration-loader.js';
import { EvaluatorAgent } from '../agents/evaluator.js';
import { EditorAgent } from '../agents/editor.js';
import { QualityRatchet } from '../evaluate/threshold.js';
import { MetricsTracker } from '../metrics/tracker.js';
import { runContinuousBatch } from '../pipeline/batch-runner.js';
import { classifyFailure } from '../evaluate/failure-taxonomy.js';
import { saveSnapshot } from '../utils/snapshot.js';
import { logger } from '../utils/logger.js';
import { createTrace, withTrace, flush as flushLangfuse } from '../utils/langfuse.js';
import {
  MAX_CYCLES,
  TARGET_ACCEPTED_PER_BRIEF,
  BATCH_SIZE,
  MAX_GENERATION_ROUNDS,
} from '../config/thresholds.js';
import { randomUUID } from 'crypto';

const DATA_DIR = join(process.cwd(), 'data');
const OUTPUT_DIR = join(DATA_DIR, 'output');
const BRIEFS_PATH = join(DATA_DIR, 'briefs.json');

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Active SSE connections per runId
  const activeStreams = new Map<string, express.Response[]>();

  // ── GET /api/briefs ──────────────────────────────────────────
  app.get('/api/briefs', async (_req, res) => {
    try {
      const raw = await readFile(BRIEFS_PATH, 'utf-8');
      res.json(JSON.parse(raw));
    } catch (err) {
      res.status(500).json({ error: 'Failed to load briefs' });
    }
  });

  // ── GET /api/runs ────────────────────────────────────────────
  app.get('/api/runs', async (_req, res) => {
    try {
      const dirs = await readdir(OUTPUT_DIR);
      const runs = [];
      for (const dir of dirs) {
        try {
          const raw = await readFile(join(OUTPUT_DIR, dir, 'pipeline-result.json'), 'utf-8');
          const result = JSON.parse(raw);
          runs.push({
            runId: result.runId,
            startedAt: result.startedAt,
            completedAt: result.completedAt,
            totalAdsGenerated: result.totalAdsGenerated,
            totalAdsAccepted: result.totalAdsAccepted,
            totalAdsRejected: result.totalAdsRejected,
            acceptanceRate: result.acceptanceRate,
            averageScore: result.averageScore,
            totalCostUsd: result.totalCostUsd,
          });
        } catch {
          // Skip directories without valid pipeline results
        }
      }
      runs.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: 'Failed to list runs' });
    }
  });

  // ── GET /api/runs/:runId ─────────────────────────────────────
  app.get('/api/runs/:runId', async (req, res) => {
    try {
      const raw = await readFile(
        join(OUTPUT_DIR, req.params.runId, 'pipeline-result.json'),
        'utf-8',
      );
      res.json(JSON.parse(raw));
    } catch (err) {
      res.status(404).json({ error: 'Run not found' });
    }
  });

  // ── POST /api/generate ───────────────────────────────────────
  app.post('/api/generate', async (req, res) => {
    const { briefId } = req.body;
    const runId = randomUUID();

    try {
      const raw = await readFile(BRIEFS_PATH, 'utf-8');
      const allBriefs: Brief[] = JSON.parse(raw);

      const briefs = briefId
        ? allBriefs.filter((b) => b.id === briefId)
        : allBriefs;

      if (briefs.length === 0) {
        res.status(400).json({ error: `Brief ${briefId} not found` });
        return;
      }

      res.json({ runId, briefCount: briefs.length });

      // Run pipeline in background — events streamed via SSE
      runPipelineWithEvents(runId, briefs).catch((err) => {
        const stack = err instanceof Error ? err.stack : String(err);
        logger.error('Pipeline error', { runId, error: String(err), stack });
        sendSSE(runId, { type: 'pipeline:error', data: { error: String(err) } });
      });
    } catch (err) {
      res.status(500).json({ error: 'Failed to start generation' });
    }
  });

  // ── GET /api/generate/:runId/stream ──────────────────────────
  app.get('/api/generate/:runId/stream', (req, res) => {
    const { runId } = req.params;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');

    const streams = activeStreams.get(runId) ?? [];
    streams.push(res);
    activeStreams.set(runId, streams);

    req.on('close', () => {
      const remaining = (activeStreams.get(runId) ?? []).filter((s) => s !== res);
      if (remaining.length === 0) {
        activeStreams.delete(runId);
      } else {
        activeStreams.set(runId, remaining);
      }
    });
  });

  function sendSSE(runId: string, event: { type: string; data: unknown }) {
    const streams = activeStreams.get(runId) ?? [];
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
    for (const res of streams) {
      res.write(payload);
    }
  }

  async function runPipelineWithEvents(runId: string, briefs: Brief[]) {
    const startedAt = new Date().toISOString();
    const writer = new WriterAgent();
    const evaluator = new EvaluatorAgent();
    const editor = new EditorAgent();
    const ratchet = new QualityRatchet();
    const tracker = new MetricsTracker();

    // Load calibration anchors and few-shot examples from reference set
    let calibrationAnchors: CalibrationAnchor[] | undefined;
    let fewShotExamples: FewShotExample[] | undefined;
    try {
      calibrationAnchors = await loadCalibrationAnchors();
      fewShotExamples = await loadWriterFewShotExamples();
    } catch {
      // Calibration files optional — pipeline runs without them
      logger.warn('Could not load calibration anchors or few-shot examples');
    }

    const briefResults = [];

    for (const brief of briefs) {
      const onEvent: PipelineEventCallback = (event) => {
        sendSSE(runId, { type: event.type, data: { ...event } });
      };

      const briefTrace = createTrace({
        name: 'process-brief',
        metadata: { runId, briefId: brief.id, evalModel: 'pro', phase: 'ui-pipeline' },
        tags: ['pipeline', `brief:${brief.id}`, `run:${runId}`],
      });

      const batchResult = await withTrace(briefTrace, () =>
        runContinuousBatch(brief, {
          generateBatch: (b, count, patterns) =>
            writer.generateBatch(b, count, patterns, fewShotExamples),
          evaluate: (ad, b) => evaluator.evaluate(ad, b, calibrationAnchors),
          improve: (ad, evaluation, b) => editor.improve(ad, evaluation, b),
          checkThreshold: (score, dimensionScores) => {
            const passes = ratchet.check(score, dimensionScores);
            if (passes) ratchet.record(score);
            return passes;
          },
          maxCycles: MAX_CYCLES,
          patterns: undefined,
          targetAccepted: TARGET_ACCEPTED_PER_BRIEF,
          batchSize: BATCH_SIZE,
          maxRounds: MAX_GENERATION_ROUNDS,
          onEvent,
        }),
      );

      // Track metrics
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

      sendSSE(runId, {
        type: 'brief:complete',
        data: {
          briefId: brief.id,
          accepted: batchResult.accepted.length,
          rejected: batchResult.rejected.length,
          roundsUsed: batchResult.roundsUsed,
        },
      });
    }

    const summary = tracker.getSummary();
    const completedAt = new Date().toISOString();
    const totalRejected = summary.totalAdsGenerated - summary.totalAdsAccepted;
    const costPerAccepted =
      summary.totalAdsAccepted > 0 ? summary.totalCostUsd / summary.totalAdsAccepted : 0;

    const pipelineResult = {
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

    try {
      await saveSnapshot('data/output', runId, 'pipeline-result.json', pipelineResult);
    } catch (err) {
      logger.warn('Failed to save pipeline snapshot', { error: String(err) });
    }

    sendSSE(runId, { type: 'pipeline:complete', data: { result: pipelineResult } });
    await flushLangfuse();

    // Clean up streams after a delay
    setTimeout(() => activeStreams.delete(runId), 5000);
  }

  return app;
}
