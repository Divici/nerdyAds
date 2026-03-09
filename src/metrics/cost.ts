import { TOKEN_PRICING } from '../config/models.js';

export type ModelTier = keyof typeof TOKEN_PRICING;

/**
 * Calculate USD cost for a single API call given model tier and token counts.
 */
export function calculateCost(model: ModelTier, tokensIn: number, tokensOut: number): number {
  const pricing = TOKEN_PRICING[model];
  return tokensIn * pricing.inputPerToken + tokensOut * pricing.outputPerToken;
}

/**
 * Sum costUsd from an array of metadata-like objects.
 */
export function aggregateCosts(items: Pick<{ costUsd: number }, 'costUsd'>[]): number {
  return items.reduce((sum, item) => sum + item.costUsd, 0);
}
