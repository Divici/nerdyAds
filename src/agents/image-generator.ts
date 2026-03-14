import { callGeminiImage } from '../utils/gemini-image-client.js';
import {
  IMAGE_GENERATOR_SYSTEM_PROMPT,
  buildImageUserPrompt,
} from '../config/prompts.js';
import type { Ad } from '../types/ad.js';
import type { Brief } from '../types/brief.js';
import type { ImageVariant } from '../types/image.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_SEED } from '../config/models.js';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const OUTPUT_DIR = join(process.cwd(), 'data', 'output');

export class ImageGeneratorAgent {
  /**
   * Generate 1 image for an accepted ad.
   * Variant 0: photo-realistic style
   */
  async generateVariants(
    ad: Ad,
    brief: Brief,
    runId: string,
  ): Promise<ImageVariant[]> {
    const imagesDir = join(OUTPUT_DIR, runId, 'images');
    await mkdir(imagesDir, { recursive: true });

    const variants: ImageVariant[] = [];

    for (let variantIndex = 0; variantIndex < 1; variantIndex++) {
      const userPrompt = buildImageUserPrompt(ad, brief, variantIndex);
      const seed = DEFAULT_SEED + variantIndex;

      logger.info('Generating image variant', {
        adId: ad.id,
        variantIndex,
        briefId: brief.id,
      });

      const result = await callGeminiImage(
        IMAGE_GENERATOR_SYSTEM_PROMPT,
        userPrompt,
        { seed, spanName: `image-gen-variant-${variantIndex}` },
      );

      // Save image to disk
      const filename = `${ad.id}-variant-${variantIndex}.png`;
      const filePath = join(imagesDir, filename);
      const imageBuffer = Buffer.from(result.imageBase64, 'base64');
      await writeFile(filePath, imageBuffer);

      // The serving path relative to the static middleware
      const imagePath = `/${runId}/images/${filename}`;

      variants.push({
        variantIndex,
        imagePath,
        blurb: result.text,
        metadata: {
          model: result.model,
          seed: result.seed,
          promptHash: result.promptHash,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          costUsd: result.costUsd,
          generatedAt: result.generatedAt,
        },
      });

      logger.info('Image variant saved', {
        adId: ad.id,
        variantIndex,
        filePath,
        blurbLength: result.text.length,
        costUsd: result.costUsd,
      });
    }

    return variants;
  }
}
