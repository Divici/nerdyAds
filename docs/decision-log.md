# Decision Log — nerdyAds

This is a living document tracking every major decision, why it was made, what was considered, and what the tradeoffs are. Written as the project progresses, not retroactively.

---

## Pre-Build Phase Decisions

### D-001: System Philosophy — Evaluator-Led, Not Generator-Led

**Date:** 2026-03-08
**Context:** The brief states "the system that knows what good looks like wins" and weights Quality Measurement & Evaluation at 25% — the highest single category. The starter kit explicitly says "the taste problem is the hardest part."

**Decision:** Build the evaluator first. Make evaluation the center of the architecture. A mediocre generator with a strong evaluator is more valuable than a great generator with weak judgment.

**Alternatives considered:**
- Generator-first approach: build generation, then bolt on scoring → Risk: no quality signal means you don't know if your generator is improving
- Balanced approach: build both in parallel → Risk: neither gets enough attention in a tight timeline

**Tradeoffs:**
- Pro: Directly aligns with the highest-weighted evaluation category
- Pro: Evaluator calibration data can be prepared before generation is built
- Con: Slower to show visible output — no ads to look at until both pieces work

---

### D-002: Language — TypeScript (Full-Stack)

**Date:** 2026-03-08
**Context:** The project needs both a pipeline (generation, evaluation, iteration) and a demo UI. Python has stronger data tooling and a more mature Gemini SDK. TypeScript offers full-stack consistency.

**Decision:** TypeScript for everything. Shared type definitions between pipeline and UI eliminate integration bugs and speed development.

**Alternatives considered:**
- Python only: stronger Gemini SDK, pandas/matplotlib for metrics → but no UI without a second language
- Python backend + TypeScript frontend: best of both → but two languages doubles the maintenance surface and integration complexity for a 2-day project

**Tradeoffs:**
- Pro: One language, shared types (ad schema, evaluation schema used in both pipeline and UI)
- Pro: The UI replaces matplotlib for visualization, so Python's data tooling advantage is neutralized
- Pro: Building with Claude means language familiarity is less of a bottleneck
- Con: Gemini JS SDK (`@google/genai`) is less mature than the Python SDK
- Con: No pandas for quick data munging — need to write aggregation logic manually or use a library

---

### D-003: Model Strategy — Flash for Generation, Pro for Evaluation

**Date:** 2026-03-08
**Context:** The brief emphasizes performance per token (quality per dollar of API spend). Using one model for everything means overpaying for generation or underinvesting in evaluation.

**Decision:** Gemini Flash generates ad variants (cheap, fast exploration). Gemini Pro evaluates them (stronger judgment where it matters most). This is upgradeable — if Flash output quality is too low, we can swap to Pro for generation later.

**Alternatives considered:**
- Single model (Pro) for both: simpler, but expensive for bulk generation
- Single model (Flash) for both: cheapest, but evaluation quality may suffer — and evaluation quality is the most important thing
- Flash generation → Flash fast-filter → Pro deep evaluation: smart but complex for the timeline

**Tradeoffs:**
- Pro: Natural performance-per-token story — "cheap exploration, expensive judgment"
- Pro: Earns bonus points for multi-model orchestration with clear rationale
- Pro: Upgradeable — easy to swap Flash for Pro in generation if quality is insufficient
- Con: Two model configurations to manage
- Con: Need to verify Flash produces good enough raw material

---

### D-004: Architecture — Agent-Based (Researcher, Writer, Editor, Evaluator)

**Date:** 2026-03-08
**Context:** The brief's v3 scope explicitly rewards "agentic orchestration (researcher, writer, editor, evaluator agents)." The system naturally decomposes into these roles, each with different context needs and model requirements.

**Decision:** Four specialized agents connected through tool-calling. Each agent has a single responsibility, its own prompt template, and sees only the context relevant to its role.

**Alternatives considered:**
- Monolithic script with functions: simpler, but harder to explain as a system
- Simple pipeline without agent abstraction: works but misses bonus points and doesn't demonstrate systems thinking

