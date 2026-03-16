import { useEffect } from 'react';
import { useImageGeneration } from '../hooks/useImageGeneration.ts';
import type { Ad } from '../types.ts';

interface ImageGeneratorProps {
  ad: Ad;
  runId: string;
  accepted: boolean;
}

export function ImageGenerator({ ad, runId, accepted }: ImageGeneratorProps) {
  const { imageResult, loading, error, generateImages, confirmImage, loadExistingImage, reset } =
    useImageGeneration(ad.id);
  const adBody = ad as unknown as Record<string, unknown>;

  // Load existing image result on mount
  useEffect(() => {
    loadExistingImage(runId);
  }, [runId, loadExistingImage]);

  if (!accepted) {
    return (
      <div className="bg-vt-light-blue aspect-square flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-1 opacity-40">&#x1F393;</div>
          <p className="text-xs text-vt-accent opacity-60 font-button">IMAGE — v2</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="bg-vt-light-blue aspect-square flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-10 h-10 mx-auto mb-2">
            <div className="absolute inset-0 rounded-full border-2 border-vt-accent/20" />
            <div className="absolute inset-0 rounded-full border-2 border-vt-accent border-t-transparent animate-spin" />
          </div>
          <p className="text-xs text-vt-accent font-button">Generating image...</p>
          <p className="text-[10px] text-gray-400 mt-1">This may take 15-20s</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 aspect-square flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-xs text-red-600 mb-2">{error}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              reset();
              generateImages(runId, ad.briefId, adBody);
            }}
            className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full hover:bg-red-200 transition-colors font-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // No images yet — show generate button
  if (!imageResult) {
    return (
      <div className="bg-vt-light-blue aspect-square flex items-center justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            generateImages(runId, ad.briefId, adBody);
          }}
          className="bg-vt-primary text-white text-sm font-button font-medium px-5 py-2 rounded-full hover:bg-vt-primary-hover transition-colors shadow-sm"
        >
          Generate Image
        </button>
      </div>
    );
  }

  const isConfirmed = imageResult.confirmedVariant !== undefined;

  // Show confirmed image (no badge)
  if (isConfirmed) {
    const confirmedVar = imageResult.variants[imageResult.confirmedVariant!];
    const imgSrc = `/api/output${confirmedVar.imagePath}`;
    return (
      <div className="relative">
        <img src={imgSrc} alt={confirmedVar.blurb} className="w-full aspect-square object-cover" />
      </div>
    );
  }

  // Show image with action buttons (no blurb, no badge)
  const variant = imageResult.variants[0];
  const imgSrc = `/api/output${variant.imagePath}`;

  return (
    <div className="bg-gray-50 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <div className="rounded-lg overflow-hidden border-2 border-vt-accent ring-2 ring-vt-accent/20">
        <img src={imgSrc} alt={variant.blurb} className="w-full aspect-square object-cover" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={() => confirmImage(runId, 0)}
          className="bg-green-600 text-white text-xs font-button px-3 py-1.5 rounded-full hover:bg-green-700 transition-colors"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            generateImages(runId, ad.briefId, adBody);
          }}
          className="bg-gray-200 text-gray-700 text-xs font-button px-3 py-1.5 rounded-full hover:bg-gray-300 transition-colors"
        >
          Regenerate
        </button>
        <button
          type="button"
          onClick={() => reset()}
          className="text-gray-400 text-xs font-button px-3 py-1.5 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
