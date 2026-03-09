import { GoogleGenAI } from '@google/genai';
import { MODELS, TOKEN_PRICING, DEFAULT_SEED, type ModelConfig } from '../config/models.js';
import { RateLimiter } from './rate-limiter.js';
import { hashPrompt } from './hash.js';
import { logger } from './logger.js';

export interface GeminiCallResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  model: string;
  seed: number;
  promptHash: string;
  generatedAt: string;
}

export type ModelRole = 'flash' | 'pro';

const rateLimiter = new RateLimiter({
  minDelayMs: 100,
  maxConcurrent: 5,
  maxRetries: 3,
  backoffBaseMs: 1000,
});

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/** Reset the client (useful for testing). */
export function resetClient(): void {
  client = null;
}

function computeCost(
  role: ModelRole,
  tokensIn: number,
  tokensOut: number,
): number {
  const pricing = TOKEN_PRICING[role];
  return tokensIn * pricing.inputPerToken + tokensOut * pricing.outputPerToken;
}

/**
 * Call Gemini with rate limiting, seed, JSON mode, and metadata extraction.
 */
export async function callGemini(
  role: ModelRole,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    seed?: number;
    jsonMode?: boolean;
    temperature?: number;
  },
): Promise<GeminiCallResult> {
  const modelConfig: ModelConfig = MODELS[role];
  const seed = options?.seed ?? DEFAULT_SEED;
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const promptHash = hashPrompt(fullPrompt);

  const result = await rateLimiter.execute(async () => {
    const ai = getClient();
    const response = await ai.models.generateContent({
      model: modelConfig.modelId,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: options?.temperature ?? modelConfig.temperature,
        seed,
        responseMimeType: options?.jsonMode ? 'application/json' : undefined,
        maxOutputTokens: modelConfig.maxOutputTokens,
      },
    });

    // response.text can be undefined on thinking models when MAX_TOKENS is hit
    // or when the response only contains thinking tokens. Fall back to extracting from candidates.
    let text = response.text ?? '';
    if (!text && response.candidates?.[0]?.content?.parts) {
      text = response.candidates[0].content.parts
        .filter((p: { text?: string }) => p.text)
        .map((p: { text?: string }) => p.text)
        .join('');
    }
    const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
    const tokensOut = response.usageMetadata?.candidatesTokenCount ?? 0;
    const costUsd = computeCost(role, tokensIn, tokensOut);

    logger.debug('Gemini call completed', {
      model: modelConfig.modelId,
      tokensIn,
      tokensOut,
      costUsd,
    });

    return {
      text,
      tokensIn,
      tokensOut,
      costUsd,
      model: modelConfig.modelId,
      seed,
      promptHash,
      generatedAt: new Date().toISOString(),
    };
  });

  return result;
}
