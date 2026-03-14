import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImageGeneratorAgent } from '../../src/agents/image-generator.js';
import type { Ad } from '../../src/types/ad.js';
import type { Brief } from '../../src/types/brief.js';

// Mock callGeminiImage
vi.mock('../../src/utils/gemini-image-client.js', () => ({
  callGeminiImage: vi.fn().mockResolvedValue({
    text: 'A student studying at a desk with navy blue accents',
    imageBase64: 'iVBORw0KGgoAAAANSUhEUg==',
    imageMimeType: 'image/png',
    tokensIn: 200,
    tokensOut: 1290,
    costUsd: 0.04,
    model: 'gemini-2.5-flash',
    seed: 42,
    promptHash: 'abc123',
    generatedAt: '2026-03-13T00:00:00Z',
  }),
}));

// Mock fs to avoid actual file writes in tests
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

import { callGeminiImage } from '../../src/utils/gemini-image-client.js';
import { writeFile, mkdir } from 'fs/promises';

const mockAd: Ad = {
  id: 'ad-test-001',
  briefId: 'brief-001',
  primaryText: 'Your child is smarter than their SAT score suggests.',
  headline: 'SAT Prep That Works',
  description: 'Expert 1-on-1 tutoring for real score improvement.',
  ctaButton: 'Start Free Trial',
  version: 0,
  metadata: {
    model: 'gemini-2.5-flash',
    seed: 42,
    promptHash: 'abc',
    tokensIn: 100,
    tokensOut: 200,
    costUsd: 0.01,
    generatedAt: '2026-03-13T00:00:00Z',
  },
};

const mockBrief: Brief = {
  id: 'brief-001',
  targetAudience: 'parent',
  campaignGoal: 'conversion',
  emotionalAngle: 'anxiety',
  offer: 'Varsity Tutors SAT test prep',
};

describe('ImageGeneratorAgent', () => {
  const agent = new ImageGeneratorAgent();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates exactly 1 image variant', async () => {
    const variants = await agent.generateVariants(mockAd, mockBrief, 'test-run');
    expect(variants).toHaveLength(1);
    expect(variants[0].variantIndex).toBe(0);
  });

  it('calls callGeminiImage once with the default seed', async () => {
    await agent.generateVariants(mockAd, mockBrief, 'test-run');

    expect(callGeminiImage).toHaveBeenCalledTimes(1);

    const firstCall = vi.mocked(callGeminiImage).mock.calls[0];
    expect(firstCall[2]?.seed).toBe(42);
  });

  it('saves image files to the correct directory', async () => {
    await agent.generateVariants(mockAd, mockBrief, 'test-run');

    expect(mkdir).toHaveBeenCalledWith(
      expect.stringContaining('test-run'),
      { recursive: true },
    );
    expect(writeFile).toHaveBeenCalledTimes(1);

    // Single variant
    const firstPath = vi.mocked(writeFile).mock.calls[0][0] as string;
    expect(firstPath).toContain('ad-test-001-variant-0.png');
  });

  it('includes text blurb from the image generation response', async () => {
    const variants = await agent.generateVariants(mockAd, mockBrief, 'test-run');
    expect(variants[0].blurb).toBe('A student studying at a desk with navy blue accents');
  });

  it('includes metadata with cost and model info', async () => {
    const variants = await agent.generateVariants(mockAd, mockBrief, 'test-run');

    expect(variants[0].metadata.model).toBe('gemini-2.5-flash');
    expect(variants[0].metadata.costUsd).toBe(0.04);
    expect(variants[0].metadata.tokensIn).toBe(200);
    expect(variants[0].metadata.tokensOut).toBe(1290);
  });

  it('sets image paths relative to static serving', async () => {
    const variants = await agent.generateVariants(mockAd, mockBrief, 'run-abc');

    expect(variants[0].imagePath).toBe('/run-abc/images/ad-test-001-variant-0.png');
  });

  it('prompts include ad copy and brief context', async () => {
    await agent.generateVariants(mockAd, mockBrief, 'test-run');

    const firstUserPrompt = vi.mocked(callGeminiImage).mock.calls[0][1];
    expect(firstUserPrompt).toContain('Your child is smarter');
    expect(firstUserPrompt).toContain('parent');
    expect(firstUserPrompt).toContain('anxiety');
    expect(firstUserPrompt).toContain('PHOTO-REALISTIC');
  });
});
