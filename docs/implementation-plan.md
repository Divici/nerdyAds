# nerdyAds Implementation Plan

## Overview
2-day build (two 18-hour days). 12 phases. TypeScript full-stack.

---

## Day 1 — Foundation + Pipeline Core (18 hours)

### Phase 1: Project Scaffolding (1.5h)
- `package.json` with scripts: build, start, test, test:unit, test:integration, eval, generate, ui
- `tsconfig.json` — strict mode, ES2022, path aliases
- `vitest.config.ts` — workspaces for unit, integration, evals
- `.env.example`
- Directory structure + barrel files
- Dependencies: `@google/genai`, `langfuse`, `zod`, `dotenv`, `vitest`, `typescript`, `tsx`

### Phase 2: Type System + Configuration (1.5h)
**Files:**
- `src/types/ad.ts` — Ad, AdMetadata
- `src/types/brief.ts` — Brief
- `src/types/evaluation.ts` — DimensionScore, Evaluation
- `src/types/pipeline.ts` — PipelineResult, AdWithHistory, BatchMetrics
- `src/types/patterns.ts` — CompetitorPattern
- `src/config/weights.ts` — dimension weights (clarity 25, value_prop 25, emotional 20, cta 15, brand_voice 15)
- `src/config/thresholds.ts` — QUALITY_THRESHOLD=7.0, MAX_CYCLES=3, RATCHET_BUFFER=0.5
- `src/config/models.ts` — model IDs, temperatures, seed defaults, token pricing

**Tests:** weights sum to 100, Zod schema validation

### Phase 3: Utilities Layer (2h)
**Files:**
- `src/utils/gemini-client.ts` — wraps @google/genai, adds metadata extraction, seeds, JSON mode
- `src/utils/rate-limiter.ts` — minDelay 100ms, maxConcurrent 5, 3 retries, exponential backoff
- `src/utils/snapshot.ts` — save/load JSON snapshots to data/output/{runId}/
- `src/utils/logger.ts` — structured logging
- `src/utils/langfuse.ts` — observability client, trace generation/evaluation
- `src/utils/hash.ts` — SHA-256 prompt hashing

**Tests:** rate limiter (delay, concurrency, retry), snapshot (serialize/deserialize), hash (determinism)

### Phase 4: Evaluator Agent (3h) ← MOST CRITICAL
**Files:**
- `src/evaluate/scoring.ts` — computeWeightedScore, computeConfidence, identifyWeakest
- `src/evaluate/threshold.ts` — meetsThreshold, QualityRatchet class
- `src/evaluate/failure-taxonomy.ts` — classifyFailure → failure labels
- `src/agents/evaluator.ts` — EvaluatorAgent class, builds prompt from rubric + calibration anchors
- `src/config/prompts.ts` (evaluator section)

**Tests:** weighted score math, threshold enforcement, ratchet logic, confidence computation, failure classification

### Phase 5: Writer + Editor + Researcher (3h)
**Files:**
- `src/agents/researcher.ts` — analyzePatterns → CompetitorPattern
- `src/agents/writer.ts` — generateAd, generateBatch
- `src/agents/editor.ts` — improve (3-cycle policy)
- `src/config/prompts.ts` (writer, editor, researcher sections)
- `data/briefs.json` — 10 briefs covering audience × goal × angle variety

**Tests:** Ad schema validation, editor version tracking

### Phase 6: Pipeline Orchestration (3h)
**Files:**
- `src/pipeline/orchestrator.ts` — processBrief, processAllBriefs
- `src/pipeline/iteration-loop.ts` — single-ad improvement cycle
- `src/pipeline/batch-runner.ts` — concurrent brief processing
- `src/metrics/tracker.ts` — MetricsTracker (acceptance rate, quality trend, cost, failures)
- `src/metrics/cost.ts` — cost calculation per model

**Tests (unit):** iteration loop stops correctly, metrics compute accurately, cost math
**Tests (integration):** mocked pipeline — pass first try, improve then pass, fail all cycles, ratchet increases

### Phase 7: First Run + Calibration (3.5h)
- Run Researcher on competitor ads → save patterns.json
- Create calibration examples (strong/weak/borderline in data/calibration/)
- Run evaluator on calibration set — verify ranking
- Run full pipeline on 2-3 briefs
- Tune prompts based on output quality
- Update decision-log.md with observations

---

## Day 2 — Scale, UI, Polish (18 hours)

### Phase 8: Full-Scale Generation (3h)
- Run processAllBriefs on all 10 briefs (target: 50-80 initial generations)
- Monitor acceptance rate, adjust if < 60%
- Snapshot all results to data/output/{runId}/
- Compute final metrics

### Phase 9: Evals Suite (2.5h)
**Files:**
- `tests/evals/calibration.eval.ts` — strong > borderline > weak
- `tests/evals/consistency.eval.ts` — same ad 3x, variance < 1.0
- `tests/evals/dimension-independence.eval.ts` — catches the one weak dimension
- `tests/evals/improvement.eval.ts` — targeted dimension improves after editing
- `tests/evals/regression.eval.ts` — other dimensions don't drop > 1 point

Run via: `npm run eval` (separate from `npm test`)

### Phase 10: Demo UI (4h)
**Files:**
- `ui/` — Vite + React + Recharts + Tailwind
- `ui/src/components/AdCard.tsx` — Meta ad card format
- `ui/src/components/EvaluationBreakdown.tsx` — 5-dimension scores + rationales
- `ui/src/components/QualityTrendChart.tsx` — score progression + ratchet line
- `ui/src/components/MetricsDashboard.tsx` — summary cards, failure chart, cost breakdown
- `ui/src/components/AdLibrary.tsx` — filterable/sortable ad grid

### Phase 11: Documentation (2h)
- `README.md` — overview, quick start, architecture, scripts
- `docs/limitations.md` — honest weaknesses
- `docs/technical-writeup.md` — 1-2 page summary
- Update `docs/decision-log.md` — failed approaches, post-run observations

### Phase 12: Polish + Demo Prep (3h)
- Final generation pass if needed
- UI polish
- Demo video or walkthrough prep
- Verify clean install works: `npm install && npm run generate`
- Run all tests + evals

---

## Test Budget (25+ total)

| Category | Tests |
|----------|-------|
| Unit: weights, scoring, threshold, confidence, taxonomy, rate-limiter, cost | 18 |
| Integration: mocked pipeline (4 scenarios) | 4 |
| Evals: calibration, consistency, independence, improvement, regression | 5+ |
| **Total** | **27+** |

---

## Critical Path
```
Phase 1 → Phase 2 → Phase 3 → Phase 4 (evaluator) → Phase 5 (agents) → Phase 6 (pipeline) → Phase 7 (calibration) → Phase 8 (full run) → Phase 10 (UI)
```

## Cut List (if behind)
1. Langfuse → stub with local JSON logging
2. Recharts → show raw numbers in UI
3. Consistency + regression evals → keep calibration + improvement
4. Tailwind styling → basic CSS
5. MetricsDashboard → just show summary numbers

## Dependency Graph
```
Phase 1 (scaffold)
  └── Phase 2 (types + config)
        └── Phase 3 (utilities)
              ├── Phase 4 (evaluator)
              └── Phase 5 (writer + editor + researcher)
                    └── Phase 6 (pipeline)
                          ├── Phase 7 (calibration)
                          │     └── Phase 8 (full run)
                          │           └── Phase 10 (UI)
                          └── Phase 9 (evals)

Phase 11 (docs) — parallel after Phase 8
Phase 12 (polish) — final
```
