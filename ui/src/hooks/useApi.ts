import { useState, useCallback } from 'react';
import type { Brief, PipelineResult } from '../types.ts';

const API_BASE = '/api';

export function useApi() {
  const [loading, setLoading] = useState(false);

  const fetchBriefs = useCallback(async (): Promise<Brief[]> => {
    const res = await fetch(`${API_BASE}/briefs`);
    return res.json();
  }, []);

  const fetchRuns = useCallback(async () => {
    const res = await fetch(`${API_BASE}/runs`);
    return res.json();
  }, []);

  const fetchRun = useCallback(async (runId: string): Promise<PipelineResult> => {
    const res = await fetch(`${API_BASE}/runs/${runId}`);
    return res.json();
  }, []);

  const startGeneration = useCallback(
    async (briefId?: string): Promise<{ runId: string; briefCount: number }> => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ briefId }),
        });
        return res.json();
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { fetchBriefs, fetchRuns, fetchRun, startGeneration, loading };
}
