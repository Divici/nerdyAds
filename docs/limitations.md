# Limitations — nerdyAds

Honest documentation of what doesn't work well, where the system breaks, and what we'd fix with more time. Written during and after building, not as an afterthought.

---

## 1. No Real Performance Data

**The biggest limitation.** The evaluator is calibrated against ad longevity (days active on Meta Ad Library) as a proxy for quality. We have zero CTR, conversion rate, ROAS, or engagement data. Longevity is a weak signal — an ad can run for 35 days because no one paused it, not because it converted well.

**Impact:** Our "strong" tier is "strong copy that ran for a long time," not "strong copy that drove conversions." The evaluator's scores are internally consistent (strong > medium > weak with 1.0+ point gaps) but may not correlate with real-world performance.

**What would fix it:** Access to Varsity Tutors' Meta Ads Manager with CTR/CPC/conversion data per creative. The reference set schema already supports a `performance_metrics` field for this.

---

## 2. CTA Dimension Is Consistently Weakest

Across every pipeline configuration — 7.0 threshold, 8.0, 9.0, Flash evaluator, Pro evaluator — CTA is the #1 weak dimension. 67% of editor interventions target CTA (D-021). The writer defaults to generic calls-to-action like "Learn More" or "Get Started" instead of specific, low-friction CTAs like "Take Your Free Practice Test."

**Why this happens:** The writer's prompt emphasizes hooks, emotional angles, and value propositions. CTA is treated as an afterthought — the last line of the ad. This mirrors real ad writing, where hooks get the creative energy and CTAs get boilerplate.

