import type { AdWithHistory } from '../types.ts';
import { DimensionBar } from './DimensionBar.tsx';
import { ScoreBadge } from './ScoreBadge.tsx';

interface EvaluationBreakdownProps {
  adWithHistory: AdWithHistory;
}

export function EvaluationBreakdown({ adWithHistory }: EvaluationBreakdownProps) {
  const { ad, evaluations, accepted, cyclesUsed } = adWithHistory;
  const lastEval = evaluations[evaluations.length - 1];

  return (
    <div className="space-y-6">
      {/* Ad Preview */}
      <div className="bg-vt-light rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-vt-navy flex items-center justify-center">
            <span className="text-white text-xs font-bold font-heading">VT</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-vt-text">Varsity Tutors</p>
            <p className="text-xs text-gray-400">Sponsored</p>
          </div>
        </div>
        <p className="text-sm text-vt-dark mb-3">{ad.primaryText}</p>
        <div className="bg-vt-light-blue h-24 rounded-lg flex items-center justify-center mb-3">
          <span className="text-xs text-vt-accent/50 font-button">IMAGE — v2</span>
        </div>
        <p className="font-bold text-sm text-vt-text">{ad.headline}</p>
        <p className="text-xs text-gray-500">{ad.description}</p>
        <div className="mt-2">
          <span className="bg-vt-primary text-white text-xs font-button px-3 py-1 rounded">
            {ad.ctaButton}
          </span>
        </div>
      </div>

      {/* Score Summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">Weighted Score</p>
          <div className="flex items-center gap-2">
            <ScoreBadge score={lastEval.weightedScore} size="lg" />
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                accepted
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {accepted ? 'Accepted' : 'Rejected'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Confidence</p>
          <p className="text-sm font-medium capitalize text-vt-dark">{lastEval.overallConfidence}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Cycles</p>
          <p className="text-sm font-medium text-vt-dark">{cyclesUsed}</p>
        </div>
      </div>

      {/* Dimension Scores */}
      <div>
        <h3 className="text-sm font-heading font-semibold text-vt-text mb-3">Dimension Scores</h3>
        {lastEval.scores.map((dim) => (
          <DimensionBar key={dim.dimension} dimension={dim} showRationale />
        ))}
      </div>

      {/* Evaluation History */}
      {evaluations.length > 1 && (
        <div>
          <h3 className="text-sm font-heading font-semibold text-vt-text mb-3">
            Iteration History
          </h3>
          <div className="space-y-2">
            {evaluations.map((evalItem, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-xs bg-gray-50 rounded-md px-3 py-2"
              >
                <span className="text-gray-500">
                  {i === 0 ? 'Initial' : `Cycle ${i}`}
                </span>
                <div className="flex gap-3">
                  {evalItem.scores.map((s) => (
                    <span key={s.dimension} className="text-gray-600">
                      {s.dimension.slice(0, 3)}: {s.score.toFixed(1)}
                    </span>
                  ))}
                </div>
                <ScoreBadge score={evalItem.weightedScore} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="text-xs text-gray-400 border-t border-gray-100 pt-3 grid grid-cols-2 gap-2">
        <span>Ad ID: {ad.id.slice(0, 8)}...</span>
        <span>Brief: {ad.briefId}</span>
        <span>Model: {ad.metadata.model}</span>
        <span>Cost: ${ad.metadata.costUsd.toFixed(4)}</span>
        <span>Version: v{ad.version}</span>
        <span>Tokens: {ad.metadata.tokensIn + ad.metadata.tokensOut}</span>
      </div>
    </div>
  );
}
