import { useState, useCallback } from 'react';
import type { AdImageResult } from '../types.ts';

const API_BASE = '/api';

export function useImageGeneration() {
  const [imageResult, setImageResult] = useState<AdImageResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateImages = useCallback(
    async (adId: string, runId: string, briefId: string, ad?: Record<string, unknown>): Promise<AdImageResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/ads/${adId}/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, briefId, ad }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const result: AdImageResult = await res.json();
        setImageResult(result);
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const confirmImage = useCallback(
    async (adId: string, runId: string, variantIndex: number): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/ads/${adId}/confirm-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, variantIndex }),
        });
        if (!res.ok) return false;
        setImageResult((prev) =>
          prev ? { ...prev, confirmedVariant: variantIndex } : prev,
        );
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  const loadExistingImage = useCallback(
    async (adId: string, runId: string): Promise<AdImageResult | null> => {
      try {
        const res = await fetch(`${API_BASE}/ads/${adId}/image-result?runId=${runId}`);
        if (!res.ok) return null;
        const result: AdImageResult = await res.json();
        setImageResult(result);
        return result;
      } catch {
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setImageResult(null);
    setError(null);
    setLoading(false);
  }, []);

  return { imageResult, loading, error, generateImages, confirmImage, loadExistingImage, reset };
}
