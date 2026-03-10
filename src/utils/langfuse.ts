import { AsyncLocalStorage } from 'node:async_hooks';
import { Langfuse } from 'langfuse';
import { logger } from './logger.js';

/**
 * Langfuse observability wrapper.
 * Initializes a real Langfuse client when LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY
 * are set in the environment. Otherwise operates in no-op mode (no crash, no network calls).
 */

let instance: Langfuse | null = null;
let initialized = false;

/** Minimal interface matching what we use from a Langfuse trace. */
export interface LangfuseTraceHandle {
  generation(params: GenerationParams): LangfuseGenerationHandle;
  span(params: { name: string; metadata?: Record<string, unknown> }): { end(): void };
}

export interface LangfuseGenerationHandle {
  end(params?: { output?: unknown; usage?: { input?: number; output?: number }; metadata?: Record<string, unknown> }): void;
}

export interface GenerationParams {
  name: string;
  model: string;
  input?: unknown;
  output?: unknown;
  usage?: { input?: number; output?: number };
  metadata?: Record<string, unknown>;
  startTime?: Date;
  endTime?: Date;
}

export interface TraceParams {
  name: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

// No-op implementations for when Langfuse is disabled
const noopGeneration: LangfuseGenerationHandle = {
  end: () => {},
};

const noopSpan = { end: () => {} };

const noopTrace: LangfuseTraceHandle = {
  generation: () => noopGeneration,
  span: () => noopSpan,
};

function hasKeys(): boolean {
  return !!(process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY);
}

/** Check whether Langfuse is enabled (keys present in env). */
export function isEnabled(): boolean {
  return hasKeys();
}

/** Get the Langfuse client, or null if keys are not configured. */
export function getLangfuse(): Langfuse | null {
  if (!hasKeys()) {
    if (!initialized) {
      logger.debug('Langfuse disabled — LANGFUSE_SECRET_KEY or LANGFUSE_PUBLIC_KEY not set');
      initialized = true;
    }
    return null;
  }

  if (!instance) {
    instance = new Langfuse({
      secretKey: process.env.LANGFUSE_SECRET_KEY!,
      publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    });
    initialized = true;
    logger.info('Langfuse client initialized', {
      baseUrl: process.env.LANGFUSE_BASE_URL || 'https://cloud.langfuse.com',
    });
  }

  return instance;
}

/** Create a trace (or a no-op trace if Langfuse is disabled). */
export function createTrace(params: TraceParams): LangfuseTraceHandle {
  const client = getLangfuse();
  if (!client) return noopTrace;
  return client.trace(params) as unknown as LangfuseTraceHandle;
}

/** Create a generation span on a trace (or no-op). */
export function createGeneration(
  trace: LangfuseTraceHandle,
  params: GenerationParams,
): LangfuseGenerationHandle {
  return trace.generation(params);
}

/** Flush pending events to Langfuse. */
export async function flush(): Promise<void> {
  const client = getLangfuse();
  if (!client) return;
  await client.flushAsync();
}

/** Shut down the Langfuse client cleanly. */
export async function shutdown(): Promise<void> {
  const client = getLangfuse();
  if (!client) return;
  await client.shutdownAsync();
  instance = null;
  initialized = false;
}

/** Reset internal state (for testing). */
export function resetLangfuse(): void {
  instance = null;
  initialized = false;
}

// --- Trace context (AsyncLocalStorage) ---

const traceContext = new AsyncLocalStorage<LangfuseTraceHandle>();

/** Run a callback with a Langfuse trace available via getActiveTrace(). */
export function withTrace<T>(trace: LangfuseTraceHandle, fn: () => T): T {
  return traceContext.run(trace, fn);
}

/** Get the active trace from the current async context, or null. */
export function getActiveTrace(): LangfuseTraceHandle | null {
  return traceContext.getStore() ?? null;
}
