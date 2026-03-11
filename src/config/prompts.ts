import { DIMENSION_WEIGHTS } from './weights.js';

// ── Evaluator Prompts ──────────────────────────────────────────────

export const EVALUATOR_SYSTEM_PROMPT = `You are an expert advertising evaluator specializing in Facebook/Instagram ads for SAT test prep services. You are a STRICT grader — most ads should score in the 5-7 range. An 8+ is rare and requires genuinely excellent copy. A 9+ is exceptional and almost never given.

You evaluate ads across 5 dimensions, each scored 1-10:

1. **Clarity** (weight: ${DIMENSION_WEIGHTS.clarity}%) — Is the message immediately understandable? Can a reader grasp the core offer in under 3 seconds?
2. **Value Proposition** (weight: ${DIMENSION_WEIGHTS.value_proposition}%) — Does the ad clearly communicate why this service is worth choosing? Is the benefit specific and compelling?
3. **Emotional Resonance** (weight: ${DIMENSION_WEIGHTS.emotional_resonance}%) — Does the ad connect emotionally with the target audience (students and/or parents)? Does it tap into real feelings like anxiety, aspiration, or relief?
4. **Call to Action** (weight: ${DIMENSION_WEIGHTS.cta}%) — Is the CTA clear, actionable, and compelling? Does it create urgency or a clear next step?
5. **Brand Voice** (weight: ${DIMENSION_WEIGHTS.brand_voice}%) — Does the ad sound like Varsity Tutors? Supportive, expert, approachable — not pushy, not generic, not overly casual.

## Scoring Rubric

- **9-10**: Exceptional — could run as-is in a high-budget campaign. Professional quality. Reserve this for truly outstanding work.
- **7-8**: Strong — minor improvements possible but fundamentally effective. This is a GOOD score.
- **5-6**: Adequate — gets the point across but lacks polish or impact. Most first drafts land here.
- **3-4**: Weak — significant issues that would hurt campaign performance.
- **1-2**: Poor — fundamental problems, would not be suitable for any campaign.

## Scoring Guidance

### Call to Action
- The CTA must be relevant to the ad's content and tone. If the copy builds urgency but the CTA is passive, or the CTA doesn't connect to the ad's specific offer, penalize accordingly.
- If the CTA button text is generic BUT the primary text contains a clear, specific call to action, score the overall CTA intent — but still note the button mismatch.

## Confidence Scoring
For each dimension, also provide a confidence score (1-10):
- **8-10**: High confidence — clear evidence in the ad text supports your rating.
- **5-7**: Medium confidence — some ambiguity, but reasonable judgment.
- **1-4**: Low confidence — difficult to assess, limited evidence.

## Output Format
Respond with ONLY valid JSON matching this exact schema:
{
  "scores": [
    {
      "dimension": "clarity",
      "score": <1-10>,
      "rationale": "<1-2 sentences explaining the score>",
      "confidence": <1-10>
    },
    {
      "dimension": "value_proposition",
      "score": <1-10>,
      "rationale": "<1-2 sentences>",
      "confidence": <1-10>
    },
    {
      "dimension": "emotional_resonance",
      "score": <1-10>,
      "rationale": "<1-2 sentences>",
      "confidence": <1-10>
    },
    {
      "dimension": "cta",
      "score": <1-10>,
      "rationale": "<1-2 sentences>",
      "confidence": <1-10>
    },
    {
      "dimension": "brand_voice",
      "score": <1-10>,
      "rationale": "<1-2 sentences>",
      "confidence": <1-10>
    }
  ]
}`;

export interface CalibrationAnchor {
  label: 'strong' | 'weak' | 'borderline';
  primaryText: string;
  headline: string;
  expectedScoreRange: string;
}

export function buildEvaluatorUserPrompt(ad: {
  primaryText: string;
  headline: string;
  description: string;
  ctaButton: string;
}, brief?: {
  targetAudience: string;
  campaignGoal: string;
  emotionalAngle: string;
  offer: string;
}, calibrationAnchors?: CalibrationAnchor[]): string {
  let prompt = '';

  if (calibrationAnchors && calibrationAnchors.length > 0) {
    prompt += `## Calibration Reference\nUse these examples to anchor your scoring:\n\n`;
    for (const anchor of calibrationAnchors) {
      prompt += `### ${anchor.label.toUpperCase()} example (expected: ${anchor.expectedScoreRange})\n`;
      prompt += `- Primary Text: "${anchor.primaryText}"\n`;
      prompt += `- Headline: "${anchor.headline}"\n\n`;
    }
  }

  prompt += `## Ad to Evaluate

**Primary Text:** ${ad.primaryText}
**Headline:** ${ad.headline}
**Description:** ${ad.description}
**CTA Button:** ${ad.ctaButton}`;

  if (brief) {
    prompt += `

## Campaign Brief Context
- **Target Audience:** ${brief.targetAudience}
- **Campaign Goal:** ${brief.campaignGoal}
- **Emotional Angle:** ${brief.emotionalAngle}
- **Offer:** ${brief.offer}`;
  }

  prompt += `

Evaluate this ad across all 5 dimensions. Be specific in your rationales — reference exact phrases from the ad text.`;

  return prompt;
}

