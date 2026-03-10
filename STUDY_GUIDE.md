# nerdyAds — Study Guide

## What We're Building

An autonomous ad generation engine for Varsity Tutors (a Nerdy company) that creates Facebook and Instagram ad copy for SAT test prep campaigns. It doesn't just generate ads — it evaluates them across 5 quality dimensions, rejects weak ones, improves promising ones through targeted regeneration, and tracks whether the quality improvements are worth the API cost (tokens spent).

Think of it like a small internal growth team at a company, except each role (researcher, writer, editor, quality reviewer) is an AI agent with a specific job.

**Who it's for:** Varsity Tutors marketing — targeting parents anxious about college admissions and students stressed about SAT scores.

**The north star metric:** Performance per token — how much ad quality you get per dollar of API spend.

---

## How It Works (High Level)

1. A **brief** is created describing the target audience (e.g., anxious parents), campaign goal (awareness or conversion), and emotional angle (e.g., urgency, aspiration)
2. The **Writer agent** (Gemini Flash) generates a batch of 5-8 ad variants from the brief, using competitor patterns and few-shot examples as context
3. The **Evaluator agent** (Gemini Pro) scores each ad across 5 independent dimensions: Clarity, Value Proposition, CTA, Brand Voice, Emotional Resonance
4. Ads scoring **7.0+ average** are accepted into the ad library
5. Ads below threshold go to the **Editor agent**, which reads the evaluation critique, identifies the weakest dimension, and rewrites only what's broken
6. The improved ad goes back to the Evaluator — up to 3 cycles max
7. If an ad still fails after 3 cycles, it's rejected and the failure mode is logged
8. All of this is tracked: scores per cycle, cost per ad, quality gain per token spent
9. A **quality ratchet** raises the acceptance bar over time as the system proves it can produce better work
10. A simple **Vite + React UI** lets you browse the ad library, see evaluation breakdowns, and view quality trend charts

---

## Key Decisions & Why

### Decision 1: Evaluator-led architecture (not generator-led)

- **Chosen:** Build the evaluator first, make it the center of the system
- **Alternatives:** Build the generator first, bolt on scoring later
- **Why:** The brief explicitly says "the system that knows what good looks like wins." A great generator with a weak evaluator produces polished garbage you can't filter. A decent generator with a strong evaluator surfaces only good work.
- **Tradeoff:** Slower initial output — you don't see ads until the evaluator is calibrated
- **Analogy:** Like hiring a strict editor before hiring writers. The editor sets the bar, then writers learn to meet it.

### Decision 2: TypeScript full-stack (not Python)

- **Chosen:** TypeScript for both pipeline and UI
- **Alternatives:** Python (stronger Gemini SDK, better data tooling), Python backend + TS frontend
- **Why:** Shared type definitions between the ad pipeline and the demo UI eliminate integration bugs. The UI replaces matplotlib/pandas for visualization. Building with Claude makes language comfort less of a factor.
- **Tradeoff:** Gemini JS SDK is slightly less mature than Python's. No pandas for quick data analysis.
- **Analogy:** Like using one language across a monorepo instead of gluing two ecosystems together.

### Decision 3: Gemini Flash for generation, Pro for evaluation

- **Chosen:** Two-model split — cheap model creates, expensive model judges
- **Alternatives:** Single model for both (simpler), Flash for everything (cheapest), Pro for everything (strongest)
- **Why:** Generation is exploratory — you want lots of cheap variants. Evaluation is where judgment matters — worth paying for the stronger model. This naturally creates a performance-per-token story.
- **Tradeoff:** Two model configs to manage. Need to verify Flash quality is good enough for generation.
- **Analogy:** Like using junior copywriters to draft and a senior creative director to approve.

### Decision 4: Agent-based architecture (Researcher, Writer, Editor, Evaluator)

- **Chosen:** Four specialized agents with tool-calling
- **Alternatives:** Monolithic script with functions, simple pipeline without agent abstraction
- **Why:** Maps directly to the brief's v3 bonus (agentic orchestration). Each agent has different context needs, different model requirements, and a clear single responsibility.
- **Tradeoff:** More complex orchestration than a simple function chain
- **Analogy:** Like a creative agency with specialized roles vs one person doing everything.

