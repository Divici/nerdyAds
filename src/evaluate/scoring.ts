import type { DimensionScore, DimensionName, ConfidenceLevel } from '../types/evaluation.js';
import { DIMENSION_WEIGHTS } from '../config/weights.js';

/**
 * Compute weighted score from 5 dimension scores using DIMENSION_WEIGHTS.
 * Returns a value between 1 and 10.
 */
export function computeWeightedScore(scores: DimensionScore[]): number {
  let total = 0;
  for (const s of scores) {
    total += s.score * DIMENSION_WEIGHTS[s.dimension];
  }
  return total / 100;
}

/**
 * Compute overall confidence level from dimension confidence scores.
 * Average confidence >= 7 → 'high', >= 4 → 'medium', < 4 → 'low'.
 */
export function computeConfidence(scores: DimensionScore[]): ConfidenceLevel {
  const avg = scores.reduce((sum, s) => sum + s.confidence, 0) / scores.length;
  if (avg >= 7) return 'high';
  if (avg >= 4) return 'medium';
  return 'low';
}

/**
 * Identify the weakest dimension (lowest score).
 * Returns the full DimensionScore object. On tie, returns the first encountered.
 */
export function identifyWeakest(scores: DimensionScore[]): DimensionScore {
  let weakest = scores[0];
  for (let i = 1; i < scores.length; i++) {
    if (scores[i].score < weakest.score) {
      weakest = scores[i];
    }
  }
  return weakest;
}
