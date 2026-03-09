/**
 * Human-readable trace viewer for pipeline runs.
 * Shows each step: generation → evaluation → (editor → re-evaluation) → accept/reject.
 *
 * Usage: npx tsx src/scripts/view-run.ts [runId]
 *   If no runId, shows the most recent run.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { PipelineResult } from '../types/pipeline.js';
import type { AdWithHistory } from '../types/pipeline.js';

const OUTPUT_DIR = path.resolve('data/output');

function dim(text: string) { return `\x1b[2m${text}\x1b[0m`; }
function bold(text: string) { return `\x1b[1m${text}\x1b[0m`; }
function green(text: string) { return `\x1b[32m${text}\x1b[0m`; }
function red(text: string) { return `\x1b[31m${text}\x1b[0m`; }
function yellow(text: string) { return `\x1b[33m${text}\x1b[0m`; }
function cyan(text: string) { return `\x1b[36m${text}\x1b[0m`; }

function scoreColor(score: number): string {
  if (score >= 8) return green(score.toFixed(1));
  if (score >= 7) return yellow(score.toFixed(1));
  return red(score.toFixed(1));
}

function printAd(ah: AdWithHistory, index: number) {
  const ad = ah.ad;
  const evalCount = ah.evaluations.length;
  const status = ah.accepted ? green('ACCEPTED') : red('REJECTED');
  const cycles = ah.cyclesUsed;

  console.log(`\n  ${bold(`Ad ${index + 1}`)} ${dim(`(${ad.id.slice(0, 8)}...)`)}  ${status}  ${dim(`cycles: ${cycles}`)}`);
  console.log(`  ${dim('─'.repeat(60))}`);

  // Show the final ad text
  console.log(`  ${bold('Headline:')} ${ad.headline}`);
  console.log(`  ${bold('Primary:')}  ${ad.primaryText}`);
  console.log(`  ${bold('Desc:')}     ${ad.description}`);
  console.log(`  ${bold('CTA:')}      ${ad.ctaButton}`);
  console.log(`  ${dim(`Version: ${ad.version}`)}`);

  // Show each evaluation step
  for (let i = 0; i < evalCount; i++) {
    const evaluation = ah.evaluations[i];
    const isFirst = i === 0;
    const isLast = i === evalCount - 1;

    const label = isFirst
      ? (evalCount === 1 ? 'Evaluation' : 'Initial evaluation')
      : `Re-evaluation after edit #${i}`;

    console.log(`\n  ${cyan(`→ ${label}`)}  ${dim(`(${evaluation.overallConfidence} confidence)`)}`);
    console.log(`    ${bold('Weighted score:')} ${scoreColor(evaluation.weightedScore)}`);

    // Show dimension scores in a compact line
    const dims = evaluation.scores.map(s => {
      const name = s.dimension.replace('_', ' ').replace('emotional resonance', 'emotion');
      const short = s.dimension === 'clarity' ? 'CLR'
        : s.dimension === 'value_proposition' ? 'VP'
        : s.dimension === 'emotional_resonance' ? 'EMO'
        : s.dimension === 'cta' ? 'CTA'
        : 'BV';
      return `${short}=${scoreColor(s.score)}`;
    });
    console.log(`    ${dims.join('  ')}`);

    // Show rationales
    for (const s of evaluation.scores) {
      const short = s.dimension === 'clarity' ? 'CLR'
        : s.dimension === 'value_proposition' ? 'VP'
        : s.dimension === 'emotional_resonance' ? 'EMO'
        : s.dimension === 'cta' ? 'CTA'
        : 'BV';
      console.log(`    ${dim(short + ':')} ${dim(s.rationale)}`);
    }

    // If not accepted and not the last eval, show what happens next
    if (!isLast) {
      // Find the weakest dimension
      const weakest = evaluation.scores.reduce((a, b) => a.score < b.score ? a : b);
      console.log(`\n  ${yellow(`⟳ Editor targeting: ${weakest.dimension} (${weakest.score}/10)`)}`);
    } else if (ah.accepted) {
      console.log(`\n  ${green('✓ Accepted into ad library')}`);
    } else {
      console.log(`\n  ${red('✗ Rejected after max cycles')}`);
    }
  }
}

async function main() {
  let runId = process.argv[2];

  if (!runId) {
    // Find the most recent run (not 'calibration')
    const dirs = await readdir(OUTPUT_DIR);
    const runs = dirs.filter(d => d !== 'calibration').sort().reverse();
    if (runs.length === 0) {
      console.log('No pipeline runs found. Run `npm run pipeline` first.');
      process.exit(1);
    }
    runId = runs[0];
  }

  const filePath = path.join(OUTPUT_DIR, runId, 'pipeline-result.json');
  const raw = await readFile(filePath, 'utf8');
  const result: PipelineResult = JSON.parse(raw);

  console.log(bold('═══════════════════════════════════════════════════════════'));
  console.log(bold('  nerdyAds Pipeline Run Trace'));
  console.log(bold('═══════════════════════════════════════════════════════════'));
  console.log(`  ${dim('Run ID:')}    ${result.runId}`);
  console.log(`  ${dim('Started:')}   ${result.startedAt}`);
  console.log(`  ${dim('Completed:')} ${result.completedAt}`);
  console.log(`  ${dim('Duration:')}  ${((new Date(result.completedAt).getTime() - new Date(result.startedAt).getTime()) / 1000).toFixed(0)}s`);

  for (const briefResult of result.briefs ?? []) {
    const ads = briefResult.ads ?? [];
    const accepted = ads.filter(a => a.accepted).length;
    const total = ads.length;
    const avgScore = briefResult.metrics?.averageScore ?? 0;

    console.log(`\n${bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')}`);
    console.log(`${bold(`  Brief: ${briefResult.briefId}`)}  ${dim(`${accepted}/${total} accepted`)}  ${dim(`avg: ${avgScore.toFixed(2)}`)}`);
    console.log(bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

    for (let i = 0; i < ads.length; i++) {
      printAd(ads[i], i);
    }
  }

  // Summary
  console.log(`\n${bold('═══════════════════════════════════════════════════════════')}`);
  console.log(`${bold('  Summary')}`);
  console.log(`${bold('═══════════════════════════════════════════════════════════')}`);
  console.log(`  Generated:  ${result.totalAdsGenerated}`);
  console.log(`  Accepted:   ${result.totalAdsAccepted}  (${(result.acceptanceRate * 100).toFixed(1)}%)`);
  console.log(`  Avg Score:  ${scoreColor(result.averageScore)}`);
  console.log(`  Cost:       $${result.totalCostUsd.toFixed(4)}`);
  console.log(`  Tokens:     ${result.totalTokensIn} in, ${result.totalTokensOut} out`);
  console.log();
}

main().catch((err) => {
  console.error('Failed to load run:', err.message);
  process.exit(1);
});
