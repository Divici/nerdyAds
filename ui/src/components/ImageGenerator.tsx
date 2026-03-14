import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useImageGeneration } from '../hooks/useImageGeneration.ts';
import type { Ad, AdImageResult, VisualDimensionScore } from '../types.ts';

interface ImageGeneratorProps {
  ad: Ad;
  runId: string;
  accepted: boolean;
}

const DIMENSION_LABELS: Record<string, string> = {
  brand_consistency: 'Brand',
  copy_alignment: 'Copy',
  engagement_potential: 'Engage',
};

function VisualScoreBar({ score }: { score: VisualDimensionScore }) {
  const pct = (score.score / 10) * 100;
  const color =
    score.score >= 7 ? 'bg-score-good' : score.score >= 5 ? 'bg-score-ok' : 'bg-score-bad';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-10 text-right">
        {DIMENSION_LABELS[score.dimension] ?? score.dimension}
      </span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-gray-600 w-5 text-right font-medium">{score.score}</span>
    </div>
  );
}

function VariantCard({
  variant,
  selected,
  confirmed,
  onSelect,
}: {
  variant: AdImageResult['variants'][0];
  selected: boolean;
  confirmed: boolean;
  onSelect: () => void;
}) {
  const imgSrc = `/api/output${variant.imagePath}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`
        relative rounded-lg overflow-hidden border-2 transition-all duration-200
        ${confirmed ? 'border-green-500 ring-2 ring-green-200' : ''}
        ${selected && !confirmed ? 'border-vt-accent ring-2 ring-vt-accent/20' : ''}
        ${!selected && !confirmed ? 'border-gray-200 hover:border-gray-300' : ''}
      `}
    >
      <img src={imgSrc} alt={variant.blurb} className="w-full aspect-square object-cover" />

      {/* Selection indicator */}
      {(selected || confirmed) && (
        <div
          className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
            confirmed ? 'bg-green-500' : 'bg-vt-accent'
          }`}
        >
          {confirmed ? '✓' : variant.variantIndex + 1}
        </div>
      )}

      {/* Visual scores */}
      {variant.visualScores && (
        <div className="p-2 space-y-1 bg-white">
          {variant.visualScores.map((s) => (
            <VisualScoreBar key={s.dimension} score={s} />
          ))}
        </div>
      )}

      {/* Blurb */}
      <p className="text-[10px] text-gray-400 px-2 pb-2 line-clamp-2 bg-white">{variant.blurb}</p>
    </button>
  );
}

export function ImageGenerator({ ad, runId, accepted }: ImageGeneratorProps) {
  const { imageResult, loading, error, generateImages, confirmImage, loadExistingImage, reset } =
    useImageGeneration();
  const [selectedVariant, setSelectedVariant] = useState<number>(0);

  // Load existing image result on mount
  useEffect(() => {
    loadExistingImage(ad.id, runId);
  }, [ad.id, runId, loadExistingImage]);

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
          <p className="text-xs text-vt-accent font-button">Generating images...</p>
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
              generateImages(ad.id, runId, ad.briefId, ad as unknown as Record<string, unknown>);
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
            generateImages(ad.id, runId, ad.briefId, ad as unknown as Record<string, unknown>);
          }}
          className="bg-vt-primary text-white text-sm font-button font-medium px-5 py-2 rounded-full hover:bg-vt-primary-hover transition-colors shadow-sm"
        >
          Generate Image
        </button>
      </div>
    );
  }

  const isConfirmed = imageResult.confirmedVariant !== undefined;

  // Show confirmed image only
  if (isConfirmed) {
    const confirmedVar = imageResult.variants[imageResult.confirmedVariant!];
    const imgSrc = `/api/output${confirmedVar.imagePath}`;
    return (
      <div className="relative">
        <img src={imgSrc} alt={confirmedVar.blurb} className="w-full aspect-square object-cover" />
        <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
          Confirmed
        </div>
      </div>
    );
  }

  // Show variant comparison
  return (
    <div className="bg-gray-50 p-3 space-y-3" onClick={(e) => e.stopPropagation()}>
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedVariant}
          initial={{ opacity: 0, x: selectedVariant === 0 ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: selectedVariant === 0 ? 20 : -20 }}
          transition={{ duration: 0.2 }}
        >
          <VariantCard
            variant={imageResult.variants[selectedVariant]}
            selected
            confirmed={false}
            onSelect={() => {}}
          />
        </motion.div>
      </AnimatePresence>

      {/* Variant toggle */}
      <div className="flex items-center justify-center gap-2">
        {imageResult.variants.map((v) => (
          <button
            key={v.variantIndex}
            type="button"
            onClick={() => setSelectedVariant(v.variantIndex)}
            className={`w-2 h-2 rounded-full transition-colors ${
              selectedVariant === v.variantIndex ? 'bg-vt-accent' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 justify-center">
        <button
          type="button"
          onClick={() => confirmImage(ad.id, runId, selectedVariant)}
          className="bg-green-600 text-white text-xs font-button px-3 py-1.5 rounded-full hover:bg-green-700 transition-colors"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            generateImages(ad.id, runId, ad.briefId, ad as unknown as Record<string, unknown>);
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
