import { z } from 'zod';
import { callGemini } from '../utils/gemini-client.js';
import { EVALUATOR_SYSTEM_PROMPT, buildEvaluatorUserPrompt, type CalibrationAnchor } from '../config/prompts.js';
import { DimensionScoreSchema, type Evaluation, type DimensionScore } from '../types/evaluation.js';
import type { Ad } from '../types/ad.js';
import type { Brief } from '../types/brief.js';
import { computeWeightedScore, computeConfidence } from '../evaluate/scoring.js';
import { logger } from '../utils/logger.js';

/** Schema for parsing Gemini's evaluation response. */
const EvaluatorResponseSchema = z.object({
  scores: z.array(DimensionScoreSchema).length(5),
});

export class EvaluatorAgent {
  /**
   * Evaluate an ad across 5 quality dimensions using Gemini Pro.
   * Returns a fully computed Evaluation with weighted score and confidence.
   */
  async evaluate(ad: Ad, brief?: Brief, calibrationAnchors?: CalibrationAnchor[]): Promise<Evaluation> {
    const userPrompt = buildEvaluatorUserPrompt(
      {
        primaryText: ad.primaryText,
        headline: ad.headline,
        description: ad.description,
        ctaButton: ad.ctaButton,
      },
      brief
        ? {
            targetAudience: brief.targetAudience,
            campaignGoal: brief.campaignGoal,
            emotionalAngle: brief.emotionalAngle,
            keyMessage: brief.keyMessage,
          }
        : undefined,
      calibrationAnchors,
    );

    logger.debug('Evaluating ad', { adId: ad.id, hasBrief: !!brief });

    const result = await callGemini('pro', EVALUATOR_SYSTEM_PROMPT, userPrompt, {
      jsonMode: true,
    });

    const parsed = this.parseResponse(result.text);
    const weightedScore = computeWeightedScore(parsed.scores);
    const overallConfidence = computeConfidence(parsed.scores);

    const evaluation: Evaluation = {
      adId: ad.id,
      scores: parsed.scores,
      weightedScore,
      overallConfidence,
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

    logger.info('Evaluation complete', {
      adId: ad.id,
      weightedScore,
      overallConfidence,
    });

    return evaluation;
  }

  private parseResponse(text: string): { scores: DimensionScore[] } {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Evaluator returned invalid JSON: ${text.slice(0, 200)}`);
    }

    const result = EvaluatorResponseSchema.safeParse(json);
    if (!result.success) {
      throw new Error(
        `Evaluator response failed validation: ${result.error.issues.map((i) => i.message).join(', ')}`,
      );
    }

    return result.data;
  }
}
