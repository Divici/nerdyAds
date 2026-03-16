import { callGeminiImage, type ReferenceImage } from '../utils/gemini-image-client.js';
import {
  IMAGE_GENERATOR_SYSTEM_PROMPT,
  buildImageUserPrompt,
} from '../config/prompts.js';
import type { Ad } from '../types/ad.js';
import type { Brief } from '../types/brief.js';
import type { ImageVariant } from '../types/image.js';
import { logger } from '../utils/logger.js';
import { DEFAULT_SEED } from '../config/models.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const OUTPUT_DIR = join(process.cwd(), 'data', 'output');
const REFERENCE_DIR = join(process.cwd(), 'data', 'reference');

// VT top-performing ad images used as style references
const REFERENCE_IMAGE_FILES = [
  'nerdy-top-ad-1.png',
  'nerdy-top-ad-2.png',
  'nerdy-top-ad-3.png',
];

let cachedReferenceImages: ReferenceImage[] | null = null;

async function loadReferenceImages(): Promise<ReferenceImage[]> {
  if (cachedReferenceImages) return cachedReferenceImages;

  const images: ReferenceImage[] = [];
  for (const filename of REFERENCE_IMAGE_FILES) {
    const filePath = join(REFERENCE_DIR, filename);
    if (existsSync(filePath)) {
      const buffer = await readFile(filePath);
      images.push({
        base64: buffer.toString('base64'),
        mimeType: 'image/png',
      });
    }
  }

  cachedReferenceImages = images;
  logger.info('Loaded reference images for style anchoring', { count: images.length });
  return images;
}

export class ImageGeneratorAgent {
  /**
   * Generate 1 image for an accepted ad.
   * Sends VT top-performing ad images as style references.
   */
  async generateVariants(
    ad: Ad,
    brief: Brief,
    runId: string,
  ): Promise<ImageVariant[]> {
    const imagesDir = join(OUTPUT_DIR, runId, 'images');
    await mkdir(imagesDir, { recursive: true });

    // Load reference images for style anchoring
    const referenceImages = await loadReferenceImages();

    const variants: ImageVariant[] = [];

    for (let variantIndex = 0; variantIndex < 1; variantIndex++) {
      const userPrompt = buildImageUserPrompt(ad, brief, variantIndex);
      const seed = DEFAULT_SEED + variantIndex;

      logger.info('Generating image variant', {
        adId: ad.id,
        variantIndex,
        briefId: brief.id,
        referenceImagesCount: referenceImages.length,
      });

      const result = await callGeminiImage(
        IMAGE_GENERATOR_SYSTEM_PROMPT,
        userPrompt,
        {
          seed,
          spanName: `image-gen-variant-${variantIndex}`,
          referenceImages: referenceImages.length > 0 ? referenceImages : undefined,
        },
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
