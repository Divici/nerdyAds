/**
 * Phase 7: Run the full pipeline on a subset of briefs (first run).
 * Defaults to the first 3 briefs. Override with --briefs=5 for more.
 *
 * Usage: npx tsx src/scripts/run-pipeline.ts [--briefs=N] [--ads=N]
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Brief } from '../types/brief.js';
import type { CompetitorPattern } from '../types/patterns.js';
import { processAllBriefs } from '../pipeline/orchestrator.js';

function parseArg(name: string, defaultVal: number): number {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (arg) {
    const val = parseInt(arg.split('=')[1], 10);
    return isNaN(val) ? defaultVal : val;
  }
  return defaultVal;
}

async function main() {
  const briefCount = parseArg('briefs', 3);
  const adsPerBrief = parseArg('ads', 5);

  console.log('=== nerdyAds Pipeline — First Run ===\n');
  console.log(`Briefs: ${briefCount}, Ads per brief: ${adsPerBrief}\n`);

  // Load briefs
  const rawBriefs = await readFile(path.resolve('data/briefs.json'), 'utf8');
  const allBriefs: Brief[] = JSON.parse(rawBriefs);
  const briefs = allBriefs.slice(0, briefCount);
  console.log(`Using briefs: ${briefs.map((b) => b.id).join(', ')}\n`);

  // Load patterns (if available)
  let patterns: CompetitorPattern | undefined;
  try {
    const rawPatterns = await readFile(path.resolve('data/reference/patterns.json'), 'utf8');
    const cached = JSON.parse(rawPatterns);
    patterns = cached.pattern ?? cached;
    console.log('Loaded competitor patterns from cache\n');
  } catch {
    console.log('No cached patterns found — running without competitor insights\n');
  }

  // Run pipeline
  const result = await processAllBriefs(briefs, {
    adsPerBrief,
    patterns,
    outputDir: 'data/output',
  });

  // Results
  console.log('\n=== PIPELINE RESULTS ===');
  console.log(`Run ID: ${result.runId}`);
  console.log(`Total ads generated: ${result.totalAdsGenerated}`);
  console.log(`Total ads accepted:  ${result.totalAdsAccepted}`);
  console.log(`Acceptance rate:     ${(result.acceptanceRate * 100).toFixed(1)}%`);
  console.log(`Average score:       ${result.averageScore.toFixed(2)}`);
  console.log(`Total cost:          $${result.totalCostUsd.toFixed(4)}`);
  console.log(`Total tokens:        ${result.totalTokensIn} in, ${result.totalTokensOut} out`);

  // Per-brief breakdown
  console.log('\n--- Per-Brief Breakdown ---');
  for (const briefResult of result.briefs) {
    const accepted = briefResult.ads?.filter((a) => a.accepted).length ?? 0;
    const total = briefResult.ads?.length ?? 0;
    const avgScore = briefResult.metrics?.averageScore ?? 0;
    const cost = briefResult.metrics?.costUsd ?? 0;
    console.log(
      `  ${briefResult.briefId}: ${accepted}/${total} accepted, avg score ${avgScore.toFixed(2)}, cost $${cost.toFixed(4)}`,
    );
  }

  // Show some accepted ads
  console.log('\n--- Sample Accepted Ads ---');
  let shown = 0;
  for (const briefResult of result.briefs ?? []) {
    for (const adHistory of briefResult.ads ?? []) {
      if (adHistory.accepted && shown < 3) {
        console.log(`\n[${adHistory.ad.id}] Score: ${adHistory.evaluations[adHistory.evaluations.length - 1].weightedScore.toFixed(2)}, Version: ${adHistory.ad.version}`);
        console.log(`  Primary: ${adHistory.ad.primaryText.slice(0, 120)}...`);
        console.log(`  Headline: ${adHistory.ad.headline}`);
        shown++;
      }
    }
  }

  console.log(`\nResults saved to data/output/${result.runId}/pipeline-result.json`);
}

main().catch((err) => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