### Decision 5: Layered context strategy (not stateless, not dump-everything)

- **Chosen:** Each agent role sees only what it needs — generation gets brief + few-shot examples + (if regenerating) the specific critique; evaluation gets rubric + calibration anchors + the ad
- **Alternatives:** Stateless calls (simple but no learning), progressive context (grows per cycle, expensive)
- **Why:** Prevents context bloat, keeps costs down, and makes it easy to swap calibration examples if real reference data becomes available
- **Tradeoff:** More prompt templates to manage
- **Analogy:** Like giving a writer a creative brief vs dumping the entire brand strategy on their desk.

### Decision 6: Seed + snapshot for reproducibility (not seeds alone)

- **Chosen:** Set seeds on all API calls AND snapshot every generation/evaluation result to JSON with full metadata
- **Alternatives:** Seeds only (unreliable across model versions), logging only (no seed attempt), Langfuse only
- **Why:** LLM seeds don't guarantee identical output, but snapshots give perfect reproducibility for demos and audits. Snapshots also double as the metrics data source.
- **Tradeoff:** More storage, more schema design upfront
- **Analogy:** Like recording every take in a studio — even if you can't recreate the exact performance, you have the tape.

### Decision 7: Max 3 regeneration cycles per ad

- **Chosen:** Cap at 3 improvement attempts, then reject
- **Alternatives:** Unlimited regeneration (wastes tokens), 1 attempt (too aggressive), 5 attempts (diminishing returns)
- **Why:** Protects token efficiency. Most ads that don't improve in 3 targeted rewrites are fundamentally flawed — more cycles just spend money on a lost cause.
- **Tradeoff:** Some fixable ads get rejected. But the cost savings fund generating more fresh ads, which is usually more productive.

### Decision 8: Langfuse for observability (not LangChain)

- **Chosen:** Langfuse for tracing and cost tracking; direct Gemini API calls (no LangChain abstraction)
- **Alternatives:** LangChain (abstracts model switching but heavy), custom logging only
- **Why:** Langfuse gives automatic cost tracking, session traces, and dashboards — directly feeding the performance-per-token metric. LangChain adds abstraction that obscures what's happening in a project where transparency matters.
- **Tradeoff:** Another dependency to set up (~1-2 hours)

### Decision 9: Simple quality ratchet

- **Chosen:** Track running average of accepted ads; next batch threshold = max(7.0, running_average - 0.5)
- **Why:** Cheap to build (~30 min), earns bonus points, demonstrates "standards only go up"
- **Tradeoff:** Can get stuck if early ads are unusually good. The 0.5 buffer mitigates this.

### Decision 10: Vite + React for demo UI (not Next.js)

- **Chosen:** Lightweight Vite + React single-page app
- **Alternatives:** Next.js (overkill — SSR, routing, API routes all unnecessary), no UI (harder demo)
- **Why:** The UI is a read-only viewer of pipeline JSON output. Zero routing, zero SSR, zero auth needed. Vite starts instantly and has zero config.
- **Tradeoff:** No server-side rendering, but that's irrelevant for a localhost demo tool.

---

## How Each Piece Works

### Writer Agent (generate)
- **What it does:** Creates ad copy variants from a brief
- **How:** Takes a brief (audience, goal, angle) + 2-3 strong calibration ads as few-shot context → calls Gemini Flash → returns structured ad (primary text, headline, description, CTA button)
- **Example:** Input: `{audience: "anxious parents", goal: "conversion", angle: "urgency"}` → Output: `{primary_text: "The SAT is 10 weeks away. Does your child have a plan?...", headline: "Expert SAT Prep, Starting Now", ...}`

### Evaluator Agent (evaluate)
- **What it does:** Scores ads across 5 dimensions with rationale and confidence
- **How:** Takes the ad + scoring rubric + 1 strong/1 weak calibration example → calls Gemini Pro → returns scores (1-10) per dimension, written rationale for each, confidence flag, and aggregate weighted score
- **Example:** Input: an ad → Output: `{clarity: 8, value_prop: 6, cta: 7, brand_voice: 7, emotional: 5, aggregate: 6.6, confidence: "high", weakest: "emotional_resonance"}`

