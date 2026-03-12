# nerdyAds

An autonomous ad generation engine for Varsity Tutors (Nerdy) that creates Facebook/Instagram ad copy for SAT test prep campaigns. It generates ads, evaluates them across 5 quality dimensions, rejects weak ones, improves promising ones through targeted regeneration, and tracks performance per token spent.

## Docs

- [Project Brief](NerdyProjectBrief.md) — full requirements, evaluation criteria, and starter kit
- [Pre-Research](PRESEARCH.md) — competitive analysis and approach planning done before building
- [Decision Log](docs/decision-log.md) — 34 decisions with full rationale, alternatives considered, and tradeoffs

## Quick Start

```bash
# Install dependencies
npm install
cd ui && npm install && cd ..

# Add your API key
cp .env.example .env
# Edit .env: set GEMINI_API_KEY (required), LANGFUSE_* keys (optional)

# Run tests
npm test

# Start the UI (API server + Vite dev server)
npm run ui:dev
# Open http://localhost:5173
```

## How It Works

Four specialized AI agents connected through an orchestrator:

1. **Researcher** (Gemini Pro) — extracts patterns from 65 real competitor ads scraped from Meta Ad Library
2. **Writer** (Gemini Flash) — generates ad copy in batches of 3, using briefs + few-shot reference examples
3. **Evaluator** (Gemini Pro or Flash) — scores each ad across 5 dimensions with written rationales
4. **Editor** (Gemini Flash) — reads the evaluation critique, rewrites only what's broken

The pipeline runs continuously: generate a batch, evaluate, fix failures (up to 3 editor cycles), discard unfixable ads, generate more — until 6 ads are accepted per brief or 10 rounds elapse.

### Quality Dimensions (weighted)

| Dimension | Weight | What It Measures |
|-----------|--------|-----------------|
| Clarity | 25% | Is the message immediately understandable? |
| Value Proposition | 25% | Does it communicate a compelling, specific benefit? |
| Emotional Resonance | 20% | Does it connect to real motivation (parent worry, student ambition)? |
| Call to Action | 15% | Is the next step clear and low-friction? |
| Brand Voice | 15% | Does it sound like Varsity Tutors? |

Acceptance requires a **7.5+ weighted average** with **every dimension above 6.0**.

### Evaluator Calibration

The evaluator is calibrated against a 16-ad tiered reference set built from real Varsity Tutors ads (from Meta Ad Library) and competitor ads with longevity data:

- **Strong tier** (avg 8.40): VT's longest-running ads — GPA-SAT disconnect, Khan Academy attack, parent testimonials
- **Medium tier** (avg 7.35): Proven competitor ads (Kaplan 35d, Princeton Review 20d) + degraded VT ads
- **Weak tier** (avg 3.42): Minimal-copy VT ads, wildcard bad ads (wrong audience, competing messages)

No individual strong ad scores below any weak ad. Gaps between tiers are 1.0+ points.

## Scripts

| Command | Description |
|---------|-------------|
| `npm test` | Run all 240 tests (unit + integration + evals) |
| `npm run test:unit` | Unit tests only |
| `npm run test:integration` | Integration tests only |
| `npm run eval` | Eval tests — hits real Gemini API (~2 min) |
| `npm run ui:dev` | Start API server + Vite dev server |
| `npm run pipeline` | Run the full ad generation pipeline |
| `npm run researcher` | Extract patterns from competitor ads |
| `npm run calibrate` | Run evaluator against calibration set |
| `npm run calibrate:ref` | Validate evaluator against reference set tiers |
| `npm run build:prod` | Build frontend for production |
| `npm run start:prod` | Start production server (serves API + static UI) |

## Architecture

```
src/
  agents/          # researcher, writer, editor, evaluator
  pipeline/        # orchestrator, iteration-loop, batch-runner
  evaluate/        # scoring, threshold (quality ratchet), failure-taxonomy
  metrics/         # tracker, cost
  types/           # ad, brief, evaluation, pipeline, patterns (Zod schemas)
  config/          # weights, thresholds, models, prompts
  utils/           # gemini-client, rate-limiter, snapshot, langfuse, logger, hash
  server/          # Express API with SSE streaming
ui/                # Vite + React + Tailwind + Recharts + Framer Motion
data/
  reference/       # competitor_ads.json (65 ads), reference-set.json (16-ad calibration set)
  briefs.json      # 10 briefs covering audience x goal x angle matrix
tests/
  unit/            # 20 test files — scoring, agents, config, utils, API
  integration/     # pipeline scenarios with mocked agents
  evals/           # 5 eval files hitting real Gemini API
```

## Demo UI

The UI is a live-generation interface styled to match Varsity Tutors branding. Three tabs:

- **Campaign** — select a brief, generate ads in real-time via SSE streaming, watch cards get dealt, scored, accepted/rejected
- **Insights** — radar chart (dimension averages), bar chart (per-brief results), quality trend line, cost metrics
- **Previous Runs** — browse historical pipeline results

Two generation modes:
- **Quick** (Flash evaluator, 7.5 threshold) — fast iteration, ~30s per brief
- **Quality** (Pro evaluator, 8.0 threshold) — stricter scoring, ~2 min per brief

## Key Results