**What would fix it:** A CTA-specific editor prompt variant that specializes in rewriting CTAs without touching the rest of the ad. The current editor rewrites the entire ad when targeting CTA, which sometimes weakens other dimensions (see #4).

---

## 3. Flash Evaluator Is Lenient

Gemini Flash scores ~0.08 points higher than Pro on identical ads and has lower variance between genuinely good and mediocre copy (D-027). In Quick mode (Flash + 7.5 threshold), nearly every ad passes on the first evaluation. This looks good in metrics (100% acceptance, 8.7+ avg score) but means the system isn't actually filtering.

**Why this matters:** The project brief says "most ads fail" and the winning system "surfaces only its best work." A 100% acceptance rate contradicts this story. Quick mode is useful for development and demos but shouldn't be mistaken for meaningful quality filtering.

**Mitigation in place:** Quality mode (Pro + 8.0 threshold) produces realistic rejection rates. The stress test (D-019) proved that with a strict evaluator prompt and 9.0 threshold, the system achieves 43% acceptance — genuine filtering.

---

## 4. Dimension Coupling During Editing

When the editor improves one dimension, other dimensions can shift. In the stress test, ~5% of ads got worse after editing — the editor added specificity to CTA but introduced awkwardness that hurt clarity. One ad went `8.3 → 8.4 → 8.4 → 7.5` across 3 editor cycles: the editor over-corrected.

**Why this happens:** The editor rewrites the full ad to fix one dimension. The evaluator then re-scores all 5 dimensions on the rewritten ad. Small wording changes ripple across dimensions because they're not truly independent — clarity and emotional resonance share the same sentences.

**What would fix it:** Surgical editing that modifies only the CTA line (or only the hook) rather than regenerating the entire ad. This would require parsing the ad structure and passing only the relevant section to the editor.

---

## 5. Self-Reported Confidence Is Unreliable

The evaluator reports its own confidence per dimension. LLMs are notoriously bad at knowing when they're uncertain — they tend to express high confidence even on borderline cases. Our rule-based flags (narrow score ranges, dimension coupling) add a second layer, but confidence scores should be treated as directional, not precise.

**Evidence:** Consistency eval shows variance of 0.01 on the same ad scored 3 times — the evaluator is consistent, but consistently confident. It never signals "I'm not sure about this one."

---

## 6. LLM Seed Non-Determinism

Seeds are set on every Gemini API call for reproducibility, but Gemini 2.5 models don't guarantee identical output across runs with the same seed. Two runs with the same brief, same seed, same prompt can produce different ads.

**Mitigation:** Snapshots (`data/output/{runId}/pipeline-result.json`) provide exact reproducibility for any completed run. The seed provides approximate reproducibility for debugging.

---

## 7. Circular Calibration (Partially Resolved)

Phase 7 calibration used synthetic ads we wrote ourselves — we judged what was "strong" and "weak," wrote examples to match, then validated that our evaluator agreed with our judgment. This is circular.

**Resolution (Phase 8.5):** We replaced synthetic calibration with a 16-ad tiered reference set built from real Varsity Tutors and competitor ads with longevity data. Tier assignments still involve human judgment (longevity is a proxy), but the ground truth is external, not self-constructed. See D-028 and D-029.

**Remaining gap:** Tier assignments were approved by one person (the builder). In a production system, multiple reviewers would independently tier-label the reference set to reduce bias.

---

## 8. Thinking Token Overhead

Gemini 2.5 models are "thinking models" that consume internal reasoning tokens before producing output. These tokens don't appear in the response but count toward costs and latency. A single Pro evaluation takes 15-20 seconds, with ~60% of that time spent on thinking tokens.

**Impact:** Pipeline runs are slower than they could be with non-thinking models. Budget ~$0.005-0.01 per evaluation for thinking overhead.

**Why we accept this:** The thinking tokens improve evaluation quality. The evaluator's structured rationales (required by the project brief) benefit from chain-of-thought reasoning. Speed is a secondary concern for a batch pipeline.

---

## 9. No Visual Evaluation (v1 Scope)

The system evaluates copy only. Real Meta ads are primarily visual — the image stops the scroll, the copy closes the sale. Some ads in our reference set (VT image-only ads) scored as "weak copy" despite potentially being effective ads because their value was in the creative, not the text.

**Schema readiness:** The reference set includes optional `creative_metadata` fields (image URL, video duration, format). Tier labels are scoped as `copy_tier`. A v2 calibration would add `visual_tier` and `overall_tier`.

---

## 10. Three-Cycle Editor Cap

The editor gets a maximum of 3 cycles to improve an ad before it's discarded. Some ads in the stress test showed improvement trajectories that suggest a 4th cycle would have pushed them past threshold (e.g., `7.3 → 8.7 → 8.3 → 9.0` — what if one more cycle refined the dip?).

**Why 3 cycles:** Cost control. Each cycle costs ~$0.004 (writer + evaluator). At 50+ ads, unlimited cycles would make costs unpredictable. 3 cycles captures 95% of improvable ads (stress test data). The remaining 5% are discarded and replaced with fresh generations, which is often more efficient than continued iteration on a struggling ad.

---

## 11. File-Based State (No Database)

Pipeline results are stored as JSON files in `data/output/{runId}/`. This works for a demo but has obvious scaling limitations:

- No querying across runs without loading every file
- No concurrent writes (not an issue with sequential pipeline, but would be for multi-user)
- Results must be committed to git for deployment (Railway serves from the repo)
- No pagination on the Previous Runs tab — all runs loaded at once

**Why this is acceptable:** The project brief doesn't require a database. JSON snapshots are debuggable, portable, and version-controllable. For a demo system generating ~50-100 ads per run, file I/O is not a bottleneck.

---

## What We'd Build Next

If continuing past v1:

1. **CTA-specific editor prompt** — surgical fix for the #1 weak dimension without risking regressions
2. **A/B variant generation** — same brief, different creative approaches (v2 scope)
3. **Image generation + visual evaluation** — Imagen integration with `visual_tier` scoring
4. **Real performance feedback loop** — ingest CTR/conversion data from Meta Ads Manager, recalibrate reference set, close the loop between generated quality and real-world performance
5. **Multi-reviewer calibration** — multiple independent raters for reference set tier assignments
