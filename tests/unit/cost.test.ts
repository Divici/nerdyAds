import { describe, it, expect } from 'vitest';
import { calculateCost, aggregateCosts } from '../../src/metrics/cost.js';
import type { AdMetadata } from '../../src/types/ad.js';

describe('calculateCost', () => {
  it('calculates cost for flash model', () => {
    const cost = calculateCost('flash', 1000, 500);
    // flash: input $0.10/1M = 0.0000001/token, output $0.40/1M = 0.0000004/token
    // 1000 * 0.0000001 + 500 * 0.0000004 = 0.0001 + 0.0002 = 0.0003
    expect(cost).toBeCloseTo(0.0003, 8);
  });

  it('calculates cost for pro model', () => {
    const cost = calculateCost('pro', 2000, 1000);
    // pro: input $1.25/1M = 0.00000125/token, output $5.00/1M = 0.000005/token
    // 2000 * 0.00000125 + 1000 * 0.000005 = 0.0025 + 0.005 = 0.0075
    expect(cost).toBeCloseTo(0.0075, 8);
  });

  it('returns 0 for zero tokens', () => {
    expect(calculateCost('flash', 0, 0)).toBe(0);
    expect(calculateCost('pro', 0, 0)).toBe(0);
  });

  it('handles large token counts', () => {
    const cost = calculateCost('flash', 1_000_000, 1_000_000);
    // 1M * 0.0000001 + 1M * 0.0000004 = 0.10 + 0.40 = 0.50
    expect(cost).toBeCloseTo(0.5, 4);
  });
});

describe('aggregateCosts', () => {
  it('sums costs from multiple metadata entries', () => {
    const metadatas: Pick<AdMetadata, 'costUsd'>[] = [
      { costUsd: 0.001 },
      { costUsd: 0.002 },
      { costUsd: 0.003 },
    ];
    expect(aggregateCosts(metadatas)).toBeCloseTo(0.006, 8);
  });

  it('returns 0 for empty array', () => {
    expect(aggregateCosts([])).toBe(0);
  });

  it('handles single entry', () => {
    expect(aggregateCosts([{ costUsd: 0.05 }])).toBeCloseTo(0.05, 8);
  });
});
