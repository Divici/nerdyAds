import { z } from 'zod';
import { callGemini } from '../utils/gemini-client.js';
import { RESEARCHER_SYSTEM_PROMPT, buildResearcherUserPrompt, type CompetitorAdInput } from '../config/prompts.js';
import { CompetitorPatternSchema, type CompetitorPattern } from '../types/patterns.js';
import type { AdMetadata } from '../types/ad.js';
import { logger } from '../utils/logger.js';

/** Re-export for convenience so callers can import from agents. */
export type { CompetitorAdInput as CompetitorAd } from '../config/prompts.js';

export interface ResearcherResult {
  pattern: CompetitorPattern;
  metadata: AdMetadata;
}

export class ResearcherAgent {
  /**
   * Analyze competitor ads to extract patterns for the writer agent.
   * Uses Gemini Pro for deeper analysis.
   */
  async analyzePatterns(competitorAds: CompetitorAdInput[]): Promise<ResearcherResult> {
    const userPrompt = buildResearcherUserPrompt(competitorAds);

    logger.debug('Analyzing competitor patterns', { adCount: competitorAds.length });

    const result = await callGemini('pro', RESEARCHER_SYSTEM_PROMPT, userPrompt, {
      jsonMode: true,
    });

    const parsed = this.parseResponse(result.text);

    logger.info('Pattern analysis complete', {
      hookTypes: parsed.hookTypes.length,
      emotionalAngles: parsed.emotionalAngles.length,
      structuralPatterns: parsed.structuralPatterns.length,
    });

    return {
      pattern: parsed,
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

  private parseResponse(text: string): CompetitorPattern {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Researcher returned invalid JSON: ${text.slice(0, 200)}`);
    }

    const result = CompetitorPatternSchema.safeParse(json);
    if (!result.success) {
      throw new Error(
        `Researcher response failed validation: ${result.error.issues.map((i) => i.message).join(', ')}`,
      );
    }

    return result.data;
  }
}
