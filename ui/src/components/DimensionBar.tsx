import type { DimensionScore } from '../types.ts';

const DIMENSION_LABELS: Record<string, string> = {
  clarity: 'Clarity',
  value_proposition: 'Value Prop',
  emotional_resonance: 'Emotional',
  cta: 'CTA',
  brand_voice: 'Brand Voice',
};

interface DimensionBarProps {
  dimension: DimensionScore;
  showRationale?: boolean;
}

export function DimensionBar({ dimension, showRationale = false }: DimensionBarProps) {
  const pct = (dimension.score / 10) * 100;
  const color =
    dimension.score >= 7.5
      ? 'bg-score-good'
      : dimension.score >= 6
        ? 'bg-score-mid'
        : 'bg-score-bad';

  return (
    <div className="mb-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-vt-text">
          {DIMENSION_LABELS[dimension.dimension] ?? dimension.dimension}
        </span>
        <span className="text-sm font-semibold text-vt-dark">{dimension.score.toFixed(1)}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showRationale && (
        <p className="text-xs text-gray-500 mt-1 italic">{dimension.rationale}</p>
      )}
    </div>
  );
}
