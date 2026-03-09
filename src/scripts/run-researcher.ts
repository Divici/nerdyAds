/**
 * Phase 7: Run the researcher agent on competitor ads to extract patterns.
 * Saves patterns.json to data/reference/.
 *
 * Usage: npx tsx src/scripts/run-researcher.ts
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ResearcherAgent, type CompetitorAd } from '../agents/researcher.js';

const DATA_DIR = path.resolve('data/reference');

async function main() {
  console.log('=== Running Researcher Agent ===\n');

  const rawAds = await readFile(path.join(DATA_DIR, 'competitor_ads.json'), 'utf8');
  const competitorAds: CompetitorAd[] = JSON.parse(rawAds);
  console.log(`Loaded ${competitorAds.length} competitor ads\n`);

  const researcher = new ResearcherAgent({ cacheDir: DATA_DIR });
  const result = await researcher.analyzePatterns(competitorAds);

  console.log(`Cached: ${result.cached}`);
  console.log(`Cost: $${result.metadata.costUsd.toFixed(4)}`);
  console.log(`Tokens: ${result.metadata.tokensIn} in, ${result.metadata.tokensOut} out\n`);

  console.log('--- Extracted Patterns ---');
  console.log(`Hook Types (${result.pattern.hookTypes.length}):`, result.pattern.hookTypes);
  console.log(`Emotional Angles (${result.pattern.emotionalAngles.length}):`, result.pattern.emotionalAngles);
  console.log(`CTA Styles (${result.pattern.ctaStyles.length}):`, result.pattern.ctaStyles);
  console.log(`Common Phrases (${result.pattern.commonPhrases.length}):`, result.pattern.commonPhrases);
  console.log(`Structural Patterns (${result.pattern.structuralPatterns.length}):`, result.pattern.structuralPatterns);
  console.log(`\nPatterns saved to ${DATA_DIR}/patterns.json`);
}

main().catch((err) => {
  console.error('Researcher failed:', err);
  process.exit(1);
});
