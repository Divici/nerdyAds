import { useState, useEffect } from 'react';
import type { PipelineResult, AdWithHistory } from '../types.ts';
import { useApi } from '../hooks/useApi.ts';
import { ScoreBadge } from './ScoreBadge.tsx';
import { AdCard } from './AdCard.tsx';
import { Modal } from './Modal.tsx';
import { EvaluationBreakdown } from './EvaluationBreakdown.tsx';

interface RunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  totalAdsGenerated: number;
  totalAdsAccepted: number;
  totalAdsRejected: number;
  acceptanceRate: number;
  averageScore: number;
  totalCostUsd: number;
}

export function PreviousRunsTab() {
  const { fetchRuns, fetchRun } = useApi();
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRun, setSelectedRun] = useState<PipelineResult | null>(null);
  const [selectedAd, setSelectedAd] = useState<AdWithHistory | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [loadingRun, setLoadingRun] = useState(false);

  useEffect(() => {
    fetchRuns().then((r) => {
      setRuns(r);
      setLoadingRuns(false);
    }).catch(() => setLoadingRuns(false));
  }, [fetchRuns]);

  const handleSelectRun = async (runId: string) => {
    setLoadingRun(true);
    try {
      const result = await fetchRun(runId);
      setSelectedRun(result);
    } finally {
      setLoadingRun(false);
    }
  };

  if (loadingRuns) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-12 text-center">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-vt-primary rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Loading previous runs...</p>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 flex flex-col items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium mb-1">No previous runs yet</p>
        <p className="text-gray-400 text-sm">Generate ads from the Campaign tab to see results here.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="grid grid-cols-1 gap-3">
        {runs.map((run) => (
          <button
            key={run.runId}
            onClick={() => handleSelectRun(run.runId)}
            className={`w-full text-left bg-white rounded-xl border p-4 hover:border-vt-accent/50 transition-colors ${
              selectedRun?.runId === run.runId
                ? 'border-vt-accent ring-1 ring-vt-accent/20'
                : 'border-gray-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-sm font-medium text-vt-text">
                    {new Date(run.startedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">{run.runId.slice(0, 8)}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-center">
                  <p className="text-xs text-gray-400">Ads</p>
                  <p className="font-medium text-vt-text">{run.totalAdsGenerated}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Accepted</p>
                  <p className="font-medium text-score-good">{run.totalAdsAccepted}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Rate</p>
                  <p className="font-medium text-vt-text">
                    {(run.acceptanceRate * 100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Avg Score</p>
                  <ScoreBadge score={run.averageScore} size="sm" />
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-400">Cost</p>
                  <p className="font-medium text-vt-text">${run.totalCostUsd.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Expanded run view */}
      {loadingRun && (
        <div className="mt-8 text-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-vt-primary rounded-full animate-spin mx-auto" />
        </div>
      )}

      {selectedRun && !loadingRun && (
        <div className="mt-8">
          <h3 className="text-lg font-heading font-semibold text-vt-text mb-4">
            Run: {selectedRun.runId.slice(0, 8)}
          </h3>

          {selectedRun.briefs?.map((briefResult) => (
            <div key={briefResult.briefId} className="mb-6">
              <h4 className="text-sm font-medium text-vt-dark mb-3">
                {briefResult.briefId}
                <span className="ml-2 text-xs text-gray-400">
                  {briefResult.ads?.length ?? 0} accepted, {briefResult.rejected?.length ?? 0}{' '}
                  rejected
                </span>
              </h4>

              {/* Accepted */}
              {(briefResult.ads?.length ?? 0) > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-3 mb-3">
                  {briefResult.ads?.map((adh, i) => (
                    <AdCard
                      key={adh.ad.id}
                      adWithHistory={adh}
                      onClick={() => setSelectedAd(adh)}
                      index={i}
                      variant="compact"
                      runId={selectedRun.runId}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ad detail modal */}
      <Modal
        open={selectedAd !== null}
        onClose={() => setSelectedAd(null)}
        title="Ad Details"
      >
        {selectedAd && <EvaluationBreakdown adWithHistory={selectedAd} runId={selectedRun?.runId} />}
      </Modal>
    </div>
  );
}
