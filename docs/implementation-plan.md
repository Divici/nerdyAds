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
- Expand competitor ads to include Kaplan + Khan Academy (currently only Princeton Review + Chegg)
- Create calibration examples entirely self-constructed: synthetic strong/weak/borderline ads in data/calibration/
- Calibration is based on our own judgment — no first-party Varsity Tutors reference ads available
- Run evaluator on calibration set — verify ranking (strong > borderline > weak)
- Run full pipeline on 2-3 briefs
- Tune prompts based on output quality
- Create D-018 decision log entry documenting the no-reference-ads constraint and its impact
- Update decision-log.md with observations

---

## Day 2 — Scale, UI, Polish (18 hours)

### Phase 8: Full-Scale Generation (3h)
- Run processAllBriefs on all 10 briefs (target: 50-80 initial generations)
- Monitor acceptance rate, adjust if < 60%
- Validate quality against our synthetic calibration dataset (no first-party reference ads)
- Snapshot all results to data/output/{runId}/
- Compute final metrics

### Phase 8.5: Reference Ad Calibration Validation (2.5h) ← PRIORITY
**Why this exists:** The project brief's highest-weighted section (25%) requires the evaluator to be "calibrated against best/worst reference ads." Our previous calibration used only synthetic ads we wrote ourselves — circular validation. This phase builds a tiered reference set from real ads and proves the evaluator can rank them correctly.

**Step 1: Build tiered reference set (~15-18 ads)**

**File:** `data/reference/reference-set.json`

**Strong tier (5-6 ads)** — Real Varsity Tutors longest-running ads (copy-tier: strong):
- "3.8 GPA But 1180 SAT? Here's Why" (10 days active, Feb 27)
- "Good GPA. Low SAT. Something's off." (8 days active, Mar 1)
- "Your child is smarter than their score" (Khan attack, long-form, Mar 5)
- "You wouldn't practice football on a baseball field" (sports analogy, Mar 5)
- "Her SAT Score Jumped 360 Points!" (parent testimonial, 1010→1370, Mar 5)

**Medium tier (5-6 ads)** — Proven competitor ads + degraded VT:
- Princeton Review in-person SAT ad as-is (20 days active — longevity-proven but generic copy)
- Kaplan Test Prep Insight endorsement as-is (21 days — authority works, but one-line copy)
- Kaplan bundle ad as-is (35 days — longest of any brand, but broad/non-specific)
- Degraded VT: "3.8 GPA" without checkmarks, generic CTA, remove digital SAT specifics
- Degraded VT: football analogy without claims (2.6x, cancel-anytime), shortened

**Weak tier (5-6 ads)** — Minimal-copy VT ads + degraded + wildcards:
- VT image-only ads as-is (empty primary_text — genuinely weak copy)
- VT trust-only ad as-is ("Trusted by 12k+ Families" as entire primary text)
- Further degraded: generic "Improve your SAT score with expert tutoring. Sign up today."
- Wildcard: wrong audience tone (student slang in parent-targeted ad)
- Wildcard: competing messages (SAT + admissions + AP in one ad, no clear CTA)
- Wildcard: fear-only with no solution

**Tier labeling rules:**
- Tiers are **copy-tier** (v1 scope), not ad-tier — visual quality is not evaluated
- VT ads weighted higher (brand match) despite shorter longevity
- Competitor ads weighted for longevity but down-weighted for non-brand copy
- Each ad in the reference set gets a `tier`, `tier_rationale`, and optional `creative_metadata` field (image URL, video duration, format) for future v2 extension
- User reviews and approves all tier assignments before validation run

**Step 2: Run evaluator against reference set**
- Score all ~15-18 reference ads using the evaluator (same config as pipeline)
- Record all 5 dimension scores + weighted average for each ad

**Step 3: Validate ranking**
- Assert: strong tier avg > medium tier avg > weak tier avg
- Assert: meaningful separation between tiers (≥1.0 point gap)
- Assert: no individual strong ad scores below any weak ad
- Report per-dimension breakdown by tier (which dimensions discriminate best?)

**Step 4: Tune if needed**
- If ranking fails, adjust evaluator prompt and re-run
- Document any tuning in decision log
- If ranking passes, this becomes the centerpiece evidence for the 25%-weighted evaluation section

**Step 5: Replace old calibration anchors**
- Update `data/calibration/` with top strong and bottom weak ads from the validated reference set
- These become the evaluator's grading anchors in the pipeline (replacing the old synthetic-only anchors)
- Re-run pipeline on 2-3 briefs to verify output quality with new anchors

**Design note (v2 readiness):** The reference set schema includes optional `creative_metadata` fields so v2 image evaluation can extend the reference set without rebuilding. Tier labels are scoped as `copy_tier` — a future v2 calibration would add `visual_tier` and `overall_tier`.

---

### Phase 9: Evals Suite (2.5h)
**Files:**
- `tests/evals/calibration.eval.ts` — reference set ranking: strong > medium > weak (replaces old synthetic-only calibration)
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
Phase 1 → Phase 2 → Phase 3 → Phase 4 (evaluator) → Phase 5 (agents) → Phase 6 (pipeline) → Phase 7 (calibration) → Phase 8 (full run) → Phase 8.5 (reference calibration validation) → Phase 9 (evals) → Phase 10 (UI)
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
                          │           └── Phase 8.5 (reference calibration validation)
                          │                 ├── Phase 9 (evals)
                          │                 └── Phase 10 (UI)

Phase 11 (docs) — parallel after Phase 8
Phase 12 (polish) — final
```
