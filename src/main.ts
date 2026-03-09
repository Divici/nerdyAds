import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Brief } from './types/brief.js';
import type { CompetitorPattern } from './types/patterns.js';
import { ResearcherAgent, type CompetitorAd } from './agents/researcher.js';
import { processAllBriefs } from './pipeline/orchestrator.js';

async function main() {
  console.log('nerdyAds — Ad Generation Engine');
  console.log('================================\n');

  // 1. Load competitor ads and run researcher
  console.log('Step 1: Analyzing competitor patterns...');
  const rawAds = await readFile(path.resolve('data/reference/competitor_ads.json'), 'utf8');
  const competitorAds: CompetitorAd[] = JSON.parse(rawAds);

  const researcher = new ResearcherAgent({ cacheDir: path.resolve('data/reference') });
  const researchResult = await researcher.analyzePatterns(competitorAds);
  console.log(`  Patterns: ${researchResult.cached ? 'loaded from cache' : 'freshly analyzed'}`);
  console.log(`  Cost: $${researchResult.metadata.costUsd.toFixed(4)}\n`);

  // 2. Load briefs
  const rawBriefs = await readFile(path.resolve('data/briefs.json'), 'utf8');
  const briefs: Brief[] = JSON.parse(rawBriefs);
  console.log(`Step 2: Loaded ${briefs.length} briefs\n`);

  // 3. Run pipeline
  console.log('Step 3: Running pipeline...\n');
  const result = await processAllBriefs(briefs, {
    adsPerBrief: 5,
    patterns: researchResult.pattern,
    outputDir: 'data/output',
  });

  // 4. Results summary
  console.log('\n================================');
  console.log('PIPELINE COMPLETE');
  console.log('================================');
  console.log(`Run ID:          ${result.runId}`);
  console.log(`Ads generated:   ${result.totalAdsGenerated}`);
  console.log(`Ads accepted:    ${result.totalAdsAccepted}`);
  console.log(`Acceptance rate: ${(result.acceptanceRate * 100).toFixed(1)}%`);
  console.log(`Average score:   ${result.averageScore.toFixed(2)}`);
  console.log(`Total cost:      $${result.totalCostUsd.toFixed(4)}`);
  console.log(`\nResults saved to data/output/${result.runId}/`);
}

main().catch(console.error);
