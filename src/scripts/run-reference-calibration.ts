/**
 * Phase 8.5 Step 2: Run the evaluator against all 16 reference set ads
 * and validate tier ranking (strong > medium > weak).
 *
 * Validation criteria:
 *   1. strong avg > medium avg > weak avg
 *   2. Tier gaps ≥ 1.0 points
 *   3. No strong ad scores below any weak ad
 *
 * Usage:
 *   npx tsx src/scripts/run-reference-calibration.ts [--eval-model=flash|pro]
 */
import 'dotenv/config';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { EvaluatorAgent } from '../agents/evaluator.js';
import type { CalibrationAnchor } from '../config/prompts.js';
import type { Evaluation } from '../types/evaluation.js';
import type { ModelRole } from '../utils/gemini-client.js';

const REF_SET_PATH = path.resolve('data/reference/reference-set.json');
const OUTPUT_DIR = path.resolve('data/output/reference-calibration');

interface ReferenceAd {
  id: string;
  copy_tier: 'strong' | 'medium' | 'weak';
  tier_rationale: string;
  source: string;
  days_active: number | null;
  primary_text: string;
  headline: string;
  description: string;
  cta_button: string;
  target_audience: string;
}

interface ScoredAd {
  id: string;
  tier: string;
  weightedScore: number;
  confidence: string;
  scores: Record<string, number>;
  rationales: Record<string, string>;
}

function parseArgs(): { evalModel: ModelRole } {
  const modelArg = process.argv.find((a) => a.startsWith('--eval-model='));
  const evalModel = (modelArg?.split('=')[1] ?? 'flash') as ModelRole;
  return { evalModel };
}

