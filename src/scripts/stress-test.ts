/**
 * Stress test: Run adversarial briefs + normal briefs at threshold 9.0
 * with a stricter evaluator to force editor iterations and show growth.
 *
 * Usage: npx tsx src/scripts/stress-test.ts [--briefs=N] [--ads=N]
 */
import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'crypto';
import type { Brief } from '../types/brief.js';
import type { CompetitorPattern } from '../types/patterns.js';
import type { Ad } from '../types/ad.js';
import type { Evaluation, DimensionScore } from '../types/evaluation.js';
import type { AdWithHistory, PipelineResult } from '../types/pipeline.js';
import { WriterAgent } from '../agents/writer.js';
import { EvaluatorAgent } from '../agents/evaluator.js';
import { EditorAgent } from '../agents/editor.js';
import { QualityRatchet } from '../evaluate/threshold.js';
import { MetricsTracker } from '../metrics/tracker.js';
import { runBatch } from '../pipeline/batch-runner.js';
import { classifyFailure } from '../evaluate/failure-taxonomy.js';
import { saveSnapshot } from '../utils/snapshot.js';
import { logger } from '../utils/logger.js';
import { MAX_CYCLES } from '../config/thresholds.js';
import { EVALUATOR_SYSTEM_PROMPT, buildEvaluatorUserPrompt } from '../config/prompts.js';
import { callGemini } from '../utils/gemini-client.js';
import { computeWeightedScore, computeConfidence } from '../evaluate/scoring.js';
import { z } from 'zod';
import { DimensionScoreSchema } from '../types/evaluation.js';

const STRICT_THRESHOLD = 9.0;

/**
 * Strict evaluator: wraps the normal evaluator with a tougher system prompt
 * that penalizes generic copy and enforces constraint checking.
 */
const STRICT_EVALUATOR_ADDENDUM = `

## STRICT MODE — Apply These Additional Standards

You are evaluating in STRICT mode. Apply these additional scoring penalties:

1. **Generic copy penalty**: If the ad could work for ANY test prep company by swapping the brand name, cap the clarity and value_proposition scores at 7. Varsity Tutors ads must have brand-specific differentiators.

2. **Constraint compliance**: The ad was written against a brief with specific constraints. If ANY constraint is violated, cap the most relevant dimension at 6. Note which constraint was violated in the rationale.

3. **Cliché penalty**: Deduct 1-2 points from emotional_resonance for overused phrases like "unlock your potential", "take the first step", "journey to success", "don't miss out", "act now", "your future starts here".

4. **CTA strictness**: Generic "Learn More" CTAs with no urgency or specificity get max 6 on CTA. The CTA must feel earned by the copy above it.

5. **Score distribution**: In strict mode, most ads should score 6-8. Scores of 9+ should be rare and genuinely exceptional. If you're giving 9s easily, you're being too lenient.

6. **Brief alignment**: Check that the emotional angle ACTUALLY matches the brief. An "anxiety" brief with aspirational copy is a mismatch — cap emotional_resonance at 5.`;

class StrictEvaluator {
  private responseSchema = z.object({
    scores: z.array(DimensionScoreSchema).length(5),
  });

  async evaluate(ad: Ad, brief?: Brief): Promise<Evaluation> {
    // Build the brief context for constraint checking
    const constraintNote = brief?.constraints?.length
      ? `\n\n## Brief Constraints (MUST check compliance)\n${brief.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}`
      : '';

    const userPrompt = buildEvaluatorUserPrompt(
      {
        primaryText: ad.primaryText,
        headline: ad.headline,
        description: ad.description,
        ctaButton: ad.ctaButton,
      },
      brief
        ? {
            targetAudience: brief.targetAudience,
            campaignGoal: brief.campaignGoal,
            emotionalAngle: brief.emotionalAngle,
            offer: brief.offer,
          }
        : undefined,
    ) + constraintNote;

    const result = await callGemini(
      'pro',
      EVALUATOR_SYSTEM_PROMPT + STRICT_EVALUATOR_ADDENDUM,
      userPrompt,
      { jsonMode: true },
    );

    const parsed = this.parseResponse(result.text);
    const weightedScore = computeWeightedScore(parsed.scores);
    const overallConfidence = computeConfidence(parsed.scores);

    const evaluation: Evaluation = {
      adId: ad.id,
      scores: parsed.scores,
      weightedScore,
      overallConfidence,
      metadata: {
        model: result.model,
        seed: result.seed,
        promptHash: result.promptHash,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: result.costUsd,
        generatedAt: result.generatedAt,
      },
    };

    logger.info('Strict evaluation complete', {
      adId: ad.id,
      weightedScore,
      overallConfidence,
      scores: parsed.scores.map((s) => `${s.dimension}:${s.score}`).join(', '),
    });

    return evaluation;
  }