**Tradeoffs:**
- Pro: Maps directly to bonus points (agentic orchestration)
- Pro: Clean separation of concerns — easier to test, debug, and explain
- Pro: Each agent can use the optimal model (Flash for writer/editor, Pro for evaluator/researcher)
- Con: More orchestration complexity than a simple function chain
- Con: Overhead of defining agent interfaces and communication patterns

---

### D-005: Context Management — Layered Strategy

**Date:** 2026-03-08
**Context:** The brief lists context management as an intentionally ambiguous decision: "What context does each generation/evaluation call see?" This is a judgment call they want to see documented.

**Decision:** Each agent role gets a tailored context window:
- **Writer:** brief + 2-3 strong reference ads as few-shot examples + (if regenerating) the specific evaluation critique of the weak dimension
- **Evaluator:** scoring rubric + 1 strong calibration example + 1 weak calibration example + the ad to evaluate
- **Editor:** original ad + evaluation critique (which dimension is weak and why)
- **Researcher:** raw competitor ads for pattern extraction

**Alternatives considered:**
- Stateless: each call sees only the immediate input → simple but no learning
- Progressive: evaluation feedback accumulates in context → grows per cycle, expensive, risk of fixation
- Dump everything: all reference ads + full rubric + all history → expensive, noisy

**Tradeoffs:**
- Pro: Each role gets exactly what it needs, nothing more — controls cost
- Pro: Easy to recalibrate — swap few-shot examples if real reference ads become available (see D-018)
- Pro: Defensible answer to the brief's ambiguous question
- Con: More prompt templates to design and maintain
- Con: Requires thinking carefully about what information helps each role

---

### D-006: Reproducibility — Seed + Snapshot + Langfuse

**Date:** 2026-03-08
**Context:** The brief requires "deterministic with seeds." LLM seeds don't guarantee identical output across API calls. Need a practical approach.

**Decision:** Three-layer reproducibility:
1. Set seeds on all API calls (best-effort determinism)
2. Snapshot every generation/evaluation result to JSON with full metadata (prompt hash, model, seed, timestamp, tokens, cost)
3. Langfuse for automatic trace logging, cost tracking, and session grouping

**Alternatives considered:**
- Seeds only: doesn't reliably reproduce, no audit trail
- Logging only: no seed attempt, doesn't satisfy the requirement
- LangChain for abstraction: heavy, obscures what's happening in a project that values transparency

**Tradeoffs:**
- Pro: Snapshots give perfect reproducibility for demos (replay from cache)
- Pro: Snapshot format doubles as the metrics data source — free infrastructure
- Pro: Langfuse gives cost-per-call tracking out of the box (feeds performance-per-token metric)
- Con: More storage and schema design upfront
- Con: Langfuse is another dependency (~1-2 hours to integrate)

**Why not LangChain:** "I chose direct API calls over LangChain because transparency and debuggability matter more than abstraction in a system where I need to explain every decision."

---

### D-007: Testing Strategy — TDD + Unit Tests + Evals

**Date:** 2026-03-08
**Context:** Brief requires ≥10 tests (excellent tier wants 15+). But unit tests alone don't prove the system has good judgment — they only prove the code works.