| Metric | Value |
|--------|-------|
| Total tests | 240 (229 unit/integration + 11 eval) |
| Full-scale run (10 briefs) | 50 ads accepted, avg score 8.88, cost $0.19 |
| Calibration validated | Strong 8.40 > Medium 7.35 > Weak 3.42, no crossover |
| Evaluator consistency | Same ad 3x: variance 0.01, per-dimension range < 1 |
| Editor improvement | Targeted dimension: 3 to 9 after edit, zero regressions |
| Cost per ad | ~$0.004 |

## Tech Stack

- **TypeScript** full-stack (pipeline + UI, shared types)
- **Gemini 2.5 Flash** for generation (writer, editor)
- **Gemini 2.5 Pro** for evaluation and research
- **Vite + React + Tailwind + Recharts + Framer Motion** for the UI
- **Express + SSE** for real-time streaming
- **Langfuse** for observability and cost tracking
- **Vitest** for testing (unit, integration, evals)
- **Zod** for runtime validation of LLM outputs
- **Railway** for deployment

## Limitations

- **No real performance data.** Evaluator is calibrated against ad longevity (days active) as a proxy — no CTR, conversion, or ROAS data was available.
- **CTA dimension consistently weakest.** The writer generates strong copy but generic calls-to-action. 67% of editor interventions target CTA.
- **Flash evaluator is lenient.** In Quick mode, most ads pass — use Quality mode for meaningful rejection rates.
- **Dimension coupling during editing.** Improving emotional resonance sometimes weakens clarity. The regression eval catches this but the editor doesn't always avoid it.
- **LLM seed non-determinism.** Seeds are set on all API calls but Gemini doesn't guarantee identical output across runs. Snapshots provide exact reproducibility.
- **Self-reported confidence.** LLMs are notoriously bad at knowing when they're uncertain. Rule-based flags layer on top, but confidence scores are directional, not precise.

## Environment

Requires Node.js 20+. API key in `.env`:

```
GEMINI_API_KEY=your-key-here

# Optional — Langfuse observability
LANGFUSE_SECRET_KEY=sk-...
LANGFUSE_PUBLIC_KEY=pk-...
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
```

## Key Files

**Prompts (what the LLMs actually see):**
- [src/config/prompts.ts](src/config/prompts.ts) — all system prompts and user prompt builders for every agent (writer, evaluator, editor, researcher), including the full 5-dimension rubric, cliche blacklist, few-shot section builder, and JSON output schemas

**Agents:**
- [src/agents/writer.ts](src/agents/writer.ts) — generates ad copy batches via Gemini Flash
- [src/agents/evaluator.ts](src/agents/evaluator.ts) — scores ads across 5 dimensions via Gemini Pro
- [src/agents/editor.ts](src/agents/editor.ts) — targeted rewrites of weak dimensions
- [src/agents/researcher.ts](src/agents/researcher.ts) — extracts patterns from competitor ads with hash-based caching

**Pipeline:**
- [src/pipeline/batch-runner.ts](src/pipeline/batch-runner.ts) — `runContinuousBatch()` — the core generation loop (generate 3 → evaluate → fix/discard → repeat)
- [src/pipeline/iteration-loop.ts](src/pipeline/iteration-loop.ts) — single-ad evaluate → edit cycle (max 3 rounds)
- [src/pipeline/orchestrator.ts](src/pipeline/orchestrator.ts) — wires agents + ratchet + metrics for full pipeline runs

**Evaluation logic:**
- [src/evaluate/scoring.ts](src/evaluate/scoring.ts) — weighted score computation, confidence, weakest dimension identification
- [src/evaluate/threshold.ts](src/evaluate/threshold.ts) — `QualityRatchet` class (threshold rises as quality improves)
- [src/evaluate/failure-taxonomy.ts](src/evaluate/failure-taxonomy.ts) — labels why an ad failed with actionable suggestions

**Config:**
- [src/config/weights.ts](src/config/weights.ts) — dimension weights (clarity 25, value_prop 25, emotional 20, cta 15, brand_voice 15)
- [src/config/thresholds.ts](src/config/thresholds.ts) — quality threshold, max cycles, ratchet buffer, batch size, round cap
- [src/config/models.ts](src/config/models.ts) — model IDs, temperatures, token limits, per-token pricing

**Types:**
- [src/types/](src/types/) — Zod schemas for ad, brief, evaluation, pipeline result, and competitor patterns

**Data:**
- [data/reference/competitor_ads.json](data/reference/competitor_ads.json) — 65 real ads from Meta Ad Library (41 VT + competitors)
- [data/reference/reference-set.json](data/reference/reference-set.json) — 16-ad tiered calibration set with tier rationales
- [data/briefs.json](data/briefs.json) — 10 campaign briefs (audience x goal x angle matrix)

**UI:**
- [ui/src/App.tsx](ui/src/App.tsx) — main app with SSE event handling and tab routing
- [ui/src/components/AdCard.tsx](ui/src/components/AdCard.tsx) — Meta ad format card with score badge
- [ui/src/components/InsightsTab.tsx](ui/src/components/InsightsTab.tsx) — charts and cost metrics
- [ui/src/hooks/useSSE.ts](ui/src/hooks/useSSE.ts) — EventSource hook for real-time pipeline events

**Server:**
- [src/server/api.ts](src/server/api.ts) — Express API (5 endpoints + SSE streaming)