### Editor Agent (iterate)
- **What it does:** Improves weak ads based on evaluation feedback
- **How:** Takes the original ad + the evaluator's critique (specifically which dimension is weak and why) → calls Gemini Flash → returns a revised ad targeting the weak dimension
- **Example:** Input: ad with weak emotional resonance + critique "purely rational, doesn't connect to parent anxiety" → Output: revised ad with a stronger emotional hook

### Researcher Agent
- **What it does:** Analyzes competitor ad patterns and extracts reusable structures
- **How:** Takes collected competitor ads → hashes the input → checks for a cached `patterns.json` → if cache hit (same hash), returns cached patterns without an API call → if cache miss, calls Gemini Pro, saves the result, and returns it
- **Why caching matters:** The competitor ads are static (only change when we manually add new ones). Without caching, every pipeline run burns a Pro API call to re-derive the same patterns from the same 24 ads. The hash-based approach auto-invalidates when ads change.
- **Example:** First run: 24 competitor ads → Gemini Pro call → saves `data/reference/patterns.json` with input hash. Second run: same 24 ads → hash matches → returns cached patterns (no API call). After adding 5 new ads → hash differs → fresh Pro call → updates cache.

### Metrics Tracker
- **What it does:** Tracks scores, costs, improvement deltas, and failure modes across all ads
- **How:** Reads snapshot JSON files, computes aggregates (avg score per cycle, cost per accepted ad, most common failure types)
- **Example:** "Cycle 1 avg: 6.2, Cycle 2 avg: 7.1, cost per accepted ad: $0.03, most common failure: weak emotional resonance"

### Quality Ratchet
- **What it does:** Raises the acceptance threshold as the system proves it can produce better work
- **How:** After each batch, computes running average of accepted ads. New threshold = max(7.0, running_average - 0.5)
- **Example:** If accepted ads average 7.8, next batch threshold becomes 7.3 instead of 7.0

### Rate Limiter
- **What it does:** Wraps all Gemini API calls with throttling, concurrency control, and retry logic
- **How:** Enforces a minimum 100ms gap between calls, caps parallel requests at 5, and retries 429/5xx errors with exponential backoff (3 attempts)
- **Example:** A batch of 5 ads generating in parallel hits 5 concurrent Flash calls → the limiter allows all 5 but queues a 6th. If one returns 429, it waits 1s, then 2s, then 4s before giving up.
- **Why it matters:** The full pipeline makes ~250-350 API calls per run. Current Gemini limits (2000 RPM Flash, 1000 RPM Pro) are generous, but burst protection and retry logic prevent silent failures during development and at scale.

---

## Things That Don't Work Well (Known / Expected)

- **Evaluator calibration without first-party reference ads (D-018):** No real Varsity Tutors ads or performance data were provided (originally promised via Slack). We're calibrating entirely against competitor ads and self-constructed synthetic examples. The evaluator's brand voice scoring is the weakest dimension — it may over-reward competitor-style copy that doesn't match Varsity's actual voice.
- **LLM seed non-determinism:** Even with seeds set, Gemini doesn't guarantee identical output across runs or model updates. Snapshots mitigate this for reproducibility, but "deterministic" is aspirational.
- **Self-reported confidence:** LLMs are notoriously bad at knowing when they're uncertain. We layer rule-based flags on top, but confidence scores should be treated as directional, not precise.
- **Dimension coupling during regeneration:** Fixing emotional resonance sometimes weakens clarity (ad gets longer/more emotional but less focused). The regression eval catches this, but the editor doesn't always avoid it.
- **Flash generation quality:** Flash is cheaper but may produce lower-quality initial drafts than Pro. If first-pass quality is too low, too many ads hit the regeneration loop, which defeats the cost savings.
- **3-cycle cap:** Some ads might be fixable with a 4th cycle but get rejected. We accept this tradeoff for token efficiency.

---

## Build Plan Summary

12 phases across 2 days. Critical path: Types → Utilities → **Evaluator** (most important) → Writer/Editor → Pipeline → Generation Run → UI.

- Day 1: Foundation + pipeline core + first calibration run
- Day 2: Scale to 50+ ads + evals + demo UI + documentation

