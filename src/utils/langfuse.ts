import { logger } from './logger.js';

/**
 * Langfuse observability stub.
 * Logs traces locally as structured JSON. Can be replaced with real
 * Langfuse client when LANGFUSE_SECRET_KEY and LANGFUSE_PUBLIC_KEY
 * environment variables are set.
 */

export interface TraceEvent {
  traceId: string;
  name: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
  startTime: string;
  endTime?: string;
}

const traces: TraceEvent[] = [];

export function startTrace(name: string, input?: unknown): TraceEvent {
  const event: TraceEvent = {
    traceId: `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    input,
    startTime: new Date().toISOString(),
  };
  traces.push(event);
  logger.debug('Trace started', { traceId: event.traceId, name });
  return event;
}

export function endTrace(
  event: TraceEvent,
  output?: unknown,
  metadata?: Record<string, unknown>,
): void {
  event.output = output;
  event.metadata = metadata;
  event.endTime = new Date().toISOString();
  logger.debug('Trace ended', { traceId: event.traceId, name: event.name });
}

/** Get all collected traces (for snapshot/debugging). */
export function getTraces(): readonly TraceEvent[] {
  return traces;
}

/** Clear collected traces. */
export function clearTraces(): void {
  traces.length = 0;
}