async function main() {
  const { evalModel } = parseArgs();
  console.log(`=== Reference Set Calibration (eval-model: ${evalModel}) ===\n`);

  // Load reference set
  const raw = await readFile(REF_SET_PATH, 'utf8');
  const refAds: ReferenceAd[] = JSON.parse(raw);

  // Group by tier
  const tiers: Record<string, ReferenceAd[]> = { strong: [], medium: [], weak: [] };
  for (const ad of refAds) {
    tiers[ad.copy_tier].push(ad);
  }

  console.log(
    `Loaded: ${tiers.strong.length} strong, ${tiers.medium.length} medium, ${tiers.weak.length} weak\n`,
  );

  // Build calibration anchors from the top strong and bottom weak ads
  const anchors: CalibrationAnchor[] = [
    {
      label: 'strong',
      primaryText: tiers.strong[0].primary_text,
      headline: tiers.strong[0].headline,
      expectedScoreRange: '8.5-10',
    },
    {
      label: 'weak',
      primaryText: tiers.weak[tiers.weak.length - 1].primary_text || '(no copy)',
      headline: tiers.weak[tiers.weak.length - 1].headline,
      expectedScoreRange: '2.0-4.0',
    },
  ];

  const evaluator = new EvaluatorAgent(evalModel);
  const allScored: ScoredAd[] = [];
  const allEvals: Evaluation[] = [];

  // Evaluate each tier
  for (const tierName of ['strong', 'medium', 'weak'] as const) {
    console.log(`--- Evaluating ${tierName.toUpperCase()} tier ---`);
    for (const refAd of tiers[tierName]) {
      // Map reference ad to evaluator-compatible format
      const adForEval = {
        id: refAd.id,
        briefId: 'reference-calibration',
        primaryText: refAd.primary_text || '(no copy)',
        headline: refAd.headline,
        description: refAd.description || '',
        ctaButton: refAd.cta_button,
        version: 0,
        metadata: {
          model: 'reference',
          seed: 0,
          promptHash: '',
          tokensIn: 0,
          tokensOut: 0,
          costUsd: 0,
          generatedAt: new Date().toISOString(),
        },
      };

      const evaluation = await evaluator.evaluate(adForEval, undefined, anchors);
      allEvals.push(evaluation);

      const scoreMap: Record<string, number> = {};
      const rationaleMap: Record<string, string> = {};
      for (const s of evaluation.scores) {
        scoreMap[s.dimension] = s.score;
        rationaleMap[s.dimension] = s.rationale;
      }

      const scored: ScoredAd = {
        id: refAd.id,
        tier: tierName,
        weightedScore: evaluation.weightedScore,
        confidence: evaluation.overallConfidence,
        scores: scoreMap,
        rationales: rationaleMap,
      };
      allScored.push(scored);

      console.log(
        `  ${refAd.id}: ${evaluation.weightedScore.toFixed(2)} (${evaluation.overallConfidence}) — ` +
          `clarity=${scoreMap.clarity}, vp=${scoreMap.value_proposition}, emo=${scoreMap.emotional_resonance}, ` +
          `cta=${scoreMap.cta}, bv=${scoreMap.brand_voice}`,
      );
    }
    console.log();
  }

  // Compute tier averages
  const tierAvg = (tier: string) => {
    const items = allScored.filter((s) => s.tier === tier);
    return items.reduce((sum, s) => sum + s.weightedScore, 0) / items.length;
  };

  const strongAvg = tierAvg('strong');
  const mediumAvg = tierAvg('medium');
  const weakAvg = tierAvg('weak');

  // Validation checks
  const strongScores = allScored.filter((s) => s.tier === 'strong').map((s) => s.weightedScore);
  const weakScores = allScored.filter((s) => s.tier === 'weak').map((s) => s.weightedScore);
  const minStrong = Math.min(...strongScores);
  const maxWeak = Math.max(...weakScores);

  const rankingCorrect = strongAvg > mediumAvg && mediumAvg > weakAvg;
  const strongMediumGap = strongAvg - mediumAvg;
  const mediumWeakGap = mediumAvg - weakAvg;
  const gapsOk = strongMediumGap >= 1.0 && mediumWeakGap >= 1.0;
  const noCrossover = minStrong > maxWeak;

  // Summary
  console.log('=== REFERENCE CALIBRATION SUMMARY ===');
  console.log(`Strong avg:  ${strongAvg.toFixed(2)}  (${tiers.strong.length} ads)`);
  console.log(`Medium avg:  ${mediumAvg.toFixed(2)}  (${tiers.medium.length} ads)`);
  console.log(`Weak avg:    ${weakAvg.toFixed(2)}  (${tiers.weak.length} ads)`);
  console.log();
  console.log(`Ranking correct (S > M > W):  ${rankingCorrect ? 'YES ✓' : 'NO ✗'}`);
  console.log(
    `Gap S→M: ${strongMediumGap.toFixed(2)} (need ≥1.0):  ${strongMediumGap >= 1.0 ? 'YES ✓' : 'NO ✗'}`,
  );
  console.log(
    `Gap M→W: ${mediumWeakGap.toFixed(2)} (need ≥1.0):  ${mediumWeakGap >= 1.0 ? 'YES ✓' : 'NO ✗'}`,
  );
  console.log(
    `No crossover (min strong ${minStrong.toFixed(2)} > max weak ${maxWeak.toFixed(2)}):  ${noCrossover ? 'YES ✓' : 'NO ✗'}`,
  );

  const allPass = rankingCorrect && gapsOk && noCrossover;
  console.log(`\n=== OVERALL: ${allPass ? 'CALIBRATION VALIDATED ✓' : 'CALIBRATION NEEDS TUNING ✗'} ===`);

  if (!allPass) {
    console.log('\nIssues to address:');
    if (!rankingCorrect) console.log('  - Tier averages are not in correct order');
    if (!gapsOk) console.log('  - Tier gaps are < 1.0 points');
    if (!noCrossover) console.log('  - Some strong ads scored below weak ads');
  }

  // Cost summary
  const totalCost = allEvals.reduce((sum, e) => sum + e.metadata.costUsd, 0);
  const totalTokensIn = allEvals.reduce((sum, e) => sum + e.metadata.tokensIn, 0);
  const totalTokensOut = allEvals.reduce((sum, e) => sum + e.metadata.tokensOut, 0);
  console.log(`\nTotal cost: $${totalCost.toFixed(4)}`);
  console.log(`Total tokens: ${totalTokensIn} in, ${totalTokensOut} out`);

  // Save report
  await mkdir(OUTPUT_DIR, { recursive: true });
  const report = {
    timestamp: new Date().toISOString(),
    evalModel,
    validationResult: allPass ? 'PASS' : 'FAIL',
    rankingCorrect,
    gaps: { strongToMedium: strongMediumGap, mediumToWeak: mediumWeakGap },
    noCrossover,
    minStrongScore: minStrong,
    maxWeakScore: maxWeak,
    tiers: {
      strong: { avgScore: strongAvg, ads: allScored.filter((s) => s.tier === 'strong') },
      medium: { avgScore: mediumAvg, ads: allScored.filter((s) => s.tier === 'medium') },
      weak: { avgScore: weakAvg, ads: allScored.filter((s) => s.tier === 'weak') },
    },
    cost: { totalCost, totalTokensIn, totalTokensOut },
  };

  const reportPath = path.join(OUTPUT_DIR, 'reference-calibration-report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport saved to ${reportPath}`);
}

main().catch((err) => {
  console.error('Reference calibration failed:', err);
  process.exit(1);
});