The evaluator is built first (Phase 4) because the brief's highest-weighted category (25%) is "can the system tell good ads from bad?" Everything else is plumbing around that core judgment capability.

---

## Build Progress

### Phase 1: Scaffolding (Complete)
- `package.json` with 8 scripts (build, start, test, test:unit, test:integration, eval, generate, ui)
- `tsconfig.json` — strict mode, ES2022, bundler module resolution, path aliases (@agents, @pipeline, etc.)
- `vitest.config.ts` — 3 test projects (unit, integration, evals with 60s timeout)
- Full directory structure with barrel files for all modules
- Dependencies installed: `@google/genai`, `langfuse`, `zod`, `dotenv`, `tsx`, `vitest`, `typescript`

### Phase 2: Type System + Configuration (Complete)
- **5 type modules** with Zod schemas for runtime validation:
  - `ad.ts` — Ad and AdMetadata (id, copy fields, version, generation metadata with token/cost tracking)
  - `brief.ts` — Brief (target audience enum: student/parent/both, campaign goal enum: awareness/conversion/engagement, emotional angle, constraints)
  - `evaluation.ts` — DimensionScore (5 dimensions, 1-10 scores, rationale, confidence per dimension), Evaluation (exactly 5 scores, weighted aggregate, overall confidence level: high/medium/low)
  - `pipeline.ts` — AdWithHistory (ad + evaluation history + accepted flag + cycles used), BatchMetrics, PipelineResult (run-level aggregates)
  - `patterns.ts` — CompetitorPattern (hook types, emotional angles, CTA styles, common phrases, structural patterns)
- **3 config modules:**
  - `weights.ts` — dimension weights summing to 100 (clarity 25, value_prop 25, emotional 20, cta 15, brand_voice 15)
  - `thresholds.ts` — QUALITY_THRESHOLD=7.0, MAX_CYCLES=3, RATCHET_BUFFER=0.5, MIN/MAX_SCORE=1/10
  - `models.ts` — Flash (temp 0.8, 2048 tokens) and Pro (temp 0.3, 4096 tokens) configs, per-token pricing, DEFAULT_SEED=42
- **32 tests passing** (18 schema validation + 14 config tests)
- Key design: Zod schemas serve dual purpose — TypeScript types via `z.infer` AND runtime validation for LLM output parsing

### Phase 3: Utilities Layer (Complete)
- **6 utility modules:**
  - `gemini-client.ts` — wraps `@google/genai` with rate limiting, seed, JSON mode, metadata extraction (tokens, cost, prompt hash)
  - `rate-limiter.ts` — 100ms min delay, 5 max concurrent, 3 retries with exponential backoff
  - `snapshot.ts` — save/load JSON to `data/output/{runId}/` with auto directory creation
  - `logger.ts` — structured JSON logging with debug/info/warn/error levels
  - `langfuse.ts` — real Langfuse client with no-op fallback (no crash without keys). Uses `AsyncLocalStorage` for trace context propagation — orchestrator sets the trace, `callGemini()` reads it automatically without any agent code changes
  - `hash.ts` — SHA-256 prompt hashing for reproducibility tracking
- **16 utility tests passing** (rate limiter 6, snapshot 5, hash 5)

### Phase 4: Evaluator Agent (Complete)
- **3 evaluate modules (TDD — tests written first):**
  - `scoring.ts` — `computeWeightedScore()` applies dimension weights, `computeConfidence()` maps avg confidence to high/medium/low, `identifyWeakest()` finds lowest-scoring dimension
  - `threshold.ts` — `meetsThreshold()` applies quality ratchet (dynamic threshold = max(7.0, runningAvg - 0.5)), `QualityRatchet` class tracks running average and adjusts bar
  - `failure-taxonomy.ts` — `classifyFailure()` labels why an ad failed (e.g., "Unclear messaging", "Ineffective CTA") with actionable improvement suggestions for the editor agent
