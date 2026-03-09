# PRESEARCH - Nerdy Autonomous Content Generation System

## 1. Objective

Build an autonomous ad generation system for Facebook and Instagram paid social that does **more than generate copy**. The system should:

- generate ad variants from minimal inputs
- evaluate quality across measurable dimensions
- identify weak outputs
- improve them through targeted iteration
- surface only strong final ads
- track quality improvement relative to token spend

This project should be approached as a **systems engineering challenge**, not a prompt-only exercise.

---

## 2. Project Thesis

The best submission for this project is **not** the one that produces the most ads or the fanciest UI.

The best submission is the one that behaves like a compact internal growth system at an AI-native company:

- clear quality standards
- structured evaluation
- strong judgment
- measurable improvement
- cost awareness
- honest failure handling
- modular design that can adapt when better calibration data arrives

My working thesis:

> Build an evaluator-led autonomous ad engine for Varsity Tutors SAT campaigns that improves copy quality per token spent through calibrated scoring, targeted regeneration, and modular image support.

---

## 3. What Nerdy Seems to Value

Based on the company bio provided in the hiring portal, Nerdy appears to value:

- **AI-native execution** - AI should be part of the workflow from the beginning, not bolted on at the end.
- **Entrepreneurial velocity** - move fast, prototype quickly, and optimize toward real outcomes.
- **Full-stack ownership** - the builder should design, implement, and own what ships.
- **Merit and measurable impact** - ideas matter only if they work.
- **Relentless improvement** - challenge assumptions and iterate aggressively.
- **Execution under ambiguity** - strong builders turn incomplete information into working systems.

Implication for this project:

- I should prioritize a system that is measurable, opinionated, modular, and easy to improve.
- I should avoid vague creative experimentation with no clear rubric.
- I should document tradeoffs and show strong reasoning, especially where requirements are intentionally open.

---

## 4. What the Project Brief Really Rewards

The brief makes several things clear:

### 4.1 This is not mainly about generation
The challenge is to build a system that can:
- generate
- evaluate
- iterate
- improve
- reject weak outputs
- explain its own reasoning

### 4.2 Quality must be decomposed
The required quality dimensions are:

- Clarity
- Value Proposition
- Call to Action
- Brand Voice
- Emotional Resonance

### 4.3 The system must know what good looks like
A mediocre generator with a strong evaluator and improvement loop is more aligned with the brief than a fancy generator with weak judgment.

### 4.4 Performance per token matters
This is not only about output quality. It is also about:
- efficiency
- cost awareness
- improvement ROI
- whether the tokens spent actually produce better work

### 4.5 My decision log matters
The brief explicitly values:
- what I tried
- what failed
- what improved quality
- why I made each judgment call

Implication:

> The submission should feel like an intelligent optimization system, not just an ad-writing tool.

---

## 5. Core Build Strategy

## Recommendation

Build a **v1-first, v2-ready** system.

That means:

- make the text pipeline the core source of truth
- make evaluation the center of the system
- make image generation modular and downstream
- keep recalibration easy when first-party reference ads arrive

### Why this is the best approach

The project brief allows a valid text-only v1. Image generation is explicitly a later scope expansion.

That means the safest and strongest strategy is:

1. build a polished text engine first
2. prove measurable improvement
3. attach image generation as an optional second layer
4. keep text and image evaluation separate

This avoids overcomplicating the main system before the reference materials arrive.

---

## 6. Current Constraint: Missing Reference Ads

At build start, the real Varsity Tutors reference ads and performance context are **not yet available**.

This creates a gap in final calibration, but it does **not** block system development.

### What can still be built now

I can fully build:

- generation pipeline
- scoring schema
- evaluator
- targeted regeneration loop
- metrics and trend tracking
- decision log
- export pipeline
- image generation layer
- image evaluation layer
- combined ranking logic

### What remains provisional until reference ads arrive

These should be treated as provisional and recalibrated later:

- dimension weights
- publishability threshold strictness
- brand-voice exemplars
- preferred hook styles
- parent vs student emotional framing
- CTA preferences
- visual style assumptions

### Conclusion

I should **not wait** for the references to start building.

Instead, I should build the system so that it is:

- strong without first-party examples
- easy to recalibrate when first-party examples arrive

---

## 7. How Competitor Ads Help

Competitor ads are useful, but they are a **surrogate**, not a replacement for Varsity reference ads.

### Competitor ads are useful for:

