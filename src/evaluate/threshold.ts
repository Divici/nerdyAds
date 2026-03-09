import { QUALITY_THRESHOLD, RATCHET_BUFFER } from '../config/thresholds.js';

/**
 * Check if a weighted score meets the acceptance threshold.
 * Uses quality ratchet when a running average is provided:
 *   dynamic threshold = max(QUALITY_THRESHOLD, runningAvg - RATCHET_BUFFER)
 */
export function meetsThreshold(weightedScore: number, runningAvg?: number): boolean {
  const threshold =
    runningAvg !== undefined
      ? Math.max(QUALITY_THRESHOLD, runningAvg - RATCHET_BUFFER)
      : QUALITY_THRESHOLD;
  return weightedScore >= threshold;
}

/**
 * Tracks accepted ad scores and computes a dynamic quality threshold.
 * Threshold = max(7.0, runningAverage - 0.5)
 */
export class QualityRatchet {
  private scores: number[] = [];
  private baseThreshold: number;

  constructor(baseThreshold?: number) {
    this.baseThreshold = baseThreshold ?? QUALITY_THRESHOLD;
  }

  /** Record an accepted ad's weighted score. */
  record(score: number): void {
    this.scores.push(score);
  }

  /** Get the current dynamic threshold. */
  getThreshold(): number {
    const avg = this.getAverage();
    if (avg === undefined) return this.baseThreshold;
    return Math.max(this.baseThreshold, avg - RATCHET_BUFFER);
  }

  /** Check if a score meets the current dynamic threshold. */
  check(score: number): boolean {
    return score >= this.getThreshold();
  }

  /** Get the running average, or undefined if no scores recorded. */
  getAverage(): number | undefined {
    if (this.scores.length === 0) return undefined;
    return this.scores.reduce((sum, s) => sum + s, 0) / this.scores.length;
  }
}
