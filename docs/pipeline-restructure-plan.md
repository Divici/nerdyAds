# Pipeline Restructure Plan — Continuous Small-Batch Generation

## Context for New Sessions

**Read these files first:**
- `CLAUDE.md` — project overview, tech stack, current status
- `NerdyProjectBrief.md` — full project requirements and evaluation criteria
- `docs/decision-log.md` — all prior decisions (D-001 through D-030)

**What exists now (Phases 1-9 complete, 194 tests passing):**
- 4 agents: WriterAgent, EvaluatorAgent, EditorAgent, ResearcherAgent (all in `src/agents/`)
- Pipeline: orchestrator → batch-runner → iteration-loop (all in `src/pipeline/`)
- Evaluation: scoring.ts, threshold.ts (QualityRatchet), failure-taxonomy.ts (all in `src/evaluate/`)
- Config: weights.ts, thresholds.ts, models.ts, prompts.ts (all in `src/config/`)
- Utils: gemini-client.ts, rate-limiter.ts, snapshot.ts, langfuse.ts, logger.ts, hash.ts, calibration-loader.ts (all in `src/utils/`)
- Types: ad.ts, brief.ts, evaluation.ts, pipeline.ts, patterns.ts (all in `src/types/`)
- Metrics: tracker.ts, cost.ts (in `src/metrics/`)
- Data: 10 briefs in `data/briefs.json`, 16-ad tiered reference set in `data/reference/reference-set.json`, 63 competitor ads in `data/reference/competitor_ads.json`
- Scripts: `src/main.ts` and `src/scripts/run-pipeline.ts` both call `processAllBriefs()` — BOTH must be updated

**Key conventions:**
- All modules use ESM (`"type": "module"` in package.json, `.js` extensions in imports)
- Barrel exports via `index.ts` in each directory
- Zod for runtime validation
- `callGemini(role, systemPrompt, userPrompt, options)` is the only LLM interface
- Tests use vitest with `vi.fn()` mocking — no real API calls in unit/integration tests

## Why This Change

The current pipeline generates a fixed batch of 5-8 ads per brief, processes all briefs, and finishes. This produces ~85-100% acceptance rates because every ad gets 3 editor cycles to pass a 7.0 threshold. The brief says "most ads fail" and the system should "surface only its best work."

The new pipeline generates ads in small batches of 3, continuously, until each brief has enough accepted ads (6+). Failed ads that exhaust editor cycles are discarded and replaced with fresh generations. The threshold is raised to 7.5 with a per-dimension floor of 6.0.

This also adds few-shot calibration examples to the writer prompt (1 strong + 1 weak example) so the writer knows what quality looks like before generating.

## What Changes

### 1. Config Changes

