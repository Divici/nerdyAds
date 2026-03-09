/**
 * Phase 7: Run the evaluator on calibration ads (strong/weak/borderline)
 * to verify the evaluator ranks them correctly.
 *
 * Expected: strong avg > borderline avg > weak avg
 *
 * Usage: npx tsx src/scripts/run-calibration.ts
 */
import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Ad } from '../types/ad.js';
import { EvaluatorAgent } from '../agents/evaluator.js';
import type { CalibrationAnchor } from '../config/prompts.js';
import type { Evaluation } from '../types/evaluation.js';

const CAL_DIR = path.resolve('data/calibration');
const OUTPUT_DIR = path.resolve('data/output/calibration');

interface CalibrationResult {
  tier: string;
  adId: string;
  weightedScore: number;
  confidence: string;
  scores: Record<string, number>;
}

async function loadAds(filename: string): Promise<Ad[]> {
  const raw = await readFile(path.join(CAL_DIR, filename), 'utf8');
  return JSON.parse(raw) as Ad[];
}

function buildAnchors(strong: Ad[], weak: Ad[]): CalibrationAnchor[] {
  return [
    {
      label: 'strong',
      primaryText: strong[0].primaryText,
      headline: strong[0].headline,
      expectedScoreRange: '8.5-10.0',
    },
    {
      label: 'weak',
      primaryText: weak[0].primaryText,
      headline: weak[0].headline,
      expectedScoreRange: '2.0-4.0',
    },
  ];
}

async function evaluateTier(
  tierName: string,
  ads: Ad[],
  evaluator: EvaluatorAgent,
  anchors: CalibrationAnchor[],
): Promise<{ results: CalibrationResult[]; evaluations: Evaluation[]; avgScore: number }> {
  const results: CalibrationResult[] = [];
  const evaluations: Evaluation[] = [];

  for (const ad of ads) {
    const evaluation = await evaluator.evaluate(ad, undefined, anchors);
    evaluations.push(evaluation);

    const scoreMap: Record<string, number> = {};
    for (const s of evaluation.scores) {
      scoreMap[s.dimension] = s.score;
    }

    results.push({
      tier: tierName,
      adId: ad.id,
      weightedScore: evaluation.weightedScore,
      confidence: evaluation.overallConfidence,
      scores: scoreMap,
    });

    console.log(
      `  ${ad.id}: ${evaluation.weightedScore.toFixed(2)} (${evaluation.overallConfidence}) — ` +
      `clarity=${scoreMap.clarity}, vp=${scoreMap.value_proposition}, emo=${scoreMap.emotional_resonance}, cta=${scoreMap.cta}, bv=${scoreMap.brand_voice}`,
    );
  }

  const avgScore = results.reduce((sum, r) => sum + r.weightedScore, 0) / results.length;
  return { results, evaluations, avgScore };
}

async function main() {
  console.log('=== Calibration Evaluation ===\n');

  const [strong, weak, borderline] = await Promise.all([
    loadAds('strong.json'),
    loadAds('weak.json'),
    loadAds('borderline.json'),
  ]);

  console.log(`Loaded: ${strong.length} strong, ${borderline.length} borderline, ${weak.length} weak\n`);

  const evaluator = new EvaluatorAgent();
  const anchors = buildAnchors(strong, weak);

  console.log('--- Evaluating STRONG tier ---');
  const strongResult = await evaluateTier('strong', strong, evaluator, anchors);

  console.log('\n--- Evaluating BORDERLINE tier ---');
  const borderlineResult = await evaluateTier('borderline', borderline, evaluator, anchors);

  console.log('\n--- Evaluating WEAK tier ---');
  const weakResult = await evaluateTier('weak', weak, evaluator, anchors);

  // Summary
  console.log('\n=== CALIBRATION SUMMARY ===');
  console.log(`Strong avg:     ${strongResult.avgScore.toFixed(2)}`);
  console.log(`Borderline avg: ${borderlineResult.avgScore.toFixed(2)}`);
  console.log(`Weak avg:       ${weakResult.avgScore.toFixed(2)}`);

  const rankingCorrect =
    strongResult.avgScore > borderlineResult.avgScore &&
    borderlineResult.avgScore > weakResult.avgScore;

  console.log(`\nRanking correct (strong > borderline > weak): ${rankingCorrect ? 'YES ✓' : 'NO ✗'}`);

  if (!rankingCorrect) {
    console.log('\nWARNING: Calibration ranking is incorrect. Prompts or calibration ads may need tuning.');
  }

  // Cost summary
  const allEvals = [...strongResult.evaluations, ...borderlineResult.evaluations, ...weakResult.evaluations];
  const totalCost = allEvals.reduce((sum, e) => sum + e.metadata.costUsd, 0);
  const totalTokensIn = allEvals.reduce((sum, e) => sum + e.metadata.tokensIn, 0);
  const totalTokensOut = allEvals.reduce((sum, e) => sum + e.metadata.tokensOut, 0);

  console.log(`\nTotal cost: $${totalCost.toFixed(4)}`);
  console.log(`Total tokens: ${totalTokensIn} in, ${totalTokensOut} out`);

  // Save results
  await mkdir(OUTPUT_DIR, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    rankingCorrect,
    tiers: {
      strong: { avgScore: strongResult.avgScore, results: strongResult.results },
      borderline: { avgScore: borderlineResult.avgScore, results: borderlineResult.results },
      weak: { avgScore: weakResult.avgScore, results: weakResult.results },
    },
    cost: { totalCost, totalTokensIn, totalTokensOut },
  };

  await writeFile(path.join(OUTPUT_DIR, 'calibration-report.json'), JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${OUTPUT_DIR}/calibration-report.json`);
}

main().catch((err) => {
  console.error('Calibration failed:', err);
  process.exit(1);
});
