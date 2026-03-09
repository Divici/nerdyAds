import { z } from 'zod';
import { callGemini } from '../utils/gemini-client.js';
import { EDITOR_SYSTEM_PROMPT, buildEditorUserPrompt } from '../config/prompts.js';
import type { Ad } from '../types/ad.js';
import type { Brief } from '../types/brief.js';
import type { Evaluation } from '../types/evaluation.js';
import { identifyWeakest } from '../evaluate/scoring.js';
import { logger } from '../utils/logger.js';

const EditorAdSchema = z.object({
  primaryText: z.string().min(1),
  headline: z.string().min(1),
  description: z.string().min(1),
  ctaButton: z.string().min(1),
});

const EditorResponseSchema = z.object({
  ad: EditorAdSchema,
});

export class EditorAgent {
  /**
   * Improve an ad by targeting its weakest dimension.
   * Preserves ad ID and briefId, increments version.
   */
  async improve(ad: Ad, evaluation: Evaluation, brief?: Brief): Promise<Ad> {
    const weakest = identifyWeakest(evaluation.scores);
    const userPrompt = buildEditorUserPrompt(ad, evaluation, weakest, brief);

    logger.debug('Improving ad', {
      adId: ad.id,
      version: ad.version,
      weakestDimension: weakest.dimension,
      weakestScore: weakest.score,
    });

    const result = await callGemini('flash', EDITOR_SYSTEM_PROMPT, userPrompt, {
      jsonMode: true,
    });

    const parsed = this.parseResponse(result.text);

    logger.info('Ad improvement complete', {
      adId: ad.id,
      newVersion: ad.version + 1,
      targetedDimension: weakest.dimension,
    });

    return {
      id: ad.id,
      briefId: ad.briefId,
      primaryText: parsed.ad.primaryText,
      headline: parsed.ad.headline,
      description: parsed.ad.description,
      ctaButton: parsed.ad.ctaButton,
      version: ad.version + 1,
      metadata: {
        model: result.model,
        seed: result.seed,
        promptHash: result.promptHash,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: result.costUsd,
        generatedAt: result.generatedAt,
      },
    };
  }

  private parseResponse(text: string): z.infer<typeof EditorResponseSchema> {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Editor returned invalid JSON: ${text.slice(0, 200)}`);
    }

    const result = EditorResponseSchema.safeParse(json);
    if (!result.success) {
      throw new Error(
        `Editor response failed validation: ${result.error.issues.map((i) => i.message).join(', ')}`,
      );
    }

    return result.data;
  }
}
