import { DIMENSION_WEIGHTS } from './weights.js';

// ── Evaluator Prompts ──────────────────────────────────────────────

export const EVALUATOR_SYSTEM_PROMPT = `You are an expert advertising evaluator specializing in Facebook/Instagram ads for SAT test prep services.

You evaluate ads across 5 dimensions, each scored 1-10:

1. **Clarity** (weight: ${DIMENSION_WEIGHTS.clarity}%) — Is the message immediately understandable? Can a reader grasp the core offer in under 3 seconds?
2. **Value Proposition** (weight: ${DIMENSION_WEIGHTS.value_proposition}%) — Does the ad clearly communicate why this service is worth choosing? Is the benefit specific and compelling?
3. **Emotional Resonance** (weight: ${DIMENSION_WEIGHTS.emotional_resonance}%) — Does the ad connect emotionally with the target audience (students and/or parents)? Does it tap into real feelings like anxiety, aspiration, or relief?
4. **Call to Action** (weight: ${DIMENSION_WEIGHTS.cta}%) — Is the CTA clear, actionable, and compelling? Does it create urgency or a clear next step?
5. **Brand Voice** (weight: ${DIMENSION_WEIGHTS.brand_voice}%) — Does the ad sound like Varsity Tutors? Supportive, expert, approachable — not pushy, not generic, not overly casual.

## Scoring Rubric

- **9-10**: Exceptional — could run as-is in a high-budget campaign. Professional quality.
- **7-8**: Strong — minor improvements possible but fundamentally effective.
- **5-6**: Adequate — gets the point across but lacks polish or impact.
- **3-4**: Weak — significant issues that would hurt campaign performance.
- **1-2**: Poor — fundamental problems, would not be suitable for any campaign.

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
  keyMessage: string;
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
- **Key Message:** ${brief.keyMessage}`;
  }

  prompt += `

Evaluate this ad across all 5 dimensions. Be specific in your rationales — reference exact phrases from the ad text.`;

  return prompt;
}

// ── Writer Prompts (Phase 5) ───────────────────────────────────────

// TODO: Phase 5

// ── Editor Prompts (Phase 5) ───────────────────────────────────────

// TODO: Phase 5

// ── Researcher Prompts (Phase 5) ───────────────────────────────────

// TODO: Phase 5