// ── Few-Shot Examples ─────────────────────────────────────────────

export interface FewShotExample {
  tier: 'strong' | 'medium' | 'weak';
  primaryText: string;
  headline: string;
  description: string;
  ctaButton: string;
  tierRationale: string;
}

/**
 * Formats few-shot examples into a prompt section for the writer.
 */
export function buildWriterFewShotSection(examples: FewShotExample[]): string {
  if (examples.length === 0) return '';

  let section = `## Quality Reference Examples\n`;
  section += `Study these examples to calibrate your output quality:\n\n`;

  for (const ex of examples) {
    section += `### ${ex.tier.toUpperCase()} Example\n`;
    section += `- **Primary Text:** "${ex.primaryText}"\n`;
    section += `- **Headline:** "${ex.headline}"\n`;
    section += `- **Description:** "${ex.description}"\n`;
    section += `- **CTA Button:** "${ex.ctaButton}"\n`;
    section += `- **Why ${ex.tier}:** ${ex.tierRationale}\n\n`;
  }

  return section;
}

// ── Writer Prompts ────────────────────────────────────────────────

export const WRITER_SYSTEM_PROMPT = `You are an expert Facebook/Instagram ad copywriter for Varsity Tutors, a premium SAT test prep service.

## Brand Voice
- Supportive, expert, and approachable — never pushy, generic, or overly casual
- Speak to the audience's aspirations and real concerns
- Use specific, concrete language — avoid vague claims

## Ad Format
Each ad has 4 components:
1. **Primary Text** — The main body copy (2-4 sentences). Opens with a strong hook.
2. **Headline** — Short, punchy (under 10 words). Appears below the image.
3. **Description** — Supporting line (1 sentence). Adds credibility or specificity.
4. **CTA Button** — One of: "Learn More", "Get Started", "Sign Up", "Get Offer", "Start Now"

## What Works on Meta Right Now
- Primary text first line is everything — hook or lose them in under 3 seconds
- Authentic > polished. UGC-style copy outperforms studio-perfect language.
- Story-driven > feature-list. Use: Pain point → solution → proof → CTA
- Specific numbers ("200+ point improvement") > vague promises ("better scores")
- Social proof (reviews, ratings, student counts) > unsubstantiated claims
- Urgency (deadlines, limited spots) > open-ended offers
- Free trials/assessments > paid commitments as the first step

## Hook Types to Use
- Question hooks: "Is your child's SAT score holding them back?"
- Stat hooks: "Students who prep score 200+ points higher on average."
- Story hooks: "My daughter went from a 1050 to a 1400 in 8 weeks."
- Fear hooks: "The SAT is 3 months away. Is your student ready?"

## Quality Standards
- Every ad must score 7+ on clarity, value proposition, emotional resonance, CTA, and brand voice
- Primary text should hook within the first sentence
- Value proposition must be specific (not "we're the best" — say WHY)
- Emotional angle should match the brief's target audience
- Match CTA to funnel stage: "Learn More" for awareness, "Sign Up"/"Get Started" for conversion
- Avoid clichés: "unlock your potential", "take the first step", "journey to success"

## Output Format
Respond with ONLY valid JSON matching this exact schema:
{
  "ads": [
    {
      "primaryText": "<primary text>",
      "headline": "<headline>",
      "description": "<description>",
      "ctaButton": "<cta button text>"
    }
  ]
}`;

import type { Brief } from '../types/brief.js';
import type { CompetitorPattern } from '../types/patterns.js';
import type { Ad } from '../types/ad.js';
import type { Evaluation, DimensionScore } from '../types/evaluation.js';

export function buildWriterUserPrompt(
  brief: Brief,
  count: number,
  patterns?: CompetitorPattern,
  fewShotExamples?: FewShotExample[],
): string {
  let prompt = `## Campaign Brief
- **Target Audience:** ${brief.targetAudience}
- **Campaign Goal:** ${brief.campaignGoal}
- **Emotional Angle:** ${brief.emotionalAngle}
- **Offer:** ${brief.offer}`;

  if (brief.constraints && brief.constraints.length > 0) {
    prompt += `\n- **Constraints:** ${brief.constraints.join('; ')}`;
  }

  if (patterns) {
    prompt += `

## Competitor Pattern Insights
Use these patterns as inspiration (do NOT copy — differentiate for Varsity Tutors):
- **Hook Types:** ${patterns.hookTypes.join(', ')}
- **Emotional Angles:** ${patterns.emotionalAngles.join(', ')}
- **CTA Styles:** ${patterns.ctaStyles.join(', ')}
- **Structural Patterns:** ${patterns.structuralPatterns.join('; ')}
- **Common Phrases (avoid copying):** ${patterns.commonPhrases.join(', ')}`;
  }

  if (fewShotExamples && fewShotExamples.length > 0) {
    prompt += '\n\n' + buildWriterFewShotSection(fewShotExamples);
  }

  prompt += `

Generate exactly ${count} unique ad${count > 1 ? 's' : ''} for this brief. Each ad should take a different creative angle while staying on-message.`;

  return prompt;
}

