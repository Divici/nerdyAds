import { useEffect, useRef, useCallback } from 'react';
import type { SSEEventType } from '../types.ts';

type SSEHandler = (data: unknown) => void;

export function useSSE(
  runId: string | null,
  handlers: Partial<Record<SSEEventType, SSEHandler>>,
) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!runId) return;

    const es = new EventSource(`/api/generate/${runId}/stream`);
    eventSourceRef.current = es;

    const eventTypes: SSEEventType[] = [
      'round:start',
      'ad:generating',
      'ad:evaluating',
      'ad:accepted',
      'ad:rejected',
      'ad:improving',
      'brief:complete',
      'pipeline:complete',
      'pipeline:error',
    ];

    for (const type of eventTypes) {
      es.addEventListener(type, (event) => {
        const handler = handlersRef.current[type];
        if (handler) {
          try {
            handler(JSON.parse((event as MessageEvent).data));
          } catch {
            handler((event as MessageEvent).data);
          }
        }
      });
    }

    es.onerror = () => {
      // EventSource auto-reconnects; we just log
      console.warn('SSE connection error for run', runId);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [runId]);

  const close = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  return { close };
}
