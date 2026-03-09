import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { callGemini } from '../utils/gemini-client.js';
import { hashPrompt } from '../utils/hash.js';
import { RESEARCHER_SYSTEM_PROMPT, buildResearcherUserPrompt, type CompetitorAdInput } from '../config/prompts.js';
import { CompetitorPatternSchema, type CompetitorPattern } from '../types/patterns.js';
import type { AdMetadata } from '../types/ad.js';
import { logger } from '../utils/logger.js';

/** Re-export for convenience so callers can import from agents. */
export type { CompetitorAdInput as CompetitorAd } from '../config/prompts.js';

export interface ResearcherResult {
  pattern: CompetitorPattern;
  metadata: AdMetadata;
  /** Whether the result was loaded from cache instead of a fresh API call. */
  cached: boolean;
}

interface CachedPatterns {
  inputHash: string;
  pattern: CompetitorPattern;
  metadata: AdMetadata;
}

const CACHE_FILENAME = 'patterns.json';

export interface ResearcherOptions {
  /** Directory to read/write patterns cache. If omitted, caching is disabled. */
  cacheDir?: string;
}

export class ResearcherAgent {
  private cacheDir?: string;

  constructor(options?: ResearcherOptions) {
    this.cacheDir = options?.cacheDir;
  }

  /** Deterministic SHA-256 hash of the competitor ads input (for cache invalidation). */
  hashInput(ads: CompetitorAdInput[]): string {
    return hashPrompt(JSON.stringify(ads));
  }

  /**
   * Analyze competitor ads to extract patterns for the writer agent.
   * Returns cached result if the input hasn't changed; otherwise calls Gemini Pro.
   */
  async analyzePatterns(competitorAds: CompetitorAdInput[]): Promise<ResearcherResult> {
    const inputHash = this.hashInput(competitorAds);

    // Try loading from cache
    if (this.cacheDir) {
      const cached = await this.loadCache();
      if (cached && cached.inputHash === inputHash) {
        logger.info('Using cached competitor patterns (input unchanged)', {
          cacheDir: this.cacheDir,
        });
        return { pattern: cached.pattern, metadata: cached.metadata, cached: true };
      }
    }

    // Cache miss or no cache configured — call API
    const userPrompt = buildResearcherUserPrompt(competitorAds);
    logger.debug('Analyzing competitor patterns', { adCount: competitorAds.length });

    const result = await callGemini('pro', RESEARCHER_SYSTEM_PROMPT, userPrompt, {
      jsonMode: true,
    });

    const parsed = this.parseResponse(result.text);

    const metadata: AdMetadata = {
      model: result.model,
      seed: result.seed,
      promptHash: result.promptHash,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costUsd: result.costUsd,
      generatedAt: result.generatedAt,
    };

    logger.info('Pattern analysis complete', {
      hookTypes: parsed.hookTypes.length,
      emotionalAngles: parsed.emotionalAngles.length,
      structuralPatterns: parsed.structuralPatterns.length,
    });

    // Save to cache
    if (this.cacheDir) {
      await this.saveCache({ inputHash, pattern: parsed, metadata });
    }

    return { pattern: parsed, metadata, cached: false };
  }

  private async loadCache(): Promise<CachedPatterns | null> {
    if (!this.cacheDir) return null;
    try {
      const filePath = path.join(this.cacheDir, CACHE_FILENAME);
      const content = await readFile(filePath, 'utf8');
      return JSON.parse(content) as CachedPatterns;
    } catch {
      return null;
    }
  }

  private async saveCache(data: CachedPatterns): Promise<void> {
    if (!this.cacheDir) return;
    await mkdir(this.cacheDir, { recursive: true });
    const filePath = path.join(this.cacheDir, CACHE_FILENAME);
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    logger.debug('Saved patterns cache', { filePath });
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
