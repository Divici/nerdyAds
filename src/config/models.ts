export interface ModelConfig {
  modelId: string;
  temperature: number;
  maxOutputTokens: number;
}

/** Model configurations for generation and evaluation. */
export const MODELS = {
  flash: {
    modelId: 'gemini-2.0-flash',
    temperature: 0.8,
    maxOutputTokens: 2048,
  },
  pro: {
    modelId: 'gemini-2.0-pro',
    temperature: 0.3,
    maxOutputTokens: 4096,
  },
} as const satisfies Record<string, ModelConfig>;

/**
 * Token pricing in USD per token.
 * Based on Gemini API pricing (as of early 2026).
 */
export const TOKEN_PRICING = {
  flash: {
    inputPerToken: 0.000_000_1,   // $0.10 per 1M input tokens
    outputPerToken: 0.000_000_4,  // $0.40 per 1M output tokens
  },
  pro: {
    inputPerToken: 0.000_001_25,  // $1.25 per 1M input tokens
    outputPerToken: 0.000_005,    // $5.00 per 1M output tokens
  },
} as const;

/** Default seed for reproducibility. */
export const DEFAULT_SEED = 42;
