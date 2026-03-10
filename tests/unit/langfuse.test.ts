import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll test the langfuse module by controlling env vars and mocking the langfuse package.

// Mock the langfuse package
const mockGeneration = vi.fn().mockReturnValue({ end: vi.fn() });
const mockSpan = vi.fn().mockReturnValue({ end: vi.fn() });
const mockTrace = vi.fn().mockReturnValue({
  generation: mockGeneration,
  span: mockSpan,
});
const mockFlushAsync = vi.fn().mockResolvedValue(undefined);
const mockShutdownAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('langfuse', () => ({
  Langfuse: vi.fn().mockImplementation(() => ({
    trace: mockTrace,
    flushAsync: mockFlushAsync,
    shutdownAsync: mockShutdownAsync,
  })),
}));

// Must import after mock setup
import {
  getLangfuse,
  createTrace,
  createGeneration,
  flush,
  shutdown,
  isEnabled,
  resetLangfuse,
  withTrace,
  getActiveTrace,
} from '../../src/utils/langfuse.js';

describe('langfuse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLangfuse();
  });

  afterEach(() => {
    // Clean up env
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_PUBLIC_KEY;
    resetLangfuse();
  });

  describe('no-op mode (no keys)', () => {
    it('does not crash when keys are missing', () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;

      expect(() => getLangfuse()).not.toThrow();
    });

    it('returns null client when keys are missing', () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;

      const client = getLangfuse();
      expect(client).toBeNull();
    });

    it('reports disabled when no keys', () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;

      expect(isEnabled()).toBe(false);
    });

    it('createTrace returns a no-op trace when disabled', () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;

      const trace = createTrace({ name: 'test' });
      expect(trace).not.toBeNull();
      // no-op trace should have generation and span methods that don't throw
      expect(() => trace.generation({ name: 'gen', model: 'test' })).not.toThrow();
      expect(() => trace.span({ name: 'span' })).not.toThrow();
    });

    it('createGeneration returns a no-op object when disabled', () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;

      const trace = createTrace({ name: 'test' });
      const gen = createGeneration(trace, {
        name: 'gen',
        model: 'gemini-2.0-flash',
        input: 'hello',
      });
      expect(gen).toBeDefined();
      expect(() => gen.end()).not.toThrow();
    });

    it('flush and shutdown do not throw when disabled', async () => {
      delete process.env.LANGFUSE_SECRET_KEY;
      delete process.env.LANGFUSE_PUBLIC_KEY;

      await expect(flush()).resolves.not.toThrow();
      await expect(shutdown()).resolves.not.toThrow();
    });
  });

  describe('enabled mode (with keys)', () => {
    beforeEach(() => {
      process.env.LANGFUSE_SECRET_KEY = 'sk-test-key';
      process.env.LANGFUSE_PUBLIC_KEY = 'pk-test-key';
      resetLangfuse();
    });

    it('returns a real client when keys are set', () => {
      const client = getLangfuse();
      expect(client).not.toBeNull();
    });

    it('reports enabled when keys are set', () => {
      expect(isEnabled()).toBe(true);
    });

    it('createTrace delegates to langfuse client', () => {
      const trace = createTrace({
        name: 'pipeline-brief',
        metadata: { runId: 'run-1', briefId: 'brief-1' },
        tags: ['phase8.7'],
      });
      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'pipeline-brief',
          metadata: { runId: 'run-1', briefId: 'brief-1' },
          tags: ['phase8.7'],
        }),
      );
      expect(trace).toBeDefined();
    });

    it('createGeneration attaches to trace with correct metadata', () => {
      const trace = createTrace({ name: 'test' });
      const gen = createGeneration(trace, {
        name: 'callGemini',
        model: 'gemini-2.0-flash',
        input: { system: 'sys', user: 'usr' },
        output: 'response',
        usage: { input: 100, output: 50 },
        metadata: { costUsd: 0.001, seed: 42, promptHash: 'abc123' },
      });

      expect(mockGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'callGemini',
          model: 'gemini-2.0-flash',
          input: { system: 'sys', user: 'usr' },
          output: 'response',
          usage: { input: 100, output: 50 },
          metadata: { costUsd: 0.001, seed: 42, promptHash: 'abc123' },
        }),
      );
      expect(gen).toBeDefined();
    });

    it('flush delegates to langfuse flushAsync', async () => {
      // Initialize the client first
      getLangfuse();
      await flush();
      expect(mockFlushAsync).toHaveBeenCalled();
    });

    it('shutdown delegates to langfuse shutdownAsync', async () => {
      getLangfuse();
      await shutdown();
      expect(mockShutdownAsync).toHaveBeenCalled();
    });
  });

  describe('trace context (AsyncLocalStorage)', () => {
    it('getActiveTrace returns null outside withTrace', () => {
      expect(getActiveTrace()).toBeNull();
    });

    it('getActiveTrace returns trace inside withTrace', () => {
      const fakeTrace = {
        generation: vi.fn().mockReturnValue({ end: vi.fn() }),
        span: vi.fn().mockReturnValue({ end: vi.fn() }),
      };
      let captured: unknown = null;
      withTrace(fakeTrace, () => {
        captured = getActiveTrace();
      });
      expect(captured).toBe(fakeTrace);
    });

    it('getActiveTrace returns null after withTrace exits', () => {
      const fakeTrace = {
        generation: vi.fn().mockReturnValue({ end: vi.fn() }),
        span: vi.fn().mockReturnValue({ end: vi.fn() }),
      };
      withTrace(fakeTrace, () => {});
      expect(getActiveTrace()).toBeNull();
    });

    it('withTrace works with async functions', async () => {
      const fakeTrace = {
        generation: vi.fn().mockReturnValue({ end: vi.fn() }),
        span: vi.fn().mockReturnValue({ end: vi.fn() }),
      };
      let captured: unknown = null;
      await withTrace(fakeTrace, async () => {
        await new Promise((r) => setTimeout(r, 1));
        captured = getActiveTrace();
      });
      expect(captured).toBe(fakeTrace);
    });
  });
});
