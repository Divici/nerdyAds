import type { DimensionName } from '../types/evaluation.js';

/** Dimension weights — must sum to 100. */
export const DIMENSION_WEIGHTS: Record<DimensionName, number> = {
  clarity: 25,
  value_proposition: 25,
  emotional_resonance: 20,
  cta: 15,
  brand_voice: 15,
} as const;

/** All 5 dimension names in evaluation order. */
export const DIMENSIONS: readonly DimensionName[] = [
  'clarity',
  'value_proposition',
  'emotional_resonance',
  'cta',
  'brand_voice',
] as const;

/** Get the weight for a single dimension. */
export function getDimensionWeight(dimension: DimensionName): number {
  return DIMENSION_WEIGHTS[dimension];
}