  private parseResponse(text: string): { scores: DimensionScore[] } {
    const json = JSON.parse(text);
    const result = this.responseSchema.safeParse(json);
    if (!result.success) {
      throw new Error(`Strict evaluator response failed validation: ${result.error.issues.map((i) => i.message).join(', ')}`);
    }
    return result.data;
  }
}

function parseArgInt(name: string, defaultVal: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) {
    const val = parseInt(arg.split('=')[1], 10);
    return isNaN(val) ? defaultVal : val;
  }
  return defaultVal;
}

async function main() {
  const normalBriefCount = parseArgInt('briefs', 2);
  const adsPerBrief = parseArgInt('ads', 3);
  const runId = randomUUID();
  const outputDir = 'data/output';

  console.log('=== nerdyAds STRESS TEST ===\n');
  console.log(`Threshold: ${STRICT_THRESHOLD} (strict evaluator)`);
  console.log(`Ads per brief: ${adsPerBrief}`);
  console.log(`Max editor cycles: ${MAX_CYCLES}\n`);

  // Load adversarial briefs
  const rawAdv = await readFile(path.resolve('data/adversarial-briefs.json'), 'utf8');
  const advBriefs: Brief[] = JSON.parse(rawAdv);

  // Load normal briefs (subset)
  const rawNormal = await readFile(path.resolve('data/briefs.json'), 'utf8');
  const allNormal: Brief[] = JSON.parse(rawNormal);
  const normalBriefs = allNormal.slice(0, normalBriefCount);

  const allBriefs = [...advBriefs, ...normalBriefs];
  console.log(`Adversarial briefs: ${advBriefs.map((b) => b.id).join(', ')}`);
  console.log(`Normal briefs: ${normalBriefs.map((b) => b.id).join(', ')}`);
  console.log(`Total: ${allBriefs.length} briefs, ${allBriefs.length * adsPerBrief} ads expected\n`);

  // Load patterns
  let patterns: CompetitorPattern | undefined;
  try {
    const rawPatterns = await readFile(path.resolve('data/reference/patterns.json'), 'utf8');
    const cached = JSON.parse(rawPatterns);
    patterns = cached.pattern ?? cached;
    console.log('Loaded competitor patterns\n');
  } catch {
    console.log('No patterns available\n');
  }

  // Set up agents
  const writer = new WriterAgent();
  const strictEvaluator = new StrictEvaluator();
  const editor = new EditorAgent();
  const ratchet = new QualityRatchet(STRICT_THRESHOLD);
  const tracker = new MetricsTracker();

  const briefResults: PipelineResult['briefs'] = [];

  // Track growth data
  const growthLog: Array<{
    briefId: string;
    adId: string;
    initialScore: number;
    finalScore: number;
    cyclesUsed: number;
    accepted: boolean;
    scorePath: number[];
    weakestDimensions: string[];
  }> = [];

  for (const brief of allBriefs) {
    console.log(`\n--- Processing ${brief.id} (${brief.emotionalAngle}) ---`);
    if (brief.constraints?.length) {
      console.log(`  Constraints: ${brief.constraints.join(' | ')}`);
    }

    const batchResult = await runBatch(brief, adsPerBrief, {
      generateBatch: (b, count, p) => writer.generateBatch(b, count, p),
      evaluate: (ad, b) => strictEvaluator.evaluate(ad, b),
      improve: (ad, evaluation, b) => editor.improve(ad, evaluation, b),
      checkThreshold: (score, dimensionScores) => {
        const passes = ratchet.check(score, dimensionScores);
        if (passes) ratchet.record(score);
        return passes;
      },
      maxCycles: MAX_CYCLES,
    }, patterns);

    for (const adHistory of batchResult.ads) {
      const lastEval = adHistory.evaluations[adHistory.evaluations.length - 1];
      const firstEval = adHistory.evaluations[0];
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

      // Track growth
      growthLog.push({
        briefId: brief.id,
        adId: adHistory.ad.id,
        initialScore: firstEval.weightedScore,
        finalScore: lastEval.weightedScore,
        cyclesUsed: adHistory.cyclesUsed,
        accepted: adHistory.accepted,
        scorePath: adHistory.evaluations.map((e) => e.weightedScore),
        weakestDimensions: adHistory.evaluations.map((e) => {
          let weakest = e.scores[0];
          for (const s of e.scores) {
            if (s.score < weakest.score) weakest = s;
          }
          return weakest.dimension;
        }),
      });

      // Print per-ad growth
      const delta = lastEval.weightedScore - firstEval.weightedScore;
      const deltaStr = delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
      const status = adHistory.accepted ? 'ACCEPTED' : 'REJECTED';
      const path_ = adHistory.evaluations.map((e) => e.weightedScore.toFixed(1)).join(' → ');
      console.log(
        `  ${adHistory.ad.id.slice(0, 8)}: ${path_} [${status}] (${adHistory.cyclesUsed} cycles, ${deltaStr})`,
      );
    }

    const batchMetrics = tracker.getBatchMetrics(brief.id);
    briefResults.push({
      briefId: brief.id,
      ads: batchResult.ads,
      metrics: batchMetrics,
    });
  }

  // Summary
  const summary = tracker.getSummary();
  const completedAt = new Date().toISOString();

  console.log('\n\n=== STRESS TEST RESULTS ===');
  console.log(`Run ID: ${runId}`);
  console.log(`Threshold: ${STRICT_THRESHOLD} (strict evaluator)`);
  console.log(`Total ads generated: ${summary.totalAdsGenerated}`);
  console.log(`Total ads accepted:  ${summary.totalAdsAccepted}`);
  console.log(`Acceptance rate:     ${(summary.acceptanceRate * 100).toFixed(1)}%`);
  console.log(`Average score:       ${summary.averageScore.toFixed(2)}`);
  console.log(`Total cost:          $${summary.totalCostUsd.toFixed(4)}`);

  // Growth analysis
  const adsWithEdits = growthLog.filter((g) => g.cyclesUsed > 0);
  const adsImproved = adsWithEdits.filter((g) => g.finalScore > g.initialScore);
  const avgImprovement = adsWithEdits.length > 0
    ? adsWithEdits.reduce((sum, g) => sum + (g.finalScore - g.initialScore), 0) / adsWithEdits.length
    : 0;

  console.log('\n--- Growth Analysis ---');
  console.log(`Ads that needed editing:   ${adsWithEdits.length}/${growthLog.length}`);
  console.log(`Ads that improved:         ${adsImproved.length}/${adsWithEdits.length}`);
  console.log(`Average improvement:       ${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(2)} points`);
  console.log(`Ads accepted after edits:  ${adsWithEdits.filter((g) => g.accepted).length}/${adsWithEdits.length}`);
  console.log(`Ads accepted first try:    ${growthLog.filter((g) => g.cyclesUsed === 0).length}/${growthLog.length}`);

  // Weakest dimensions
  const dimCounts: Record<string, number> = {};
  for (const g of growthLog) {
    const dim = g.weakestDimensions[0]; // initial weakest
    dimCounts[dim] = (dimCounts[dim] ?? 0) + 1;
  }
  console.log('\nMost common initial weakest dimension:');
  const sorted = Object.entries(dimCounts).sort((a, b) => b[1] - a[1]);
  for (const [dim, count] of sorted) {
    console.log(`  ${dim}: ${count}/${growthLog.length}`);
  }

  // Per-brief breakdown
  console.log('\n--- Per-Brief Breakdown ---');
  for (const briefResult of briefResults) {
    const accepted = briefResult.ads?.filter((a) => a.accepted).length ?? 0;
    const total = briefResult.ads?.length ?? 0;
    const avgScore = briefResult.metrics?.averageScore ?? 0;
    const isAdversarial = briefResult.briefId.startsWith('adv-');
    const tag = isAdversarial ? '[ADV]' : '[STD]';
    console.log(
      `  ${tag} ${briefResult.briefId}: ${accepted}/${total} accepted, avg ${avgScore.toFixed(2)}`,
    );
  }

  // Save results
  const pipelineResult: PipelineResult = {
    runId,
    startedAt: new Date(Date.now() - 1).toISOString(),
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

  try {
    await saveSnapshot(outputDir, runId, 'pipeline-result.json', pipelineResult);
    await saveSnapshot(outputDir, runId, 'growth-log.json', growthLog);
    console.log(`\nResults saved to data/output/${runId}/`);
  } catch (err) {
    console.error('Failed to save:', err);
  }
}

main().catch((err) => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
