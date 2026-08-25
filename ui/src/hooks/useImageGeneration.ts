import { useCallback, useSyncExternalStore } from 'react';
import type { AdImageResult } from '../types.ts';

const API_BASE = '/api';
const GENERATE_TIMEOUT_MS = 90_000; // 90 second timeout

// ── Shared store keyed by adId ──────────────────────────────────
interface ImageState {
  imageResult: AdImageResult | null;
  loading: boolean;
  error: string | null;
}

const defaultState: ImageState = { imageResult: null, loading: false, error: null };
const store = new Map<string, ImageState>();
const listeners = new Set<() => void>();

function getState(adId: string): ImageState {
  return store.get(adId) ?? defaultState;
}

function setState(adId: string, patch: Partial<ImageState>) {
  const prev = getState(adId);
  store.set(adId, { ...prev, ...patch });
  listeners.forEach((l) => l());
}

// In-flight request tracking to prevent duplicate calls
const inflight = new Map<string, AbortController>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

// ── Hook ────────────────────────────────────────────────────────
export function useImageGeneration(adId: string) {
  // Subscribe to shared store for this adId
  const state = useSyncExternalStore(
    subscribe,
    () => getState(adId),
  );

  const generateImages = useCallback(
    async (runId: string, briefId: string, ad?: Record<string, unknown>): Promise<AdImageResult | null> => {
      // Prevent duplicate in-flight requests for the same ad
      if (inflight.has(adId)) return null;

      const controller = new AbortController();
      inflight.set(adId, controller);
      setState(adId, { loading: true, error: null });

      // Timeout
      const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

      try {
        const res = await fetch(`${API_BASE}/ads/${adId}/generate-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, briefId, ad }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        const result: AdImageResult = await res.json();
        setState(adId, { imageResult: result, loading: false });
        return result;
      } catch (err) {
        const msg = err instanceof Error
          ? (err.name === 'AbortError' ? 'Image generation timed out' : err.message)
          : String(err);
        setState(adId, { error: msg, loading: false });
        return null;
      } finally {
        clearTimeout(timeout);
        inflight.delete(adId);
      }
    },
    [adId],
  );

  const confirmImage = useCallback(
    async (runId: string, variantIndex: number): Promise<boolean> => {
      try {
        const res = await fetch(`${API_BASE}/ads/${adId}/confirm-image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId, variantIndex }),
        });
        if (!res.ok) return false;
        const prev = getState(adId);
        if (prev.imageResult) {
          setState(adId, { imageResult: { ...prev.imageResult, confirmedVariant: variantIndex } });
        }
        return true;
      } catch {
        return false;
      }
    },
    [adId],
  );

  const loadExistingImage = useCallback(
    async (runId: string): Promise<AdImageResult | null> => {
      try {
        const res = await fetch(`${API_BASE}/ads/${adId}/image-result?runId=${runId}`);
        if (!res.ok) return null;
        const result: AdImageResult = await res.json();
        setState(adId, { imageResult: result });
        return result;
      } catch {
        return null;
      }
    },
    [adId],
  );

  const reset = useCallback(() => {
    // Abort in-flight request if any
    const controller = inflight.get(adId);
    if (controller) {
      controller.abort();
      inflight.delete(adId);
    }
    setState(adId, { imageResult: null, error: null, loading: false });
  }, [adId]);

  return {
    imageResult: state.imageResult,
    loading: state.loading,
    error: state.error,
    generateImages,
    confirmImage,
    loadExistingImage,
    reset,
  };
}