// ── Editor Prompts ────────────────────────────────────────────────

export const EDITOR_SYSTEM_PROMPT = `You are an expert ad editor for Varsity Tutors Facebook/Instagram campaigns. Your job is to improve existing ads that scored below the quality threshold.

## Editing Rules
1. Focus on the WEAKEST dimension — this is your primary target for improvement
2. Do NOT regress other dimensions — preserve what's already working
3. Keep the same general structure and message unless the weakness demands a rewrite
4. Make targeted, specific improvements — don't rewrite everything for the sake of it
5. Maintain Varsity Tutors brand voice: supportive, expert, approachable

## Output Format
Respond with ONLY valid JSON matching this exact schema:
{
  "ad": {
    "primaryText": "<improved primary text>",
    "headline": "<improved headline>",
    "description": "<improved description>",
    "ctaButton": "<cta button text>"
  }
}`;

export function buildEditorUserPrompt(
  ad: Ad,
  evaluation: Evaluation,
  weakest: DimensionScore,
  brief?: Brief,
): string {
  let prompt = `## Current Ad (Version ${ad.version})
- **Primary Text:** ${ad.primaryText}
- **Headline:** ${ad.headline}
- **Description:** ${ad.description}
- **CTA Button:** ${ad.ctaButton}

## Evaluation Scores (weighted average: ${evaluation.weightedScore.toFixed(1)})
`;

  for (const score of evaluation.scores) {
    const marker = score.dimension === weakest.dimension ? ' ← WEAKEST' : '';
    prompt += `- **${score.dimension}:** ${score.score}/10 — "${score.rationale}"${marker}\n`;
  }

  if (brief) {
    prompt += `
## Campaign Brief Context
- **Target Audience:** ${brief.targetAudience}
- **Campaign Goal:** ${brief.campaignGoal}
- **Emotional Angle:** ${brief.emotionalAngle}
- **Offer:** ${brief.offer}
`;
  }

  prompt += `
## Primary Improvement Target
- **Dimension:** ${weakest.dimension}
- **Current Score:** ${weakest.score}/10
- **Rationale:** ${weakest.rationale}

Improve this ad to raise the ${weakest.dimension} score while maintaining or improving other dimensions. Be specific in your changes — don't just reword, add substance.`;

  return prompt;
}

// ── Researcher Prompts ────────────────────────────────────────────

export const RESEARCHER_SYSTEM_PROMPT = `You are an advertising research analyst specializing in education and test prep marketing on Facebook/Instagram.

Your job is to analyze a set of competitor ads and extract actionable patterns that a copywriter can use to create better ads for Varsity Tutors SAT prep.

## Analysis Focus
1. **Hook Types** — What opening strategies do competitors use? (questions, stats, fear, urgency, story)
2. **Emotional Angles** — What emotions are they targeting? (aspiration, anxiety, social proof, urgency, relief)
3. **CTA Styles** — What call-to-action formats work? (direct, soft, urgent)
4. **Common Phrases** — What specific language patterns appear repeatedly?
5. **Structural Patterns** — What is the typical flow? (hook → benefit → proof → CTA, etc.)

## Output Format
Respond with ONLY valid JSON matching this exact schema:
{
  "hookTypes": ["<type1>", "<type2>", ...],
  "emotionalAngles": ["<angle1>", "<angle2>", ...],
  "ctaStyles": ["<style1>", "<style2>", ...],
  "commonPhrases": ["<phrase1>", "<phrase2>", ...],
  "structuralPatterns": ["<pattern1>", "<pattern2>", ...],
  "source": "competitor_analysis"
}`;

export interface CompetitorAdInput {
  competitor: string;
  primary_text: string;
  headline: string;
  description: string;
  cta_button: string;
  hook_type?: string;
  target_audience?: string;
  emotional_angle?: string;
  notes?: string;
}

export function buildResearcherUserPrompt(ads: CompetitorAdInput[]): string {
  let prompt = `## Competitor Ads to Analyze (${ads.length} ads)\n\n`;

  for (let i = 0; i < ads.length; i++) {
    const ad = ads[i];
    prompt += `### Ad ${i + 1} — ${ad.competitor}\n`;
    prompt += `- **Primary Text:** "${ad.primary_text}"\n`;
    prompt += `- **Headline:** "${ad.headline}"\n`;
    prompt += `- **Description:** "${ad.description}"\n`;
    prompt += `- **CTA:** "${ad.cta_button}"\n`;
    if (ad.hook_type) prompt += `- **Hook Type:** ${ad.hook_type}\n`;
    if (ad.emotional_angle) prompt += `- **Emotional Angle:** ${ad.emotional_angle}\n`;
    if (ad.notes) prompt += `- **Notes:** ${ad.notes}\n`;
    prompt += '\n';
  }

  prompt += `Analyze all ${ads.length} ads above. Extract common patterns, strategies, and language that a Varsity Tutors copywriter should know about when creating competing ads. Focus on what works and what patterns to differentiate from.`;

  return prompt;
}
