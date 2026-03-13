import { z } from 'zod';
import { callGemini } from '../utils/gemini-client.js';
import {
  VISUAL_EVALUATOR_SYSTEM_PROMPT,
  buildVisualEvalUserPrompt,
} from '../config/prompts.js';
import type { Ad } from '../types/ad.js';
import type { Brief } from '../types/brief.js';
import type { ImageVariant, VisualDimensionScore } from '../types/image.js';
import { VisualDimensionScoreSchema } from '../types/image.js';
import { logger } from '../utils/logger.js';

const VisualEvalResponseSchema = z.object({
  scores: z.array(VisualDimensionScoreSchema).length(3),
});

export class VisualEvaluatorAgent {
  /**
   * Evaluate an image variant by comparing its text blurb to the ad copy.
   * Uses Gemini Pro for stronger judgment (text-only call).
   * Returns 3 visual dimension scores (informational, no blocking threshold).
   */
  async evaluate(
    variant: ImageVariant,
    ad: Ad,
    brief: Brief,
  ): Promise<VisualDimensionScore[]> {
    const userPrompt = buildVisualEvalUserPrompt(variant, ad, brief);

    logger.info('Evaluating image variant', {
      adId: ad.id,
      variantIndex: variant.variantIndex,
    });

    const result = await callGemini(
      'flash',
      VISUAL_EVALUATOR_SYSTEM_PROMPT,
      userPrompt,
      { jsonMode: true, spanName: `visual-eval-variant-${variant.variantIndex}` },
    );

    const parsed = VisualEvalResponseSchema.parse(JSON.parse(result.text));

    logger.info('Visual evaluation complete', {
      adId: ad.id,
      variantIndex: variant.variantIndex,
      scores: parsed.scores.map((s) => ({ dim: s.dimension, score: s.score })),
    });

    return parsed.scores;
  }
}
