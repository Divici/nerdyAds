import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LangfuseTraceHandle } from '../../src/utils/langfuse.js';

// Mock the @google/genai module
vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: vi.fn().mockResolvedValue({
        text: '{"result": "test"}',
        usageMetadata: {
          promptTokenCount: 100,
          candidatesTokenCount: 50,
        },
      }),
    },
  })),
}));

import { callGemini, resetClient } from '../../src/utils/gemini-client.js';

describe('callGemini langfuse instrumentation', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    resetClient();
  });

  it('creates a generation span when trace is provided', async () => {
    const mockEnd = vi.fn();
    const mockGeneration = vi.fn().mockReturnValue({ end: mockEnd });
    const trace: LangfuseTraceHandle = {
      generation: mockGeneration,
      span: vi.fn().mockReturnValue({ end: vi.fn() }),
    };

    await callGemini('flash', 'system prompt', 'user prompt', {
      trace,
    });

    expect(mockGeneration).toHaveBeenCalledTimes(1);
    expect(mockGeneration).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'callGemini-flash',
        model: expect.stringContaining('flash'),
        input: { system: 'system prompt', user: 'user prompt' },
        output: '{"result": "test"}',
        usage: { input: 100, output: 50 },
        metadata: expect.objectContaining({
          role: 'flash',
          seed: expect.any(Number),
          promptHash: expect.any(String),
          costUsd: expect.any(Number),
        }),
        startTime: expect.any(Date),
        endTime: expect.any(Date),
      }),
    );
    expect(mockEnd).toHaveBeenCalled();
  });

  it('uses custom spanName when provided', async () => {
    const mockGeneration = vi.fn().mockReturnValue({ end: vi.fn() });
    const trace: LangfuseTraceHandle = {
      generation: mockGeneration,
      span: vi.fn().mockReturnValue({ end: vi.fn() }),
    };

    await callGemini('pro', 'sys', 'usr', {
      trace,
      spanName: 'evaluator-score',
    });

    expect(mockGeneration).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'evaluator-score' }),
    );
  });

  it('does not create generation span when trace is not provided', async () => {
    // Just calling without trace should not throw
    const result = await callGemini('flash', 'sys', 'usr');
    expect(result.text).toBe('{"result": "test"}');
  });
});