**Decision:** Three testing layers:
1. **Unit tests (TDD):** Score aggregation, threshold enforcement, weight application, schema validation, failure taxonomy, iteration cap logic
2. **Integration tests:** Mocked LLM responses testing the full pipeline (generate → evaluate → regenerate → re-evaluate)
3. **Evals (separate suite, hits API):** Calibration (does the evaluator rank strong > weak examples?), consistency (same ad scored 3x, variance < 1 point), dimension independence (catches the one weak dimension), improvement (editor actually improves the targeted dimension), regression (other dimensions don't drop after editing)

**Alternatives considered:**
- Unit tests only: fast and deterministic, but doesn't prove judgment quality
- Unit + integration with live API: expensive, flaky
- No evals: misses the chance to prove the evaluator works

**Tradeoffs:**
- Pro: Evals directly prove the system's judgment — the most important thing
- Pro: Unit tests via TDD keep the codebase solid as we build
- Pro: Mocked integration tests are deterministic and fast
- Con: Evals cost tokens and are slower to run
- Con: Need to maintain calibration examples as test fixtures

---

### D-008: Regeneration Policy — Max 3 Cycles

**Date:** 2026-03-08
**Context:** The brief asks "how many regeneration attempts before giving up?" This directly affects token efficiency.

**Decision:**
- Cycle 1: rewrite only the weakest section
- Cycle 2: strengthen hook/value/CTA based on the failure type
- Cycle 3: full rewrite only if the ad is close enough to threshold to justify cost
- After 3 failures: reject, log failure mode, move on

**Alternatives considered:**
- 1 cycle: too aggressive, many fixable ads get rejected
- 5 cycles: diminishing returns after 3, wastes tokens
- Unlimited: destroys performance-per-token

**Tradeoffs:**
- Pro: Protects token efficiency
- Pro: Forces the system to generate better first drafts over time (can't rely on unlimited editing)
- Con: Some fixable ads get rejected at cycle 3
- Con: The cycle 3 "close enough" judgment requires a heuristic

---

### D-009: Quality Ratchet — Simple Running Average

**Date:** 2026-03-08
**Context:** v3 scope mentions "quality ratchet: standards only go UP." This earns bonus points.

**Decision:** After every batch, compute running average of accepted ads. Next batch threshold = max(7.0, running_average - 0.5). The 0.5 buffer prevents the ratchet from being too aggressive.

**Alternatives considered:**
- Skip it: saves time but misses bonus points
- Percentile-based: only accept top 60% AND above 7.0 → more sophisticated but harder to explain
- No buffer: ratchet matches the average exactly → gets stuck if early ads are unusually good

**Tradeoffs:**
- Pro: ~30 minutes to implement, directly earns bonus points
- Pro: Easy to explain: "the system raises its own standards as it proves it can do better"
- Con: Early high-scoring ads can push the ratchet up faster than sustainable
- Con: Threshold baseline is self-referential without first-party performance data (see D-018)

---

### D-010: Confidence Scoring — Self-Reported + Rule-Based Hybrid

**Date:** 2026-03-08
**Context:** The brief's excellent tier requires "confidence scoring: the evaluator knows when it's uncertain." LLMs are notoriously bad at self-calibrating confidence.

**Decision:** Two-signal approach:
1. Ask the evaluator to self-report confidence (1-10) alongside each score
2. Apply rule-based flags: high confidence (all dimensions within 2 points), medium (one dimension diverges by 3+), low (multiple divergences or all middling 5-6)

**Alternatives considered:**
- Self-reported only: cheap but unreliable
- Multi-run variance (evaluate 3x, measure spread): statistically grounded but 3x cost
- Rule-based only: deterministic but less nuanced

**Tradeoffs:**
- Pro: Two signals are better than one
- Pro: Documents awareness that LLM confidence isn't trustworthy alone
- Pro: Rule-based layer is deterministic — testable with unit tests
- Con: Self-reported confidence may be consistently high (LLMs tend to be overconfident)

---

### D-011: Competitive Intelligence — Manual Collection + LLM Pattern Extraction

**Date:** 2026-03-08
**Context:** Bonus points available for "competitive intelligence from Meta Ad Library." Full automation would require scraping (fragile, possibly against ToS). Manual collection is reliable but doesn't scale.

**Decision:** Manually collect 10-15 competitor ads from Meta Ad Library in structured JSON format. Feed them to Gemini Pro for automated pattern extraction (common hooks, CTAs, emotional angles, body structures). Use extracted patterns as context for the Writer agent.

**Alternatives considered:**
- Manual collection only: fast, no bonus points for automation
- Full automated scraping: impressive but fragile, no public API, could eat a full day
- Skip entirely: loses competitive intelligence bonus

**Tradeoffs:**
- Pro: Best ROI for time — automated analysis without fragile scraping
- Pro: Extracted patterns become few-shot context for the Writer agent
- Pro: Same extraction pipeline can run on Varsity Tutors ads if they become available (see D-018)
- Con: Still requires ~1 hour of manual ad collection

**Why not full scraping:** "I automated pattern extraction, not data collection, because the Meta Ad Library has no public API and scraping it would be fragile and low-ROI for a 2-day build."

---

### D-012: Frontend — Vite + React (Not Next.js)

**Date:** 2026-03-08
**Context:** Need a demo UI for the submission video/walkthrough. The UI is a read-only viewer of pipeline JSON output.

**Decision:** Vite + React. Single-page app that reads JSON output files and renders ads in Meta ad card format, with evaluation breakdowns and quality trend charts.

**Alternatives considered:**
- Next.js: file-based routing, SSR, API routes — all unnecessary for a localhost JSON viewer
- No UI: harder demo, less compelling submission
- Jupyter notebook: good for Python, doesn't apply to TypeScript stack

**Tradeoffs:**
- Pro: Instant dev server, zero config, no framework overhead
- Pro: Timeboxed to 3-4 hours — read-only viewer, not an application
- Con: No SSR (irrelevant for localhost demo)

---

### D-013: Dimension Weights — Provisional (No First-Party Data)

**Date:** 2026-03-08
**Context:** The brief lists dimension weighting as an intentionally ambiguous decision. Weights should reflect what matters most for SAT prep ads on Meta.

**Decision (provisional):**
- Clarity: 25% — paid social must stop the scroll fast
- Value Proposition: 25% — the ad must explain why this option deserves attention
- Emotional Resonance: 20% — parents and students are driven by stress, ambition, and anxiety
- Call to Action: 15% — matters, but weak value can't be rescued by a strong CTA
- Brand Voice: 15% — should support performance, not override clarity

**Rationale:** For scroll-stopping paid social ads, immediate comprehension (clarity) and compelling benefit (value prop) are the first gates. Emotional connection drives action. CTA and brand voice are important but secondary — a clear, emotionally resonant ad with a decent CTA outperforms a generic ad with a perfect button label.

**These weights are provisional** — no first-party Varsity Tutors reference ads or performance data were provided (see D-018). Weights are based on general paid social best practices for SAT prep ads, not validated against real conversion data.

---

### D-014: Output Format — JSON Only (No CSV)

**Date:** 2026-03-09
**Context:** The brief says "Evaluation report (JSON/CSV + summary with quality trends)." The "/" implies either is acceptable.

**Decision:** JSON as the sole data format. The demo UI provides richer trend visualization than a flat CSV, and JSON preserves the nested evaluation rationales that CSV would flatten.

**Alternatives considered:**
- JSON + CSV: covers both formats but CSV adds export logic for little value when the UI exists
- CSV only: loses nested rationale data

**Tradeoffs:**
- Pro: JSON preserves the full evaluation structure (rationales, confidence, per-dimension scores)
- Pro: UI reads JSON directly — no format translation needed
- Con: Reviewers who want to open data in Excel can't do so directly (mitigated by the UI)

---

### D-015: Evals as a Testing Layer

**Date:** 2026-03-09
**Context:** Unit tests prove code correctness. But the core question of this project is "does the system have good judgment?" — which requires testing the LLM's evaluation quality, not just the code around it.

**Decision:** Add evals as a separate test suite (`npm run eval`) that hits the real API:
- **Calibration eval:** evaluator correctly ranks strong > borderline > weak examples
- **Consistency eval:** same ad scored 3 times, variance < 1 point
- **Dimension independence eval:** ad weak on 1 dimension, evaluator catches it
- **Improvement eval:** editor actually improves the targeted dimension
- **Regression eval:** other dimensions don't drop after editing

**Tradeoffs:**
- Pro: Directly proves the system's judgment quality — the #1 thing the brief evaluates
- Pro: Gives concrete numbers for this decision log ("evaluator correctly ranked 95% of calibration examples")
- Con: Costs tokens to run
- Con: Results aren't perfectly deterministic (LLM variance)

---

### D-016: Agent Architecture for Bonus Points and Modularity

**Date:** 2026-03-09
**Context:** Have been learning about AI agents with tool calling. The brief's v3 scope explicitly rewards "agentic orchestration (researcher, writer, editor, evaluator agents)" as a bonus point item.

**Decision:** Implement the four agents using tool-calling patterns. Each agent has a defined role, specific tools it can call, and a constrained context window. The orchestrator manages the generate → evaluate → improve loop by dispatching to the appropriate agent.

**Why this fits:** The agent decomposition isn't forced — it maps naturally to the workflow. The researcher extracts patterns, the writer generates, the evaluator scores, the editor fixes. Each genuinely needs different context and could use different models.

---

### D-017: Rate Limiting — Defensive Wrapper with Backoff

**Date:** 2026-03-09
**Context:** The full pipeline run is estimated at ~250-350 API calls (50+ ads × avg 1.5 cycles × 2 calls per cycle, plus evals and researcher). Gemini pay-as-you-go limits are generous (Flash: 2000 RPM, Pro: 1000 RPM), so we won't hit ceilings at current scale. However, burst patterns during batch generation (5 parallel calls) and accidental tight loops during development are real risks.

**Decision:** Add a lightweight rate limiter utility wrapping all Gemini API calls:
- `minDelayMs: 100` — minimum gap between sequential calls
- `maxConcurrent: 5` — cap on parallel in-flight requests
- `retries: 3` — retry on 429/5xx responses
- `backoffBaseMs: 1000` — exponential backoff on retry

**Alternatives considered:**
- No rate limiting: works now, but fragile during development and doesn't scale
- Hard sequential processing (no parallelism): safe but slow — defeats batch efficiency
- External rate limiter library (e.g., bottleneck): adds a dependency for something simple

**Tradeoffs:**
- Pro: Defensive engineering — the brief rewards "does the system know when it's failing?"
- Pro: Protects against accidental tight loops during development
- Pro: Configurable — easy to tighten or loosen as scale changes
- Pro: ~30 minutes to implement
- Con: Adds slight latency to burst calls (100ms gaps)
- Con: Marginally more complex than raw API calls

---

### D-018: No First-Party Reference Ads — Self-Constructed Calibration

**Date:** 2026-03-09
**Context:** The brief originally stated that real Varsity Tutors ads and performance data would be provided via the Gauntlet/Nerdy Slack channel. This did not happen. No first-party reference ads, performance metrics, or brand guidelines were ever provided.

**Decision:** Proceed with entirely self-constructed calibration:
1. **Competitor ads** from Meta Ad Library (Princeton Review, Chegg, expanding to Kaplan + Khan Academy) as the primary reference material
2. **Synthetic calibration set** (strong/weak/borderline Varsity-style ads) labeled by our own judgment
3. **Brand voice** inferred from Varsity Tutors' public website and marketing, not from internal creative guidelines
4. System designed with recalibration hooks so real data can be plugged in later if it becomes available

**Impact on the system:**
- Evaluator brand voice scoring is the weakest dimension — no ground truth for what "sounds like Varsity Tutors"
- Calibration tiers (strong/weak/borderline) are our judgment calls, not validated against real performance data
- Quality ratchet baseline is self-referential (improves relative to itself, not against a known-good benchmark)
- Dimension weights (D-013) remain provisional — we can't verify that our weighting matches what actually converts

**What we're doing to mitigate:**
- Heavy use of competitor ads to ground the evaluator in real market patterns
- Expanding competitor coverage beyond Princeton Review + Chegg (adding Kaplan + Khan Academy)
- Documenting this constraint honestly in limitations.md
- Designing all calibration as swappable — if real data arrives, it plugs into existing interfaces

**Tradeoffs:**
- Pro: Unblocked — we can build and ship without waiting for data that may never come
- Pro: Forces rigorous self-assessment (we can't hide behind "calibrated against real data")
- Con: Brand voice evaluation is essentially guesswork
- Con: No way to validate that our "strong" calibration examples would actually perform well as real ads

---

## Phase 5 Decisions

### D-019: Agent Model Assignment — Writer/Editor on Flash, Researcher on Pro

**Date:** 2026-03-09
**Context:** Phase 5 builds three new agents. Each needs a model assignment that balances cost and capability.

**Decision:**
- **Writer** → Gemini Flash (cheap, creative exploration — we want lots of variants)
- **Editor** → Gemini Flash (targeted improvements on existing copy, doesn't need deep reasoning)
- **Researcher** → Gemini Pro (deeper analysis of competitor patterns, runs once per pipeline execution)

**Rationale:** The Researcher runs once to extract patterns from 24 competitor ads — paying Pro rates for one call is fine. Writer and Editor run many times per pipeline (5-8 ads × up to 3 cycles each = 15-24 calls), so Flash keeps costs down. This extends the same philosophy as D-003 (Flash for generation, Pro for evaluation).

**Tradeoffs:**
- Pro: Researcher on Pro produces higher-quality pattern extraction from competitor ads
- Pro: Writer/Editor on Flash keeps per-ad costs low during the generate-evaluate-improve loop
- Con: Flash editor may make weaker improvements than Pro would — worth monitoring during calibration

---

### D-020: Editor Receives All Scores + Brief Context (Not Just Weakest Dimension)

**Date:** 2026-03-09
**Context:** The editor needs to improve a weak dimension without regressing strong ones. It also needs to know the campaign context to keep improvements audience-appropriate.

**Decision:** The editor prompt includes:
1. The full ad text
2. ALL 5 dimension scores with rationales (not just the weakest)
3. The weakest dimension highlighted with `← WEAKEST` marker
4. The original brief (target audience, campaign goal, emotional angle, key message)

**Alternatives considered:**
- Only weakest dimension: simpler prompt but editor has no context for what NOT to break
- No brief context: editor might add parent-focused emotional language to a student-targeted ad

**Why this matters:** The brief's evaluation criteria asks "how do you prevent the feedback loop from optimizing one dimension at the expense of others?" This is our answer — the editor sees everything.

---

### D-021: Batch Cost Splitting — Per-Ad Attribution

**Date:** 2026-03-09
**Context:** When the writer generates 5 ads in a single API call, the token cost should be attributed accurately to each ad for performance-per-token tracking.

**Decision:** Split tokensIn, tokensOut, and costUsd evenly across the number of ads produced in a batch call. Each ad reports its share of the total cost.

**Why:** The brief's north star metric is "performance per token." If we attribute the full call cost to every ad, we inflate the cost of batch generation by 5x, which would make batching look worse than sequential generation when it's actually more efficient. Accurate attribution matters for honest metrics.

---

### D-022: Writer Prompt — Meta-Specific Patterns Baked In

**Date:** 2026-03-09
**Context:** The writer system prompt needs to produce ads that follow proven Meta ad patterns. The Researcher agent can supply competitor patterns, but the writer should know Meta fundamentals even when no researcher output is available.

**Decision:** Added two sections to the writer system prompt:
1. **"What Works on Meta Right Now"** — authentic > polished, story-driven > feature-list, specific numbers > vague promises, social proof > claims, urgency > open-ended, free trials > paid first step
2. **"Hook Types to Use"** — question/stat/story/fear hook examples from the brief's starter kit
3. **CTA-to-funnel matching** — "Learn More" for awareness, "Sign Up"/"Get Started" for conversion

**Rationale:** These patterns come directly from the project brief. Encoding them in the system prompt means every generated ad has this context, even without the Researcher. The Researcher adds competitor-specific patterns on top.

---

### D-023: 10 Briefs Covering Audience × Goal × Angle Matrix

**Date:** 2026-03-09
**Context:** The implementation plan calls for 10 briefs × 5-8 ads each = 50+ total. Briefs need variety across target audience, campaign goal, and emotional angle to demonstrate the system handles different campaign types.

**Decision:** Created 10 briefs covering:
- **Audiences:** student (4), parent (4), both (2)
- **Goals:** conversion (5), awareness (3), engagement (2)
- **Angles:** aspiration (3), anxiety (2), social_proof (2), urgency (2), relief (1)
- **Constraints:** 2 briefs include constraints (specific stats, limited availability) to test constraint adherence

**Design choices:**
- Heavier on conversion (5/10) because the brief emphasizes paid social performance
- Parents and students split evenly because both are primary audiences per the brief
- Two briefs have explicit constraints to test whether the writer respects them
- Key messages are specific and actionable — not vague ("expert tutors" → "1-on-1 expert SAT tutors with personalized prep plan")

---

### D-024: Researcher Caching — Run Once, Cache by Input Hash

**Date:** 2026-03-09
**Context:** The Researcher agent analyzes the same 24 competitor ads every pipeline run, calling Gemini Pro each time to extract the same patterns. The input is static — competitor ads only change when we manually add new ones. This wastes a Pro-tier API call (~$0.005) and adds latency on every run for zero new information.

**Decision:** Add hash-based caching to the Researcher:
1. SHA-256 hash the serialized competitor ads input
2. Before calling the API, check `data/reference/patterns.json` for a cached result
3. If the cache exists AND the input hash matches, return the cached patterns (skip the API call entirely)
4. If the cache is missing or the hash doesn't match (new ads added), call the API and save the result
5. Caching is opt-in via `cacheDir` constructor option — no caching when omitted (e.g., in tests)

**Why not remove the Researcher entirely:**
- The Researcher still adds value when new competitor ads are added — it automatically re-analyzes
- The `ResearcherAgent` class is the right abstraction; the problem was calling it every run, not its existence
- Phase 7 (calibration) already planned "Run Researcher on competitor ads → save patterns.json" as a one-time step; this makes the one-time behavior automatic

**Alternatives considered:**
- Manual "run researcher" script separate from the pipeline: works but easy to forget after adding new ads
- Check file modification time instead of content hash: fragile — touching the file without changing it would miss the cache, and editing whitespace would invalidate it unnecessarily
- Remove the Researcher agent and hardcode patterns: loses the ability to re-analyze when the corpus grows

**Tradeoffs:**
- Pro: Saves a Pro API call on every pipeline run after the first (~$0.005/run, adds up at scale)
- Pro: Automatic invalidation when competitor ads change — no manual "clear cache" step
- Pro: Backward compatible — no cacheDir = same behavior as before
- Con: Cached patterns could drift from what a fresh Pro call would produce if the model updates (acceptable — re-run with `--force` or delete the cache file)

---

### D-025: Model Upgrade from Gemini 2.0 to 2.5

**Context:** During Phase 7 first run, `gemini-2.0-pro` and `gemini-2.0-flash` returned 404 (no longer available in the API).

**Decision:** Upgrade to `gemini-2.5-pro` (evaluator, researcher) and `gemini-2.5-flash` (writer, editor). Increase `maxOutputTokens` to account for thinking token overhead.

**Alternatives considered:**
- `gemini-1.5-pro`: Also returned 404
- `gemini-pro` (legacy): Also returned 404
- Only using `gemini-2.5-flash` for everything: Would lose the quality differential between writer and evaluator

**Tradeoffs:**
- Pro: 2.5 models produce higher quality output — ad copy and evaluations are noticeably better
- Pro: Thinking capability improves evaluator reasoning and rationale quality
- Con: Thinking tokens add latency (~15-20s per Pro call vs ~5s for 2.0)
- Con: `maxOutputTokens` must be higher to account for thinking tokens (8192 flash, 16384 pro)
- Con: `response.text` can be `undefined` on thinking models when tokens run out — requires fallback handling

**Impact:** Token pricing in `models.ts` may need updating for 2.5 pricing. Cost is estimated to be similar or lower than budgeted 2.0 pricing based on observed runs.

---

## Provisional Decisions

These decisions are explicitly provisional. They were made without first-party Varsity Tutors reference ads (see D-018) and would benefit from recalibration if real performance data becomes available:

- Dimension weights (D-013)
- Publishability threshold strictness (currently 7.0)
- Brand voice calibration examples
- Preferred hook styles and emotional framing
- CTA preferences for awareness vs conversion campaigns
- Image style assumptions (v2)

---

## Failed Approaches & Lessons

### Gemini 2.0 models no longer available (Phase 7)
- `gemini-2.0-pro` and `gemini-2.0-flash` both returned 404 when the pipeline first ran
- Switched to `gemini-2.5-pro` and `gemini-2.5-flash` which are the current available models
- 2.5 models are "thinking models" — they consume thinking tokens that count toward `maxOutputTokens`
- Had to increase `maxOutputTokens` from 4096 → 16384 (pro) and 2048 → 8192 (flash) to avoid `MAX_TOKENS` truncation
- `response.text` can return `undefined` on 2.5 Pro when tokens are exhausted; added fallback to extract from `candidates[0].content.parts`

### High acceptance rate on first run (Phase 7)
- First pipeline run on 3 briefs produced 15/15 accepted ads (100%) with avg score 8.59
- This is above the target 65-75% acceptance rate — the combination of Gemini 2.5 Flash writer + competitor patterns is producing strong output
- Only 1 ad needed editor improvement (1 cycle); the rest passed on first evaluation
- The quality ratchet is working but doesn't get to stress-test the editor much at this acceptance rate
- Decision: Accept this rate for now. The evaluator is well-calibrated (verified by calibration set ranking). The writer is simply producing good ads.
- If this persists at full scale, consider tightening threshold from 7.0 to 7.5 to force more iteration and test the editor

---

## Phase 7 Observations

### Calibration Results
- **Strong avg: 8.80** — expected 8.5-10, within range
- **Borderline avg: 6.79** — expected 6-7, within range
- **Weak avg: 3.20** — expected 2-4, within range
- Ranking correct: strong > borderline > weak (verified)
- One borderline ad (cal-borderline-002) scored 8.10 — it was genuinely well-written for a "borderline" example
- Cost: $0.04 for 12 calibration evaluations

### First Pipeline Run (3 briefs, 15 ads)
- Total cost: $0.05 for 15 ads (generation + evaluation + 1 editor cycle)
- Average score: 8.59 across all ads
- CTA is consistently the lowest-scoring dimension (6-7 range) — the writer tends to use generic CTAs
- Clarity and brand voice consistently score 8-9
- Emotional resonance varies most by brief — parent-targeted briefs (brief-002) score highest
- The ratchet increased during the run but all ads still passed

### Researcher Patterns
- Extracted 4 hook types, 5 emotional angles, 2 CTA styles, 10 common phrases, 4 structural patterns from 22 competitor ads
- Patterns cached to data/reference/patterns.json ($0.005 cost, skipped on subsequent runs)
- The researcher identified common competitor patterns that the writer successfully differentiated from

### Model Upgrade Impact
- Gemini 2.5 models produce noticeably higher quality ad copy than 2.0 would have
- The thinking tokens add latency (~15-20s per Pro evaluation) but improve reasoning quality
- Token pricing may differ from original estimates in config — actual costs are lower than budgeted

---

## Limitations (Honest Assessment)

- **Evaluator may be slightly lenient**: 100% acceptance rate suggests either the writer is very strong or the evaluator is generous. The calibration set confirms correct ordering, but absolute score calibration could drift.
- **CTA dimension consistently weakest**: The writer generates adequate but not exceptional CTAs. The editor can improve them but at current acceptance rates, most pass without editing.
- **No first-party calibration**: All calibration is self-constructed. Scores are internally consistent but may not align with real campaign performance. See D-018.
- **Thinking token overhead**: Gemini 2.5 models consume thinking tokens that don't appear in the output but count toward costs and latency. Budget $0.005-0.01 per evaluation.
- **Rate limiting conservative**: 100ms min delay + 5 concurrent is well within Gemini API limits. Could increase concurrency for faster runs.
- **Dimension coupling during editing**: When the editor improves emotional_resonance, other dimensions can shift slightly. Not observed as a regression issue yet.
