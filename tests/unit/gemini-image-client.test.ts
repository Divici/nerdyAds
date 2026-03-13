import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LangfuseTraceHandle } from '../../src/utils/langfuse.js';

const mockGenerateContent = vi.fn();

// Mock the @google/genai module
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

import { callGeminiImage } from '../../src/utils/gemini-image-client.js';
import { resetClient } from '../../src/utils/gemini-client.js';

const mockImageResponse = {
  candidates: [
    {
      content: {
        parts: [
          { text: 'A student studying at a desk with VT navy branding' },
          {
            inlineData: {
              data: 'iVBORw0KGgoAAAANSUhEUg==',  // tiny base64 stub
              mimeType: 'image/png',
            },
          },
        ],
      },
    },
  ],
  usageMetadata: {
    promptTokenCount: 200,
    candidatesTokenCount: 1290,
  },
};

describe('callGeminiImage', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    resetClient();
    mockGenerateContent.mockReset();
    mockGenerateContent.mockResolvedValue(mockImageResponse);
  });

  it('returns text blurb and image base64 from response parts', async () => {
    const result = await callGeminiImage('system prompt', 'user prompt');

    expect(result.text).toBe('A student studying at a desk with VT navy branding');
    expect(result.imageBase64).toBe('iVBORw0KGgoAAAANSUhEUg==');
    expect(result.imageMimeType).toBe('image/png');
  });

  it('includes token and cost metadata', async () => {
    const result = await callGeminiImage('system', 'user');

    expect(result.tokensIn).toBe(200);
    expect(result.tokensOut).toBe(1290);
    expect(result.costUsd).toBeGreaterThan(0);
    expect(result.model).toContain('flash');
    expect(result.seed).toBe(42);
    expect(result.promptHash).toBeTruthy();
    expect(result.generatedAt).toBeTruthy();
  });

  it('passes responseModalities to SDK config', async () => {
    await callGeminiImage('system', 'user');

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          responseModalities: ['TEXT', 'IMAGE'],
        }),
      }),
    );
  });

  it('throws when no image data in response', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [{ text: 'No image generated' }],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
    });

    await expect(callGeminiImage('system', 'user')).rejects.toThrow(
      'Gemini image generation returned no image data',
    );
  });

  it('handles response with empty parts array', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [{ content: { parts: [] } }],
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    });

    await expect(callGeminiImage('system', 'user')).rejects.toThrow(
      'Gemini image generation returned no image data',
    );
  });

  it('uses custom seed when provided', async () => {
    const result = await callGeminiImage('system', 'user', { seed: 99 });

    expect(result.seed).toBe(99);
    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ seed: 99 }),
      }),
    );
  });

  it('records Langfuse generation span when trace is provided', async () => {
    const mockEnd = vi.fn();
    const mockGeneration = vi.fn().mockReturnValue({ end: mockEnd });
    const trace: LangfuseTraceHandle = {
      generation: mockGeneration,
      span: vi.fn().mockReturnValue({ end: vi.fn() }),
    };

    await callGeminiImage('system', 'user', { trace });

    expect(mockGeneration).toHaveBeenCalledTimes(1);
    expect(mockGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'callGeminiImage',
        metadata: expect.objectContaining({ role: 'flashImage' }),
      }),
    );
    expect(mockEnd).toHaveBeenCalled();
  });

  it('concatenates multiple text parts', async () => {
    mockGenerateContent.mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              { text: 'First part. ' },
              { text: 'Second part.' },
              { inlineData: { data: 'abc123', mimeType: 'image/png' } },
            ],
          },
        },
      ],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 500 },
    });

    const result = await callGeminiImage('system', 'user');
    expect(result.text).toBe('First part. Second part.');
    expect(result.imageBase64).toBe('abc123');
  });
});
