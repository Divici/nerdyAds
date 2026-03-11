import { useState } from 'react';
import type { AdWithHistory, Ad } from '../types.ts';
import { DimensionBar } from './DimensionBar.tsx';
import { ScoreBadge } from './ScoreBadge.tsx';

interface EvaluationBreakdownProps {
  adWithHistory: AdWithHistory;
}

function MiniAdPreview({ ad }: { ad: Ad }) {
  return (
    <div className="bg-white rounded-md p-3 border border-gray-200 mt-2 space-y-1.5">
      <p className="text-xs text-vt-dark leading-snug">{ad.primaryText}</p>
      <div className="flex items-center justify-between">
        <div className="min-w-0 mr-2">
          <p className="text-xs font-bold text-vt-text truncate">{ad.headline}</p>
          <p className="text-[10px] text-gray-400 truncate">{ad.description}</p>
        </div>
        <span className="bg-vt-primary/10 text-vt-primary text-[10px] font-button px-2 py-0.5 rounded whitespace-nowrap">
          {ad.ctaButton}
        </span>
      </div>
    </div>
  );
}

export function EvaluationBreakdown({ adWithHistory }: EvaluationBreakdownProps) {
  const { ad, evaluations, accepted, cyclesUsed, adVersions } = adWithHistory;
  const lastEval = evaluations[evaluations.length - 1];
  const [expandedCycle, setExpandedCycle] = useState<number | null>(null);

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
            {evaluations.map((evalItem, i) => {
              const isExpanded = expandedCycle === i;
              const versionAd = adVersions?.[i];
              const hasVersion = !!versionAd;

              return (
                <div key={i}>
                  <button
                    type="button"
                    onClick={() => hasVersion && setExpandedCycle(isExpanded ? null : i)}
                    className={`w-full flex items-center justify-between text-xs rounded-md px-3 py-2 transition-colors ${
                      isExpanded ? 'bg-vt-light-blue/50 ring-1 ring-vt-accent/20' : 'bg-gray-50 hover:bg-gray-100'
                    } ${hasVersion ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="text-gray-500 flex items-center gap-1.5">
                      {i === 0 ? 'Initial' : `Cycle ${i}`}
                      {hasVersion && (
                        <svg className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                    <div className="flex gap-3">
                      {evalItem.scores.map((s) => (
                        <span key={s.dimension} className="text-gray-600">
                          {s.dimension.slice(0, 3)}: {s.score.toFixed(1)}
                        </span>
                      ))}
                    </div>
                    <ScoreBadge score={evalItem.weightedScore} size="sm" />
                  </button>
                  {isExpanded && versionAd && (
                    <MiniAdPreview ad={versionAd} />
                  )}
                </div>
              );
            })}
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