- hook pattern mining
- CTA pattern mining
- emotional framing patterns
- parent-focused vs student-focused language
- layout and creative conventions
- scroll-stopping visual structures
- building a temporary calibration dataset
- adding competitive intelligence as a bonus layer

### Competitor ads are **not** a perfect replacement for:

- exact Varsity brand voice
- what Nerdy internally considers high-performing
- first-party performance calibration
- true publishability thresholds

### Best use of competitor ads

Use competitor ads for:
- **market pattern learning**
- **temporary evaluator calibration**
- **creative inspiration**
- **competitive intelligence**

Use real Varsity reference ads later for:
- **brand calibration**
- **threshold tuning**
- **final evaluator adjustments**
- **proof that the system learned what Nerdy values**

---

## 8. Working Product Framing

This is the product framing I should build toward:

> An evaluator-led autonomous ad engine for Varsity Tutors SAT-prep campaigns that generates, scores, improves, and filters Meta ad copy for quality per token spent.

This framing is strong because it emphasizes:

- autonomy
- judgment
- iteration
- performance
- efficiency
- measurable value

---

## 9. Audience and Brand Assumptions

## Brand voice
Varsity Tutors / Nerdy brand voice for this project should be treated as:

- empowering
- knowledgeable
- approachable
- results-focused

### Voice rules
- lead with outcomes, not features
- sound confident, not arrogant
- sound expert, not elitist
- meet users where they are
- avoid generic AI-sounding marketing language

## Primary project audience
SAT test prep, specifically:

- parents anxious about college admissions
- high school students stressed about scores
- families comparing prep options

### Emotional drivers
Likely core emotional levers:

- test anxiety
- fear of falling behind
- desire for score improvement
- confidence building
- future opportunity
- parental reassurance
- urgency around preparation windows

---

## 10. Recommended Quality Rubric

The brief requires five dimensions. I will use these as the core scoring schema.

## 10.1 Required dimensions

### Clarity
Is the message immediately understandable?

### Value Proposition
Does the ad communicate a compelling, differentiated benefit?

### Call to Action
Is the next step clear, urgent, and low-friction?

### Brand Voice
Does it sound distinctly like Varsity Tutors?

### Emotional Resonance
Does it connect to real user motivation or pain?

## 10.2 Provisional weights

These weights are intentionally provisional until reference ads arrive.

- Clarity - 25
- Value Proposition - 25
- Emotional Resonance - 20
- Call to Action - 15
- Brand Voice - 15

### Rationale
For SAT prep ads:
- clarity is critical because paid social has to stop the scroll fast
- value proposition matters because the ad must explain why this option is worth attention
- emotional resonance matters because both students and parents are driven by stress, ambition, and anxiety
- CTA matters, but weak value cannot be rescued by a strong button phrase
- brand voice matters, but it should support performance rather than override clarity

## 10.3 Publishability threshold

Initial rule:

- aggregate score must be **7.0+**
- no critical dimension should be extremely weak
- evaluator confidence should be high enough to trust the result

This threshold may be adjusted later after real reference calibration.

---

## 11. Temporary Calibration Strategy Before Reference Ads Arrive

Because first-party reference ads are missing, I need a temporary dataset for evaluator development.

## 11.1 Temporary calibration dataset

Create three buckets:

### A. Strong examples
Use competitor-inspired structures rewritten into Varsity-style language.

Goal:
- define what "good" might look like in this market

### B. Weak examples
Create clearly bad ads on purpose:
- vague
- generic
- no hook
- weak CTA
- off-brand tone
- feature dump
- low emotional connection

Goal:
- teach the evaluator what to reject

### C. Borderline examples
Create ads that are decent but not clearly publishable.

Goal:
- force the evaluator to distinguish "acceptable" from "strong"

## 11.2 Calibration objective

The evaluator should be able to:
- score strong examples high
- score weak examples low
- identify why an ad is weak
- consistently separate publishable from non-publishable outputs

---

## 12. Recommended Architecture

The system should be modular and evaluation-centered.

## 12.1 Suggested structure

