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
- Pro: Easy to recalibrate — swap few-shot examples when reference ads arrive
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
- Con: Reset needed when reference ads arrive and thresholds are recalibrated

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
- Pro: When Varsity reference ads arrive, same extraction pipeline runs on them for comparison
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

### D-013: Dimension Weights — Provisional Until Reference Ads Arrive

**Date:** 2026-03-08
**Context:** The brief lists dimension weighting as an intentionally ambiguous decision. Weights should reflect what matters most for SAT prep ads on Meta.

**Decision (provisional):**
- Clarity: 25% — paid social must stop the scroll fast
- Value Proposition: 25% — the ad must explain why this option deserves attention
- Emotional Resonance: 20% — parents and students are driven by stress, ambition, and anxiety
- Call to Action: 15% — matters, but weak value can't be rescued by a strong CTA
- Brand Voice: 15% — should support performance, not override clarity

**Rationale:** For scroll-stopping paid social ads, immediate comprehension (clarity) and compelling benefit (value prop) are the first gates. Emotional connection drives action. CTA and brand voice are important but secondary — a clear, emotionally resonant ad with a decent CTA outperforms a generic ad with a perfect button label.

**These weights will be updated** when first-party Varsity Tutors reference ads arrive and we can calibrate against real performance data.

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

## Provisional Decisions (To Be Updated)

These decisions are explicitly provisional and will be revisited when first-party Varsity Tutors reference ads arrive:

- Dimension weights (D-013)
- Publishability threshold strictness (currently 7.0)
- Brand voice calibration examples
- Preferred hook styles and emotional framing
- CTA preferences for awareness vs conversion campaigns
- Image style assumptions (v2)

---

## Failed Approaches & Lessons

*To be updated during implementation. This section will document what was tried, what didn't work, and why.*

---

## Limitations (Honest Assessment)

*To be updated during implementation. Will include:*
- Evaluator reliability bounds
- Known calibration gaps without first-party data
- Dimension coupling during regeneration
- Flash vs Pro quality differential observations
- Rate limiting constraints and workarounds
