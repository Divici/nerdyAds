# Technical Writeup — nerdyAds

An autonomous ad generation engine for Varsity Tutors SAT test prep campaigns on Facebook and Instagram.

## The Problem

Most AI-generated ad copy is generic. It reads like a template, uses vague CTAs ("Learn More"), and lacks the emotional specificity that makes parents click. The challenge: build a system that generates ad copy, knows the difference between good and bad, surfaces only its best work, and improves per token spent.

## Architecture

Four specialized agents connected through an orchestrator, each using the model best suited to its role:

| Agent | Model | Role |
|-------|-------|------|
| Researcher | Gemini Pro | Extracts patterns (hook types, emotional angles, CTA styles) from 65 real competitor ads scraped from Meta Ad Library |
| Writer | Gemini Flash | Generates ad copy in batches of 3, using briefs + few-shot reference examples |
| Evaluator | Gemini Pro or Flash | Scores each ad across 5 weighted dimensions with written rationales |
| Editor | Gemini Flash | Reads the evaluation critique, rewrites only the weakest dimension |

The key insight: **the evaluator is the center of the architecture, not the generator.** A mediocre generator with a strong evaluator produces better output than a great generator with no quality filter, because the evaluator catches and rejects weak work. This directly follows the project brief's guidance: "the system that knows what good looks like wins."

## Pipeline Design

The pipeline runs as a continuous small-batch loop rather than a fixed-size batch:

1. Writer generates 3 ads from a brief (audience + goal + emotional angle + offer)
2. Evaluator scores all 5 dimensions (clarity 25%, value proposition 25%, emotional resonance 20%, CTA 15%, brand voice 15%)
3. Ads scoring ≥7.5 weighted average with every dimension ≥6.0 are accepted
4. Failing ads go to the Editor for up to 3 improvement cycles
5. Still-failing ads are discarded — the system generates replacements, not infinite rewrites
6. Loop continues until 6 ads are accepted per brief or 10 rounds elapse

This produces both an accepted library and a visible rejection history. The system generated 120+ ads across 10 briefs, rejected ~55, accepted 65+. The rejection rate is the quality signal — it proves the evaluator is filtering, not rubber-stamping.

A quality ratchet prevents regression: as accepted ad quality rises, the threshold rises too (running average minus 0.5, minimum 7.5). Standards only go up.

## Evaluator Calibration

The evaluator is calibrated against a 16-ad tiered reference set built from real ads:

- **Strong tier** (avg 8.40): Varsity Tutors' longest-running ads from Meta Ad Library — GPA-SAT disconnect messaging, Khan Academy competitive positioning, parent testimonials with 360-point improvement claims
- **Medium tier** (avg 7.35): Proven competitor ads (Kaplan 35-day longevity, Princeton Review 20-day) plus degraded VT ads with weakened hooks and generic CTAs
- **Weak tier** (avg 3.42): VT minimal-copy ads (empty primary text, trust-metric-only), wildcard bad ads (wrong audience tone, competing messages, fear without solution)

Validation: strong avg > medium avg > weak avg with ≥1.0 point gaps, no individual strong ad scoring below any weak ad. One crossover was found during validation (a "weak" ad with more copy than expected) and re-tiered to medium with documented rationale (D-029).

## Key Technical Decisions

**Flash for generation, Pro for evaluation (D-003).** Generation is cheap exploration — you want many candidates fast. Evaluation is expensive judgment — you want accurate scoring. This natural split optimizes performance per token: ~$0.004 per accepted ad.

**Continuous small-batch over fixed-batch (D-031).** Fixed batches of 5-8 ads with 3 editor cycles produced 85-100% acceptance — the system never rejected anything. Small batches with discard-and-replace creates genuine filtering. The `costPerAcceptedAd` metric makes the cost of quality visible.

**SSE streaming for live generation (D-032).** The UI shows ads being generated, evaluated, accepted, and rejected in real-time via Server-Sent Events. This is the most compelling demo feature — watching the system make quality judgments live. SSE was chosen over WebSocket because updates are one-directional (server → client).

**AsyncLocalStorage for Langfuse tracing (D-030).** Zero modifications to agent interfaces. The orchestrator wraps each brief in a trace context; `callGemini()` reads the active trace via Node.js async context propagation. When no trace is active (tests, standalone scripts), tracing is silently skipped.

## Testing

240 tests across 3 tiers:

- **229 unit/integration tests** — scoring math, threshold enforcement, agent response parsing, API endpoints, pipeline scenarios with mocked Gemini responses
- **11 eval tests** — hit the real Gemini API to validate: calibration ranking (strong > medium > weak), consistency (same ad 3x, variance 0.01), dimension independence, editor improvement (targeted dimension 3→9), regression (no dimension drops >1 point after editing)

TDD throughout: every feature started with a failing test. The eval suite runs separately (`npm run eval`) because it hits real APIs and takes ~2 minutes.

## Results

| Metric | Value |
|--------|-------|
| Total ads generated | 120+ |
| Accepted (final library) | 65+ across 10 briefs |
| Average accepted score | 8.88 |
| Cost per accepted ad | ~$0.004 |
| Total pipeline cost | $0.19 (full 10-brief run) |
| Calibration gaps | Strong→Medium: 1.05, Medium→Weak: 3.93 |
| Evaluator consistency | Variance 0.01 on repeated scoring |
| Editor improvement | +0.81 points average lift |

## What Doesn't Work Well

**CTA is the persistent weak dimension.** 67% of editor interventions target CTA. The writer generates strong hooks and value propositions but defaults to generic calls-to-action.

**Flash evaluator is too lenient.** In Quick mode, nearly every ad passes. The scores have less variance between good and mediocre copy. Quality mode (Pro evaluator) is needed for meaningful filtering.

**Dimension coupling during editing.** Improving one dimension sometimes weakens another (~5% of edited ads regress). The editor rewrites the full ad rather than surgically fixing one section.

**No real performance data.** Longevity (days active) is our best proxy for ad quality. The system is designed to recalibrate when real CTR/conversion data becomes available.

Full limitations documented in [limitations.md](limitations.md).

## Tech Stack

TypeScript full-stack. Gemini 2.5 Flash/Pro via `@google/genai`. Vite + React + Tailwind + Recharts for the UI. Express + SSE for real-time streaming. Langfuse for observability and cost tracking. Vitest for testing. Zod for runtime validation of LLM outputs. Deployed on Railway.

34 architectural decisions documented in [decision-log.md](decision-log.md) with alternatives considered, tradeoffs, and rationale.