```text
generate/
  text/
  image/

evaluate/
  text/
  image/

iterate/
  text/

rank/
  combined/

metrics/
output/
docs/
data/

# 12.2 Module roles

## generate/text

Creates ad variants from a brief.

## evaluate/text

Scores text on the five dimensions, returns rationale, confidence, and aggregate score.

## iterate/text

Identifies the weakest dimension and performs targeted improvement.

## generate/image

Generates image prompts and creative variants from approved text ads.

## evaluate/image

Scores images separately on visual criteria.

## rank/combined

Combines text and image outcomes into a final selection process.

## metrics

Tracks scores, cycles, confidence, cost, and improvement efficiency.

## output

Exports final ad library, reports, and trend artifacts.

## docs

Stores decision log, assumptions, risks, and recalibration notes.

# 13. Build Philosophy for Image Generation


# Recommendation

Include image generation, but **do not put it on the critical path**.
Text should remain the primary gate.

## Rule of thumb

```
● weak text should never be rescued by a nice image
● image generation should happen only after text passes threshold
● text and image should be evaluated separately
● final combined ranking should be simple at first
```
# 13.1 Why this matters

If text and image scoring are tangled too early:
● recalibration becomes harder
● debugging becomes harder
● failures become ambiguous
● missing reference ads become a much bigger problem
Keeping them separate protects the core submission.

# 13.2 Image generation flow

Recommended flow:

1. generate text variants
2. evaluate text
3. improve weak text through targeted regeneration


4. accept only text that passes threshold
5. generate image prompts from accepted text
6. generate image variants
7. evaluate image variants
8. pair strongest image with strongest text
9. export final combinations
This makes the system stronger and easier to recalibrate later.

# 14. Proposed Image Evaluation Rubric

This should remain lightweight until real Varsity examples arrive.

# 14.1 Image dimensions

## Brand Consistency

Does the creative feel compatible with the brand?

## Message Alignment

Does the image support the text hook and value proposition?

## Readability / Composition

Is the layout understandable at a glance?

## Scroll-Stop Potential

Does it stand out enough to interrupt passive scrolling?

## Audience Fit

Would this feel relevant to SAT-focused parents or students?


# 14.2 Image scoring rule

Initial approach:
● score image separately
● use it as a secondary ranking layer
● do **not** let image score override weak text score

# 15. Combined Ranking Strategy

Keep combined ranking simple at first.

# 15.1 Gate order

## Gate 1 - Text quality

Text must pass the publishability threshold.

## Gate 2 - Image acceptability

Image must be visually acceptable and aligned.

## Gate 3 - Final ranking

Rank accepted ad pairs by:

1. text quality
2. evaluator confidence
3. image quality
4. cost efficiency
This keeps the core aligned with the brief.


# 16. Improvement Loop Design

The improvement loop is one of the most important parts of the system.

# 16.1 Core loop

1. generate ad
2. evaluate across five dimensions
3. identify weakest dimension
4. choose targeted intervention
5. regenerate only what needs fixing
6. re-evaluate
7. stop when threshold is reached or budget is exhausted

# 16.2 Targeted regeneration policy

Recommended initial policy:
● max 3 improvement cycles per ad
● cycle 1: rewrite weakest section only
● cycle 2: strengthen hook / value / CTA based on failure type
● cycle 3: full rewrite only if the ad is close enough to threshold to justify cost
If an ad still fails after this:
● reject it
● log failure mode
● move on


This protects token efficiency and prevents over-investing in weak ads.

# 17. Failure Taxonomy

The system should classify why ads fail.

# Initial failure labels

● unclear hook
● too many competing messages
● weak value proposition
● vague CTA
● low emotional pull
● off-brand tone
● generic phrasing
● over-explaining
● not specific enough
● weak urgency
● mismatched audience framing
This improves explainability and makes iteration smarter.

# 18. Metrics to Track

Metrics should be built before polishing extras.

# Required metrics


```
● score per dimension
● aggregate score
● evaluator confidence
● publishable vs non-publishable
● number of improvement cycles
● score delta per cycle
● final pass rate
● token cost per ad
● token cost per accepted ad
● quality gain per token
● most common failure types
● which interventions improved which dimensions
```
# Why these metrics matter

These metrics prove:
● the system improved
● it improved efficiently
● it knows why changes helped
● it can reject low-value work

# 19. Recalibration Plan When Reference Ads Arrive

The system should be built to support a focused recalibration pass later.


# 19.1 What to update on the text side

When reference ads arrive, update:
● dimension weights
● publishability threshold strictness
● brand-voice exemplars
● emotional framing patterns
● hook patterns
● proof structures
● CTA preferences

# 19.2 What to update on the image side

When first-party creative examples arrive, update:
● visual style expectations
● realism vs polish balance
● copy density assumptions
● preferred composition patterns
● brand consistency rules
● audience-specific visual cues

# 19.3 What to update last

Only after text and image recalibration:
● adjust combined ranking logic


This keeps recalibration controlled and understandable.

# 20. Technical Recommendation

The cleanest technical direction is a **TypeScript / Node-based implementation** with strong
artifact output and reproducibility.

# Why this is a good fit

```
● aligns with my current strengths
● supports quick iteration
● easy to structure modularly
● easy to export JSON/CSV artifacts
● easy to build a CLI-first workflow
● good fit for fast experimentation
```
# Recommended characteristics

```
● deterministic where possible
● configurable thresholds
● low-friction local execution
● API-key based
● easy to re-run with changed configs
● clean foldered outputs for review
```
# 21. Scope Recommendation


# Strongest submission scope

Build:
● a polished text pipeline
● a real evaluator
● measurable iteration
● strong metrics
● a lightweight but real image layer
● a clear decision log
● recalibration hooks for future references

# What to avoid

Avoid:
● overbuilding a UI too early
● complex multi-agent orchestration without strong justification
● deep image optimization before first-party examples exist
● spending lots of time on aesthetics while evaluator quality is still weak
● vague scoring without rationale
● hiding failures

# 22. Risks

# Risk 1 - Missing reference ads


Without first-party references, brand calibration is provisional.

## mitigation

Use competitor patterns + synthetic calibration data now, then recalibrate later.

# Risk 2 - Evaluator inconsistency

LLM judges may drift or produce noisy scores.

## mitigation

Use structured rubrics, fixed format outputs, confidence scoring, and calibration examples.

# Risk 3 - Overfitting to competitor style

Competitor ads may teach useful patterns but not true Varsity voice.

## mitigation

Use competitor material for market learning, not final brand truth.

# Risk 4 - Image generation complexity

Images can consume time and introduce fragile dependencies.

## mitigation

Make image generation downstream and optional relative to text pass thresholds.

# Risk 5 - Token inefficiency

Too many regeneration loops can destroy performance-per-token.

## mitigation

Cap iterations, reject weak ads early, and track quality gain per token.

# 23. Decision Log Starters


These are the kinds of statements I should explicitly record during implementation:
● I treated this as an evaluation-centered system rather than a prompt-only task.
● I made the text pipeline the primary source of truth because the brief positions primary
text as the most important Meta ad element.
● I included image generation only after text passed threshold to avoid making weak ads
look stronger than they are.
● I used competitor patterns and synthetic examples as a temporary calibration dataset
because first-party reference ads were unavailable at build start.
● I kept text and image scoring separate so recalibration could happen cleanly later.
● I used targeted regeneration instead of unlimited rewriting to protect token efficiency.
● I treated weights and thresholds as provisional until real reference data became
available.
● I prioritized measurable lift, explainability, and rejection logic over UI polish.

# 24. Recommended Build Order

1. presearch and assumption logging
2. competitor pattern notes
3. scoring rubric definition
4. temporary calibration dataset
5. text generation pipeline
6. text evaluator
7. targeted regeneration loop
8. metrics and export pipeline


9. image prompt builder
10. image generation layer
11. image evaluator
12. simple combined ranking
13. recalibration hooks for future references
14. final decision log and summary report

# 25. Suggested 3-Day Execution Plan

# Day 1

## Goal

Lock the system design and build the text backbone.

## Tasks

```
● finalize rubric and provisional weights
● collect competitor patterns
● create synthetic strong / weak / borderline examples
● build text generation pipeline
● build text evaluator output schema
● implement score aggregation
● implement threshold logic
```
## End of day deliverable

A working generate + evaluate pipeline with saved outputs.


# Day 2

## Goal

Build improvement logic and measurement.

## Tasks

```
● implement targeted regeneration loop
● add failure taxonomy
● track score deltas across cycles
● track cost and token usage
● export JSON / CSV reports
● generate initial 50+ ads
● review common failure modes
```
## End of day deliverable

A measurable text system showing improvement over multiple cycles.

# Day 3

## Goal

Layer on image support and polish the submission.

## Tasks

```
● generate image prompts from approved text
● generate image variants
● build lightweight image evaluator
● pair accepted text with acceptable visuals
```

```
● finalize combined ranking
● clean outputs
● write decision log
● document recalibration plan
● summarize what worked / failed / remains provisional
```
## End of day deliverable

A polished submission with a strong text core and modular image support.

# 26. Final Position

The strongest way to approach this project is:
● build now
● do not wait for the reference ads
● make calibration flexible
● use competitor ads intelligently
● make evaluation the center of the system
● treat images as an extension, not the foundation
● optimize for measurable quality per token spent
● document every major tradeoff honestly
If executed well, this approach should align with both:

1. what the project brief explicitly rewards
2. the kind of AI-native, high-ownership thinking Nerdy appears to value



