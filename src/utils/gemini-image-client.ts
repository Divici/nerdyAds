import { MODELS, TOKEN_PRICING, DEFAULT_SEED, type ModelConfig } from '../config/models.js';
import { getClient, rateLimiter } from './gemini-client.js';
import { hashPrompt } from './hash.js';
import { logger } from './logger.js';
import { getActiveTrace, type LangfuseTraceHandle } from './langfuse.js';

export interface GeminiImageCallResult {
  text: string;
  imageBase64: string;
  imageMimeType: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  model: string;
  seed: number;
  promptHash: string;
  generatedAt: string;
}

function computeImageCost(tokensIn: number, tokensOut: number): number {
  const pricing = TOKEN_PRICING.flashImage;
  return tokensIn * pricing.inputPerToken + tokensOut * pricing.outputPerToken;
}

/**
 * Call Gemini with responseModalities: ['TEXT', 'IMAGE'] to generate
 * both a text blurb and an image in a single call.
 */
export interface ReferenceImage {
  base64: string;
  mimeType: string;
}

export async function callGeminiImage(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    seed?: number;
    temperature?: number;
    trace?: LangfuseTraceHandle;
    spanName?: string;
    referenceImages?: ReferenceImage[];
  },
): Promise<GeminiImageCallResult> {
  const modelConfig: ModelConfig = MODELS.flashImage;
  const seed = options?.seed ?? DEFAULT_SEED;
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const promptHash = hashPrompt(fullPrompt);
  const startTime = new Date();

  // Build contents: reference images first, then text prompt
  const contentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
  if (options?.referenceImages?.length) {
    contentParts.push({ text: 'Here are reference images showing the style I want. Generate a NEW image inspired by these styles:' });
    for (const ref of options.referenceImages) {
      contentParts.push({ inlineData: { mimeType: ref.mimeType, data: ref.base64 } });
    }
  }
  contentParts.push({ text: userPrompt });

  // Rate-limit only the API call — validation happens outside to avoid retrying on parse errors
  const response = await rateLimiter.execute(async () => {
    const ai = getClient();
    return ai.models.generateContent({
      model: modelConfig.modelId,
      contents: contentParts,
      config: {
        systemInstruction: systemPrompt,
        temperature: options?.temperature ?? modelConfig.temperature,
        seed,
        responseModalities: ['TEXT', 'IMAGE'] as unknown as undefined,
        maxOutputTokens: modelConfig.maxOutputTokens,
      },
    });
  });

  // Parse response parts — separate text from inline image data
  let text = '';
  let imageBase64 = '';
  let imageMimeType = 'image/png';

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.text) {
      text += part.text;
    }
    if (part.inlineData) {
      imageBase64 = part.inlineData.data ?? '';
      imageMimeType = part.inlineData.mimeType ?? 'image/png';
    }
  }

  if (!imageBase64) {
    throw new Error('Gemini image generation returned no image data');
  }

  const tokensIn = response.usageMetadata?.promptTokenCount ?? 0;
  const tokensOut = response.usageMetadata?.candidatesTokenCount ?? 0;
  const costUsd = computeImageCost(tokensIn, tokensOut);

  logger.debug('Gemini image call completed', {
    model: modelConfig.modelId,
    tokensIn,
    tokensOut,
    costUsd,
    hasImage: !!imageBase64,
    textLength: text.length,
  });

  const result: GeminiImageCallResult = {
    text,
    imageBase64,
    imageMimeType,
    tokensIn,
    tokensOut,
    costUsd,
    model: modelConfig.modelId,
    seed,
    promptHash,
    generatedAt: new Date().toISOString(),
  };

  // Record Langfuse generation span
  const activeTrace = options?.trace ?? getActiveTrace();
  if (activeTrace) {
    const gen = activeTrace.generation({
      name: options?.spanName ?? 'callGeminiImage',
      model: modelConfig.modelId,
      input: { system: systemPrompt, user: userPrompt },
      output: result.text,
      usage: { input: result.tokensIn, output: result.tokensOut },
      metadata: {
        costUsd: result.costUsd,
        seed: result.seed,
        promptHash: result.promptHash,
        role: 'flashImage',
        hasImage: !!result.imageBase64,
      },
      startTime,
      endTime: new Date(),
    });
    gen.end();
  }

  return result;
}