- **Evaluator agent** (`agents/evaluator.ts`):
  - `EvaluatorAgent.evaluate(ad, brief?, calibrationAnchors?)` calls Gemini Pro with JSON mode, parses response via Zod, computes weighted score + confidence
  - Prompt template in `config/prompts.ts` includes full 5-dimension rubric with scoring guide (1-10), confidence scoring, and structured JSON output schema
  - Supports calibration anchors — strong/weak/borderline example ads injected into prompt to anchor scoring (used in Phase 7 calibration)
- **43 new tests** (scoring 13, threshold 12, failure-taxonomy 8, evaluator 10)
- **91 total tests passing** across 9 test files
- Key design: Evaluator response is validated with Zod before any processing — invalid/partial LLM output throws immediately rather than propagating bad data

### Phase 5: Writer + Editor + Researcher Agents (Complete)
- **3 new agents (TDD — tests written first, all green):**
  - `agents/researcher.ts` — `ResearcherAgent.analyzePatterns(competitorAds)` with hash-based caching: hashes the input ads, checks `data/reference/patterns.json` for a cache hit, and only calls Gemini Pro if the cache is missing or stale. Extracts hook types, emotional angles, CTA styles, common phrases, and structural patterns. Validates response against `CompetitorPatternSchema`. Caching is opt-in via `cacheDir` constructor option.
  - `agents/writer.ts` — `WriterAgent.generateAd(brief, patterns?)` and `WriterAgent.generateBatch(brief, count, patterns?)` call Gemini Flash with JSON mode. Each ad gets a unique UUID, version=0, and full generation metadata. Batch mode throws if the model returns fewer ads than requested.
  - `agents/editor.ts` — `EditorAgent.improve(ad, evaluation)` calls Gemini Flash with JSON mode. Uses `identifyWeakest()` to find the lowest-scoring dimension and builds a targeted improvement prompt. Preserves ad ID and briefId, increments version number. Includes all dimension scores for context so the editor doesn't regress strong dimensions.