**File: `src/config/thresholds.ts`**
- `QUALITY_THRESHOLD`: 7.0 → 7.5
- `MIN_DIMENSION_SCORE`: 5 → 6
- Add: `TARGET_ACCEPTED_PER_BRIEF = 6`
- Add: `BATCH_SIZE = 3`
- Add: `MAX_GENERATION_ROUNDS = 10` (safety cap: don't loop forever)

**Tests to update:**
- `tests/unit/config.test.ts` — update threshold/floor assertions
- `tests/unit/threshold.test.ts` — update expected threshold values

### 2. Writer Few-Shot Examples

**Reference set schema** (`data/reference/reference-set.json` — array of objects):
```json
{
  "id": "ref-strong-001",
  "copy_tier": "strong" | "medium" | "weak",
  "tier_rationale": "...",
  "primary_text": "...",
  "headline": "...",
  "description": "...",
  "cta_button": "...",
  "target_audience": "parents" | "students"
}
```

**File: `src/config/prompts.ts`**
- Add a `FewShotExample` interface: `{ tier: 'strong' | 'weak'; primaryText: string; headline: string; description: string; ctaButton: string; tierRationale: string }`
- Add `buildWriterFewShotSection(examples: FewShotExample[]): string` that formats them as a `## Quality Reference Examples` block in the prompt
- Update `buildWriterUserPrompt()` signature to accept optional `fewShotExamples?: FewShotExample[]` parameter — inject the section before the generation instruction

**File: `src/utils/calibration-loader.ts`** (already exists, loads reference-set.json)
- Add `loadWriterFewShotExamples(): Promise<FewShotExample[]>` — reads reference-set.json, picks 1 strong + 1 weak ad (first of each tier), maps to `FewShotExample` format

**File: `src/agents/writer.ts`**
- `WriterAgent` constructor or `generateBatch()`: accept optional `fewShotExamples: FewShotExample[]`
- Pass through to `buildWriterUserPrompt(brief, count, patterns, fewShotExamples)`
- No other logic changes — the writer just sees richer prompt context

**New tests:**
- `tests/unit/writer.test.ts` — add test: when fewShotExamples provided, prompt includes "Quality Reference Examples" section with strong/weak labels
- `tests/unit/prompts.test.ts` (new) — verify `buildWriterFewShotSection()` formats correctly (includes tier label, full ad copy, rationale)

### 3. Pipeline Loop Restructure

**File: `src/pipeline/batch-runner.ts`** — Major rewrite

Current behavior: `runBatch(brief, count, deps, patterns)` → generates `count` ads in one shot, iterates each.

New behavior: `runContinuousBatch(brief, deps)` → generates 3 ads at a time, evaluates, fixes failures (max 3 editor cycles), discards unfixable, keeps generating until `TARGET_ACCEPTED_PER_BRIEF` (6) accepted or `MAX_GENERATION_ROUNDS` (10) reached.

**Current `BatchRunnerDeps` interface** (in `src/pipeline/batch-runner.ts`):
```typescript
interface BatchRunnerDeps {
  generateBatch: (brief: Brief, count: number, patterns?: CompetitorPattern) => Promise<Ad[]>;
  evaluate: (ad: Ad, brief?: Brief) => Promise<Evaluation>;
  improve: (ad: Ad, evaluation: Evaluation, brief?: Brief) => Promise<Ad>;
  checkThreshold: (score: number, dimensionScores?: DimensionScore[]) => boolean;
  maxCycles: number;
}
```

**New `ContinuousBatchDeps` interface** (extends with patterns + fewShot):
```typescript
interface ContinuousBatchDeps {
  generateBatch: (brief: Brief, count: number, patterns?: CompetitorPattern) => Promise<Ad[]>;
  evaluate: (ad: Ad, brief?: Brief) => Promise<Evaluation>;
  improve: (ad: Ad, evaluation: Evaluation, brief?: Brief) => Promise<Ad>;
  checkThreshold: (score: number, dimensionScores?: DimensionScore[]) => boolean;
  maxCycles: number;
  patterns?: CompetitorPattern;
  targetAccepted: number;        // from config: TARGET_ACCEPTED_PER_BRIEF (6)
  batchSize: number;             // from config: BATCH_SIZE (3)
  maxRounds: number;             // from config: MAX_GENERATION_ROUNDS (10)
}
```

**Pseudocode:**
```
function runContinuousBatch(brief, deps):
  accepted = []
  rejected = []
  round = 0

  while accepted.length < deps.targetAccepted and round < deps.maxRounds:
    round++
    batch = deps.generateBatch(brief, deps.batchSize, deps.patterns)

    for each ad in batch:
      result = iterateAd(ad, iterationDeps, brief)  // uses existing iteration-loop.ts
      if result.accepted:
        accepted.push(result)
      else:
        rejected.push(result)

      if accepted.length >= deps.targetAccepted:
        break

  return { briefId, accepted, rejected, roundsUsed: round, totalGenerated }
```

**Important:** `iterateAd()` from `src/pipeline/iteration-loop.ts` is unchanged — it still does eval → edit ×3 → accept/reject per ad. The new loop wraps around it.

Key differences from current `runBatch()`:
- Loop continues until enough accepted ads (not fixed count)
- Rejected ads are tracked separately with full history
- Round counter shows how many generation batches it took
- Safety cap prevents infinite loops
- Keep the old `runBatch()` export for backward compatibility (evals and other scripts may use it), but the orchestrator switches to `runContinuousBatch()`

**Return type:**
```typescript
interface ContinuousBatchResult {
  briefId: string;
  accepted: AdWithHistory[];    // ads that passed
  rejected: AdWithHistory[];    // ads that failed (with full eval history)
  roundsUsed: number;           // how many batches of 3 were generated
  totalGenerated: number;       // total ads created (including discarded)
}
```

**Tests to write (TDD):**
- Accepts 6 ads from 2 rounds when all pass first try (6 generated, 6 accepted)
- Needs 3 rounds when some fail and get discarded (9 generated, 6+ accepted)
- Editor fixes a failing ad within 3 cycles → counts as accepted
- Stops at MAX_GENERATION_ROUNDS even if target not met
- Rejected ads have full evaluation history preserved
- roundsUsed tracks correctly

### 4. Orchestrator Changes

**File: `src/pipeline/orchestrator.ts`**

Current `OrchestratorOptions` interface:
```typescript
interface OrchestratorOptions {
  adsPerBrief?: number;          // REMOVE — replaced by TARGET_ACCEPTED_PER_BRIEF config
  patterns?: CompetitorPattern;  // KEEP
  outputDir?: string;            // KEEP
  runId?: string;                // KEEP
  threshold?: number;            // KEEP (but default changes to 7.5)
  evalModel?: ModelRole;         // KEEP
  calibrationAnchors?: CalibrationAnchor[];  // KEEP
}
```

Changes to `OrchestratorOptions`:
- Remove `adsPerBrief` (config constant now)
- Add `fewShotExamples?: FewShotExample[]` (loaded by caller, passed to writer)

Changes to `processAllBriefs()`:
- Import `runContinuousBatch` instead of `runBatch`
- Pass `fewShotExamples` to the writer's `generateBatch` via the deps
- Build `ContinuousBatchDeps` with config constants (TARGET_ACCEPTED_PER_BRIEF, BATCH_SIZE, MAX_GENERATION_ROUNDS)
- Map `ContinuousBatchResult` → updated `PipelineResult` (include rejected ads, roundsUsed)
- Compute `costPerAcceptedAd` in summary

Changes to `processBrief()`:
- Same approach — use `runContinuousBatch` instead of `runBatch`

**File: `src/main.ts`** — Update:
- Remove `adsPerBrief: 5` from options
- Load few-shot examples via `loadWriterFewShotExamples()` and pass to `processAllBriefs()`
- Update results summary to show `costPerAcceptedAd`, `totalAdsRejected`

**File: `src/scripts/run-pipeline.ts`** — Update:
- Remove `--ads=N` CLI flag (no longer applicable)
- Load few-shot examples
- Pass to `processAllBriefs()`
- Update results display for new metrics

**Tests to update:**
- `tests/integration/pipeline.test.ts` — update to use new continuous batch interface, mock `runContinuousBatch` deps

### 5. Type Changes

**File: `src/types/pipeline.ts`**

Add to `PipelineResult`:
```typescript
costPerAcceptedAd: number;       // totalCostUsd / totalAdsAccepted
totalAdsRejected: number;        // discarded ads count
```

Add to brief-level results:
```typescript
rejected: AdWithHistory[];       // rejected ads with full history
roundsUsed: number;              // generation rounds for this brief
```

### 6. Metrics Changes

**File: `src/metrics/tracker.ts`**

Add:
- `getCostPerAcceptedAd()` → totalCost / acceptedCount
- Track rejected ads count separately
- `getRoundMetrics()` → per-round acceptance rate (shows if later rounds are better/worse)

### 7. Evaluation Sample

**New file: `examples/evaluation-sample.json`**

Create a sample showing the expected output format — one ad with full 5-dimension evaluation, rationales, confidence, weighted score, metadata. Based on our actual schema.

## Files Changed (Summary)

| File | Change Type | Details |
|---|---|---|
| `src/config/thresholds.ts` | Modify | Raise QUALITY_THRESHOLD 7.0→7.5, MIN_DIMENSION_SCORE 5→6, add TARGET_ACCEPTED_PER_BRIEF=6, BATCH_SIZE=3, MAX_GENERATION_ROUNDS=10 |
| `src/config/prompts.ts` | Modify | Add FewShotExample interface, buildWriterFewShotSection(), update buildWriterUserPrompt() signature |
| `src/utils/calibration-loader.ts` | Modify | Add loadWriterFewShotExamples() that reads reference-set.json |
| `src/agents/writer.ts` | Modify | Accept fewShotExamples in generateBatch(), pass to buildWriterUserPrompt() |
| `src/pipeline/batch-runner.ts` | Add new function | Add runContinuousBatch() alongside existing runBatch() (keep old for backward compat) |
| `src/pipeline/orchestrator.ts` | Modify | Switch from runBatch→runContinuousBatch, remove adsPerBrief, add fewShotExamples |
| `src/types/pipeline.ts` | Modify | Add costPerAcceptedAd, totalAdsRejected to PipelineResult; add rejected[], roundsUsed to brief-level |
| `src/metrics/tracker.ts` | Modify | Add getCostPerAcceptedAd(), rejected count tracking |
| `src/main.ts` | Modify | Remove adsPerBrief, load few-shot examples, update summary display |
| `src/scripts/run-pipeline.ts` | Modify | Remove --ads flag, load few-shot examples, update display |
| `examples/evaluation-sample.json` | New | Output format reference (one ad with full evaluation) |
| `tests/unit/config.test.ts` | Update | Assert QUALITY_THRESHOLD=7.5, MIN_DIMENSION_SCORE=6, new constants exist |
| `tests/unit/threshold.test.ts` | Update | Update expected threshold values in assertions |
| `tests/unit/writer.test.ts` | Update | Add test: few-shot examples appear in prompt |
| `tests/unit/prompts.test.ts` | New | Test buildWriterFewShotSection() formatting |
| `tests/unit/batch-runner.test.ts` | New | 6 tests for runContinuousBatch() behavior |
| `tests/integration/pipeline.test.ts` | Update | Adapt to ContinuousBatchResult interface |

## Files NOT Changed

- `src/agents/evaluator.ts` — no changes needed
- `src/agents/editor.ts` — no changes needed
- `src/agents/researcher.ts` — no changes needed
- `src/pipeline/iteration-loop.ts` — no changes needed (per-ad loop is fine, called inside runContinuousBatch)
- `src/evaluate/scoring.ts` — no changes needed
- `src/evaluate/threshold.ts` — QualityRatchet constructor already accepts custom baseThreshold, reads QUALITY_THRESHOLD at runtime
- `src/utils/gemini-client.ts` — no changes needed
- `src/utils/rate-limiter.ts` — no changes needed
- `src/utils/langfuse.ts` — no changes needed
- `tests/evals/*` — no changes needed (eval tests are independent of pipeline shape)
- `data/briefs.json` — no changes needed (still 10 briefs)
- `data/reference/reference-set.json` — no changes needed (read-only data source)

## Implementation Order (TDD)

### Step 1: Config constants
- Update `src/config/thresholds.ts` — change values, add new exports
- Update `tests/unit/config.test.ts` — fix broken assertions for new values
- Run `npm run test:unit` — verify config tests pass

### Step 2: Types
- Update `src/types/pipeline.ts` — add `costPerAcceptedAd`, `totalAdsRejected` to PipelineResultSchema; add `rejected` and `roundsUsed` fields to brief-level results object
- Update `tests/unit/types.test.ts` if schema validation tests exist for PipelineResult
- Run `npm run test:unit`

### Step 3: Few-shot builder
- Create `tests/unit/prompts.test.ts` with failing test: `buildWriterFewShotSection()` returns formatted string with STRONG/WEAK labels and ad copy
- Implement `FewShotExample` interface and `buildWriterFewShotSection()` in `src/config/prompts.ts`
- Update `buildWriterUserPrompt()` to accept and inject `fewShotExamples`
- Add `loadWriterFewShotExamples()` to `src/utils/calibration-loader.ts`
- Run `npm run test:unit`

### Step 4: Writer few-shot
- Add failing test to `tests/unit/writer.test.ts`: when fewShotExamples provided, prompt includes "Quality Reference" section
- Update `WriterAgent.generateBatch()` and `generateRaw()` to accept and forward `fewShotExamples`
- Run `npm run test:unit`

### Step 5: Continuous batch runner
- Create `tests/unit/batch-runner.test.ts` with 6 failing tests (listed in section 3 above)
- Implement `runContinuousBatch()` in `src/pipeline/batch-runner.ts` (keep old `runBatch()` for compat)
- Export `ContinuousBatchResult` and `ContinuousBatchDeps` types
- Update barrel export in `src/pipeline/index.ts`
- Run `npm run test:unit`

### Step 6: Orchestrator + scripts
- Update `tests/integration/pipeline.test.ts` to mock the new `ContinuousBatchDeps` interface
- Update `src/pipeline/orchestrator.ts` — switch to `runContinuousBatch`, remove `adsPerBrief`, add `fewShotExamples`
- Update `src/main.ts` — load few-shot examples, remove `adsPerBrief: 5`, update summary
- Update `src/scripts/run-pipeline.ts` — remove `--ads` flag, load few-shot examples, update display
- Run `npm test` (all unit + integration)

### Step 7: Metrics
- Update `src/metrics/tracker.ts` — add `getCostPerAcceptedAd()`
- Update `tests/unit/tracker.test.ts` — test new method
- Run `npm run test:unit`

### Step 8: Evaluation sample
- Create `examples/evaluation-sample.json` based on actual output schema

### Step 9: Run pipeline + validate
- Run `npm run pipeline` with all 10 briefs
- Verify: acceptance rate 40-60%, 60+ accepted ads, rejected ads have full history
- If acceptance rate >80%, bump threshold to 8.0 and re-run
- Save output to `data/output/`

### Step 10: Documentation
- Add D-031 to `docs/decision-log.md`: pipeline restructure reasoning
- Update `CLAUDE.md` status section
- Update `STUDY_GUIDE.md` with new pipeline flow
- Update memory files

## Expected Outcomes

- **Acceptance rate:** 40-60% (down from 85-100%)
- **Ads per brief:** 6+ accepted, ~10-18 total generated per brief
- **Total output:** 60+ accepted ads across 10 briefs
- **Visible iteration:** rejected ads show editor cycle history
- **Cost:** slightly higher per accepted ad (more generations), but ROI story is better
- **Demo story:** "We generated 120 ads, rejected 55, improved 25, accepted 65. Here's why each one passed or failed."

## Verification Checklist (before moving to UI phase)

- [ ] `npm test` passes (all unit + integration — should be 200+ tests now)
- [ ] `npm run eval` passes (11 eval tests — unchanged but verify no regressions)
- [ ] `npm run pipeline` produces 60+ accepted ads across 10 briefs
- [ ] Acceptance rate is visibly below 100% (target 40-60%)
- [ ] Output JSON contains both `accepted` and `rejected` arrays per brief
- [ ] Rejected ads have full evaluation history (evaluations[], cyclesUsed > 0)
- [ ] `costPerAcceptedAd` appears in pipeline result summary
- [ ] Few-shot examples visible in writer prompt (check Langfuse traces or logger output)
- [ ] `examples/evaluation-sample.json` exists and matches actual output schema
- [ ] D-031+ decision log entries document the restructure
- [ ] `CLAUDE.md` status updated to reflect pipeline restructure complete
- [ ] No existing tests broken (evals still pass with new threshold values)

**Note on eval tests:** The calibration eval (`tests/evals/calibration.eval.ts`) evaluates reference ads against the evaluator. The threshold change (7.0→7.5) doesn't affect eval scoring — evals test the evaluator's judgment, not the pipeline's acceptance logic. However, the `MIN_DIMENSION_SCORE` change (5→6) IS used by `allDimensionsAboveFloor()` which IS used in `QualityRatchet.check()`. Eval tests don't use the ratchet directly, so they should be unaffected. Verify anyway.

## Risk: What If Everything Passes at 7.5?

If Gemini Flash + few-shot examples produces ads that almost all score above 7.5 on first try, we still won't see the iteration story. Mitigations:
- Per-dimension floor of 6.0 catches ads with one weak dimension hiding behind strong others
- Quality ratchet will push threshold higher as good ads accumulate
- If acceptance rate is still >80% after first run, bump threshold to 8.0 and document the decision
- The rejected ads with full history still demonstrate the system's filtering capability
