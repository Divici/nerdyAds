import { z } from 'zod';
import { callGemini } from '../utils/gemini-client.js';
import { WRITER_SYSTEM_PROMPT, buildWriterUserPrompt } from '../config/prompts.js';
import type { Ad } from '../types/ad.js';
import type { Brief } from '../types/brief.js';
import type { CompetitorPattern } from '../types/patterns.js';
import { logger } from '../utils/logger.js';
import { randomUUID } from 'crypto';

const WriterAdSchema = z.object({
  primaryText: z.string().min(1),
  headline: z.string().min(1),
  description: z.string().min(1),
  ctaButton: z.string().min(1),
});

const WriterResponseSchema = z.object({
  ads: z.array(WriterAdSchema).min(1),
});

export class WriterAgent {
  /**
   * Generate a single ad from a brief using Gemini Flash.
   */
  async generateAd(brief: Brief, patterns?: CompetitorPattern): Promise<Ad> {
    const ads = await this.generateRaw(brief, 1, patterns);
    return this.toAd(ads[0], brief, ads[0]._metadata);
  }

  /**
   * Generate a batch of ads from a brief.
   * Throws if the model returns fewer ads than requested.
   */
  async generateBatch(brief: Brief, count: number, patterns?: CompetitorPattern): Promise<Ad[]> {
    const ads = await this.generateRaw(brief, count, patterns);

    if (ads.length < count) {
      throw new Error(
        `Writer generated ${ads.length} ads but ${count} were requested`,
      );
    }

    return ads.slice(0, count).map((raw) =>
      this.toAd(raw, brief, raw._metadata),
    );
  }

  private async generateRaw(
    brief: Brief,
    count: number,
    patterns?: CompetitorPattern,
  ): Promise<Array<z.infer<typeof WriterAdSchema> & { _metadata: { model: string; seed: number; promptHash: string; tokensIn: number; tokensOut: number; costUsd: number; generatedAt: string } }>> {
    const userPrompt = buildWriterUserPrompt(brief, count, patterns);

    logger.debug('Generating ads', { briefId: brief.id, count });

    const result = await callGemini('flash', WRITER_SYSTEM_PROMPT, userPrompt, {
      jsonMode: true,
    });

    const parsed = this.parseResponse(result.text);

    logger.info('Ad generation complete', {
      briefId: brief.id,
      requested: count,
      generated: parsed.ads.length,
    });

    const adCount = parsed.ads.length;
    return parsed.ads.map((ad) => ({
      ...ad,
      _metadata: {
        model: result.model,
        seed: result.seed,
        promptHash: result.promptHash,
        tokensIn: Math.round(result.tokensIn / adCount),
        tokensOut: Math.round(result.tokensOut / adCount),
        costUsd: result.costUsd / adCount,
        generatedAt: result.generatedAt,
      },
    }));
  }

  private toAd(
    raw: z.infer<typeof WriterAdSchema>,
    brief: Brief,
    metadata: { model: string; seed: number; promptHash: string; tokensIn: number; tokensOut: number; costUsd: number; generatedAt: string },
  ): Ad {
    return {
      id: randomUUID(),
      briefId: brief.id,
      primaryText: raw.primaryText,
      headline: raw.headline,
      description: raw.description,
      ctaButton: raw.ctaButton,
      version: 0,
      metadata,
    };
  }

  private parseResponse(text: string): z.infer<typeof WriterResponseSchema> {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Writer returned invalid JSON: ${text.slice(0, 200)}`);
    }

    const result = WriterResponseSchema.safeParse(json);
    if (!result.success) {
      throw new Error(
        `Writer response failed validation: ${result.error.issues.map((i) => i.message).join(', ')}`,
      );
    }

    return result.data;
  }
}
