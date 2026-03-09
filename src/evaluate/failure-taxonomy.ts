import type { DimensionScore, DimensionName } from '../types/evaluation.js';

export interface FailureClassification {
  /** The single weakest dimension. */
  weakestDimension: DimensionName;
  /** Human-readable failure label. */
  label: string;
  /** Actionable improvement suggestion for the editor agent. */
  suggestion: string;
  /** All dimensions scoring below the weakness threshold (< 5). */
  allWeakDimensions: DimensionName[];
}

const WEAKNESS_THRESHOLD = 5;

const DIMENSION_LABELS: Record<DimensionName, string> = {
  clarity: 'Unclear messaging',
  value_proposition: 'Weak value proposition',
  emotional_resonance: 'Low emotional resonance',
  cta: 'Ineffective CTA',
  brand_voice: 'Off-brand voice',
};

const DIMENSION_SUGGESTIONS: Record<DimensionName, string> = {
  clarity: 'Simplify the message — remove jargon, shorten sentences, and make the core benefit immediately obvious.',
  value_proposition: 'Strengthen the unique benefit — make it clear why Varsity Tutors is worth choosing over alternatives.',
  emotional_resonance: 'Connect emotionally — use relatable student/parent scenarios, specific feelings, or aspirational outcomes.',
  cta: 'Strengthen the CTA — make it action-oriented, urgent, and clearly tied to the next step the reader should take.',
  brand_voice: 'Align with brand voice — use a supportive, expert, and approachable tone consistent with Varsity Tutors.',
};

/**
 * Classify why an ad failed evaluation.
 * Identifies the weakest dimension, labels the failure, and suggests improvements.
 */
export function classifyFailure(scores: DimensionScore[]): FailureClassification {
  const sorted = [...scores].sort((a, b) => a.score - b.score);
  const weakest = sorted[0];
  const allWeak = scores
    .filter((s) => s.score < WEAKNESS_THRESHOLD)
    .map((s) => s.dimension);

  if (allWeak.length === 0) {
    return {
      weakestDimension: weakest.dimension,
      label: 'Scores below threshold overall — no single dimension critically weak',
      suggestion: DIMENSION_SUGGESTIONS[weakest.dimension],
      allWeakDimensions: [],
    };
  }

  return {
    weakestDimension: weakest.dimension,
    label: DIMENSION_LABELS[weakest.dimension],
    suggestion: DIMENSION_SUGGESTIONS[weakest.dimension],
    allWeakDimensions: allWeak,
  };
}