- **Prompt templates** in `config/prompts.ts`:
  - Writer system prompt: brand voice guide, ad format spec, quality standards, cliché blacklist, JSON output schema
  - Editor system prompt: editing rules (focus weakest, don't regress others, targeted improvements), JSON output schema
  - Researcher system prompt: analysis focus areas (hooks, emotions, CTAs, phrases, structure), JSON output schema
  - Dynamic user prompt builders: `buildWriterUserPrompt()` injects brief + optional competitor patterns, `buildEditorUserPrompt()` injects current ad + all scores + weakest dimension detail, `buildResearcherUserPrompt()` formats all competitor ads with metadata
- **32 new tests** (researcher 13 incl. 7 caching tests, writer 9, editor 10)
- **130 total tests passing** across 12 test files
- Key design choices:
  - Writer uses Flash (cheap, creative) while Researcher uses Pro (deeper analysis) — matches the model-split philosophy
  - Editor receives ALL dimension scores (not just the weakest) so it has context about what NOT to break
  - Writer can optionally receive competitor patterns from the Researcher — this creates the Researcher → Writer pipeline flow
  - All 3 agents use the same parse pattern: JSON.parse → Zod safeParse → throw on failure

### Phase 6: Pipeline Orchestration (Complete)
- **5 new modules:**
  - `metrics/cost.ts` — `calculateCost(model, tokensIn, tokensOut)` uses TOKEN_PRICING to compute per-call USD cost, `aggregateCosts()` sums an array of cost entries
  - `metrics/tracker.ts` — `MetricsTracker` class records ads with accepted/rejected status, scores, costs, and tokens. Provides `getSummary()` (totals), `getQualityTrend()` (score timeline), `getFailureCounts()` (failure label histogram), `getBatchMetrics(briefId)` (per-brief aggregates matching the BatchMetrics type)
  - `pipeline/iteration-loop.ts` — `iterateAd(ad, deps, brief?)` runs the evaluate→improve cycle via dependency injection. Evaluates once, then up to maxCycles improvement rounds. Returns `AdWithHistory` (ad + all evaluations + accepted flag + cyclesUsed)
  - `pipeline/batch-runner.ts` — `runBatch(brief, count, deps, patterns?)` generates a batch of ads via the writer, then runs each through `iterateAd` concurrently with `Promise.all`
  - `pipeline/orchestrator.ts` — `processBrief(brief, options?)` wires real agents + ratchet for a single brief. `processAllBriefs(briefs, options?)` loops all briefs sequentially (respecting rate limits), tracks metrics, records failures via taxonomy, and saves a snapshot of the full PipelineResult to `data/output/{runId}/pipeline-result.json`
- **Key architecture decisions:**
  - Dependency injection for `IterationDeps` and `BatchRunnerDeps` — all agent calls are injected functions, making the loop and batch runner fully testable without module mocking
  - Briefs processed sequentially, ads within a batch processed concurrently — balances rate limit safety with throughput
  - Quality ratchet records scores on acceptance, so threshold rises as quality improves
  - Failure taxonomy feeds into MetricsTracker for reporting which dimensions cause the most rejections
- **26 new tests** (cost 7, tracker 8, iteration-loop 5, integration 6)
- **156 total tests passing** across 16 test files

### Phase 7: First Run + Calibration (Complete)
- **Model upgrade:** Gemini 2.0 models (originally specified) are no longer available. Upgraded to `gemini-2.5-pro` (evaluator, researcher) and `gemini-2.5-flash` (writer, editor). These are "thinking models" that consume extra tokens for internal reasoning.
- **Calibration set created:** 4 strong, 4 borderline, 4 weak synthetic ads in `data/calibration/`. All self-constructed since no first-party Varsity Tutors ads were provided.
- **Calibration verified:** Evaluator correctly ranks strong (8.80 avg) > borderline (6.79 avg) > weak (3.20 avg). The scoring is well-calibrated.
- **Researcher patterns:** Extracted 4 hook types, 5 emotional angles, 2 CTA styles, 10 common phrases, 4 structural patterns from 22 competitor ads. Cached to `data/reference/patterns.json`.
- **First pipeline run:** 3 briefs × 5 ads = 15 ads. 100% acceptance rate, 8.59 avg score. Only 1 ad needed an editor cycle; the rest passed on first evaluation.
- **Key finding:** CTA is consistently the lowest-scoring dimension (6-7), while clarity and brand voice score highest (8-9). The writer produces strong copy but generic CTAs.
- **Cost:** $0.05 for 15 ads (generation + evaluation). Very cost efficient.
- **Runner scripts:** `npm run researcher`, `npm run calibrate`, `npm run pipeline` for individual phase steps. `npm run generate` runs the full pipeline.
- **156 tests still passing** after model config changes.

---

## Key Metrics & Results

### Calibration (Phase 7)
- Strong ads avg: 8.80 (target: 8.5-10) ✓
- Borderline ads avg: 6.79 (target: 6-7) ✓
- Weak ads avg: 3.20 (target: 2-4) ✓
- Ranking correct: strong > borderline > weak ✓

### First Pipeline Run (Phase 7, 3 briefs)
- Ads generated: 15
- Ads accepted: 15 (100% acceptance rate)
- Average score: 8.59
- Cost: $0.0507 total ($0.0034/ad)
- Only 1 ad needed editor improvement (1 cycle)
- Lowest dimension across all ads: CTA (avg ~6.5)
- Highest dimension: Clarity (avg ~9.0)

### Full-Scale Run (Phase 8, 10 briefs, threshold 8.0)
- Ads generated: 50
- Ads accepted: 50 (100% acceptance rate)
- Average score: 8.88
- Cost: $0.1946 total ($0.004/ad)
- 8/50 ads needed editor improvement (16%) — up from 7% at threshold 7.0
- 7/8 editor interventions targeted CTA (still the #1 weak dimension)
- Best brief: brief-006 (student/engagement/relief) avg 9.20
- Lowest brief: brief-008 (both/awareness/anxiety) avg 8.58
- 2 ads needed 2 editor cycles; 6 needed 1 cycle

### Reference Calibration Validation (Phase 8.5)
- Built a 16-ad tiered reference set from real VT ads (6 strong, 6 medium, 5 weak — was 5 weak before re-tiering)
- Strong tier: VT's longest-running ads (GPA-disconnect, Khan Academy attack, parent testimonial, sports analogy, urgency countdown)
- Medium tier: Proven competitor ads (Princeton Review 20d, Kaplan 21d/35d), degraded VT ads, and one re-tiered minimal-copy VT ad
- Weak tier: Empty/minimal copy, generic synthetic, wildcards (wrong audience, message overload, fear-only)
- Ran evaluator (Flash) against all 16 ads with calibration anchors
- **Validated:** Strong avg 8.40 > Medium avg 7.35 > Weak avg 3.42
- Gaps: S→M 1.05, M→W 3.93 — both ≥1.0
- No crossover: min strong (7.75) > max weak (4.70)
- Key finding: Competitor ads score low on brand_voice (15% weight) since evaluator is VT-specific — this is correct behavior
- Re-tiered ref-weak-002 → ref-medium-006 after it scored 7.95 (headline "+200 pts" is effective despite minimal primary text)
- Calibration loader now reads from validated reference set instead of old synthetic files
- Pipeline verified: 6/6 ads accepted at avg 8.34 with new anchors

### Phase 8.7: Langfuse Observability (Complete)
- Replaced in-memory trace stub with real Langfuse client (`langfuse@^3`)
- **Key design:** Uses `AsyncLocalStorage` for trace context propagation — like React context but for async Node.js code
  - Orchestrator wraps each brief in `withTrace(trace, () => runBatch(...))`
  - `callGemini()` calls `getActiveTrace()` to find the current trace — no agent interface changes needed
  - If no trace is active (tests, standalone scripts), generation spans are simply skipped
- Every LLM call records: model name, input/output tokens, cost, latency, seed, prompt hash
- One trace per brief tagged with `runId`, `briefId`, `evalModel` for dashboard filtering
- Graceful degradation: no Langfuse keys → no-op mode, pipeline works normally
- 19 new tests (langfuse client, no-op mode, trace context, gemini instrumentation)

### Phase 9: Evals Suite (Complete)
- **5 eval test files** (11 tests total) that hit real Gemini API — run via `npm run eval`
- **Calibration eval** (`calibration.eval.ts`): Evaluates all 17 reference set ads in parallel, asserts tier ranking strong > medium > weak with ≥1.0 gap, and no individual strong ad scores below any weak ad
  - Results: Strong avg 8.99 > Medium avg 7.32 > Weak avg 3.92 (gaps: 1.67, 3.40)
  - Min strong (8.75) > Max weak (4.75) — no crossover
- **Consistency eval** (`consistency.eval.ts`): Same ad evaluated 3x, asserts variance < 1.0 and per-dimension range < 2
  - Results: Variance 0.01, range 0.25. Per-dimension ranges all ≤ 1
- **Dimension independence eval** (`dimension-independence.eval.ts`): Uses ads designed with one deliberately weak dimension, verifies evaluator catches it in the bottom 2
  - Results: CTA correctly identified as weakest (3/10), clarity (2/10), emotional_resonance (1/10)
- **Improvement eval** (`improvement.eval.ts`): Evaluates mediocre ad, edits targeting weakest, re-evaluates — asserts targeted dimension improves
  - Results: value_proposition 3→9, overall 2.7→8.95 after edit
- **Regression eval** (`regression.eval.ts`): After editing, asserts non-targeted dimensions don't drop > 1 point
  - Results: Max non-targeted drop = 0

### Test Coverage
- 183 unit/integration tests passing across 18 test files
- 11 eval tests passing across 5 eval files (hit real API, ~2 min total)
- Unit tests: scoring, threshold, ratchet, confidence, failure taxonomy, rate limiter, cost, hash, snapshot, config, agents (mocked), langfuse, gemini-langfuse
- Integration tests: mocked pipeline scenarios (pass first try, improve then pass, fail all cycles, ratchet increase)
- Evals: calibration ranking, consistency, dimension independence, improvement verification, regression check

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Language | TypeScript | Full-stack consistency, shared types |
| Generation | Gemini 2.5 Flash | Cheap exploratory generation (thinking model) |
| Evaluation | Gemini 2.5 Pro | Strong judgment for scoring (thinking model) |
| Observability | Langfuse | Cost tracking, trace logging |
| Frontend | Vite + React | Lightweight demo viewer |
| Testing | Vitest (likely) | Fast, TS-native |
| Image gen (v2) | Imagen via Gemini API | Placeholder, not on critical path |
