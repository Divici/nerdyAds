import { useState, useEffect, useCallback } from 'react';
import type { Brief, AdWithHistory, PipelineResult, Ad, AdStatus, GenerationMode } from './types.ts';
import { useApi } from './hooks/useApi.ts';
import { useSSE } from './hooks/useSSE.ts';
import { Header } from './components/Header.tsx';
import { AcceptedCarousel } from './components/AcceptedCarousel.tsx';
import { GenerationSection } from './components/GenerationSection.tsx';
import { DiscardedSection } from './components/DiscardedSection.tsx';
import { InsightsTab } from './components/InsightsTab.tsx';
import { PreviousRunsTab } from './components/PreviousRunsTab.tsx';
import { Modal } from './components/Modal.tsx';
import { EvaluationBreakdown } from './components/EvaluationBreakdown.tsx';
import { AdCard } from './components/AdCard.tsx';
import './App.css';

type Tab = 'campaign' | 'insights' | 'runs';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('campaign');
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [accepted, setAccepted] = useState<AdWithHistory[]>([]);
  const [rejected, setRejected] = useState<AdWithHistory[]>([]);
  const [pending, setPending] = useState<AdWithHistory[]>([]);
  const [pendingStatus, setPendingStatus] = useState<Map<string, AdStatus>>(new Map<string, AdStatus>());
  const [generating, setGenerating] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [skeletonCount, setSkeletonCount] = useState(0);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [pipelineResult, setPipelineResult] = useState<PipelineResult | null>(null);
  const [selectedAd, setSelectedAd] = useState<AdWithHistory | null>(null);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [discardedModalOpen, setDiscardedModalOpen] = useState(false);
  const [discardedDetailAd, setDiscardedDetailAd] = useState<AdWithHistory | null>(null);
  const [mode, setMode] = useState<GenerationMode>('quick');

  const { fetchBriefs, startGeneration } = useApi();

  // Load briefs on mount
  useEffect(() => {
    fetchBriefs().then(setBriefs).catch(console.error);
  }, [fetchBriefs]);

  // SSE handlers
  const handleRoundStart = useCallback((data: unknown) => {
    const d = data as { round: number };
    setCurrentRound(d.round);
    setSkeletonCount(3);
    setPending([]);
  }, []);

  const handleAdGenerating = useCallback((data: unknown) => {
    const d = data as { ad: Ad };
    setSkeletonCount((c) => Math.max(0, c - 1));
    setPendingStatus((prev) => new Map(prev).set(d.ad.id, { status: 'generating' }));
    setPending((prev) => {
      if (prev.some((a) => a.ad.id === d.ad.id)) return prev;
      return [
        ...prev,
        { ad: d.ad, evaluations: [], accepted: false, cyclesUsed: 0 },
      ];
    });
  }, []);

  const handleAdAccepted = useCallback((data: unknown) => {
    const d = data as { adWithHistory: AdWithHistory };
    setSkeletonCount((c) => Math.max(0, c - 1));
    setPending((p) => p.filter((a) => a.ad.id !== d.adWithHistory.ad.id));
    setPendingStatus((prev) => { const next = new Map(prev); next.delete(d.adWithHistory.ad.id); return next; });
    setAccepted((prev) => [...prev, d.adWithHistory]);
  }, []);

  const handleAdRejected = useCallback((data: unknown) => {
    const d = data as { adWithHistory: AdWithHistory };
    setSkeletonCount((c) => Math.max(0, c - 1));
    setPending((p) => p.filter((a) => a.ad.id !== d.adWithHistory.ad.id));
    setPendingStatus((prev) => { const next = new Map(prev); next.delete(d.adWithHistory.ad.id); return next; });
    setRejected((prev) => [...prev, d.adWithHistory]);
  }, []);

  const handleAdEvaluating = useCallback((data: unknown) => {
    const d = data as { ad: Ad; cycle?: number };
    setSkeletonCount((c) => Math.max(0, c - 1));
    setPendingStatus((prev) => new Map(prev).set(d.ad.id, { status: 'evaluating', cycle: d.cycle }));
    setPending((prev) => {
      if (prev.some((a) => a.ad.id === d.ad.id)) return prev;
      return [
        ...prev,
        { ad: d.ad, evaluations: [], accepted: false, cyclesUsed: 0 },
      ];
    });
  }, []);

  const handleAdImproving = useCallback((data: unknown) => {
    const d = data as { ad: Ad; cycle?: number };
    setPendingStatus((prev) => new Map(prev).set(d.ad.id, { status: 'improving', cycle: d.cycle }));
  }, []);

  const handlePipelineComplete = useCallback((data: unknown) => {
    const d = data as { result: PipelineResult };
    setPipelineResult(d.result);
    setGenerating(false);
    setSkeletonCount(0);
    setPending([]);
    setPendingStatus(new Map());
    setActiveRunId(null);
  }, []);

  const handlePipelineError = useCallback((data: unknown) => {
    const d = data as { error: string };
    console.error('Pipeline error:', d.error);
    setGenerating(false);
    setSkeletonCount(0);
    setPending([]);
    setPendingStatus(new Map());
    setActiveRunId(null);
  }, []);

  useSSE(activeRunId, {
    'round:start': handleRoundStart,
    'ad:generating': handleAdGenerating,
    'ad:evaluating': handleAdEvaluating,
    'ad:improving': handleAdImproving,
    'ad:accepted': handleAdAccepted,
    'ad:rejected': handleAdRejected,
    'pipeline:complete': handlePipelineComplete,
    'pipeline:error': handlePipelineError,
  });

  const handleGenerate = useCallback(
    async (briefId?: string) => {
      setGenerating(true);
      setCurrentRound(0);
      setPending([]);
      setSkeletonCount(3);
      try {
        const { runId } = await startGeneration(briefId, mode);
        setActiveRunId(runId);
      } catch (err) {
        console.error('Failed to start generation:', err);
        setGenerating(false);
        setSkeletonCount(0);
      }
    },
    [startGeneration, mode],
  );

  return (
    <div className="min-h-screen">
      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main>
        {activeTab === 'campaign' && (
          <div className="max-w-7xl mx-auto px-6 py-10">
            <AcceptedCarousel
              ads={accepted}
              onAdClick={setSelectedAd}
              onViewAll={() => setViewAllOpen(true)}
            />

            <GenerationSection
              briefs={briefs}
              onGenerate={handleGenerate}
              generating={generating}
              currentRound={currentRound}
              pendingAds={pending}
              pendingStatus={pendingStatus}
              skeletonCount={skeletonCount}
              mode={mode}
              onModeChange={setMode}
            />

            <DiscardedSection ads={rejected} onViewDiscarded={() => setDiscardedModalOpen(true)} />
          </div>
        )}

        {activeTab === 'insights' && (
          <InsightsTab
            accepted={accepted}
            rejected={rejected}
            pipelineResult={pipelineResult}
          />
        )}

        {activeTab === 'runs' && <PreviousRunsTab />}
      </main>

      {/* Ad detail modal */}
      <Modal open={selectedAd !== null} onClose={() => setSelectedAd(null)} title="Ad Insights">
        {selectedAd && <EvaluationBreakdown adWithHistory={selectedAd} />}
      </Modal>

      {/* View All accepted modal */}
      <Modal
        open={viewAllOpen}
        onClose={() => setViewAllOpen(false)}
        title={`All Accepted Ads (${accepted.length})`}
        wide
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accepted.map((adh, i) => (
            <AdCard
              key={adh.ad.id}
              adWithHistory={adh}
              onClick={() => {
                setViewAllOpen(false);
                setSelectedAd(adh);
              }}
              index={i}
            />
          ))}
        </div>
      </Modal>

      {/* Discarded modal */}
      <Modal
        open={discardedModalOpen}
        onClose={() => {
          setDiscardedModalOpen(false);
          setDiscardedDetailAd(null);
        }}
        title={`Discarded Ads (${rejected.length})`}
        wide
      >
        {discardedDetailAd ? (
          <div>
            <button
              onClick={() => setDiscardedDetailAd(null)}
              className="text-sm text-vt-accent hover:text-vt-primary mb-4 flex items-center gap-1"
            >
              &#8249; Back to all discarded
            </button>
            <EvaluationBreakdown adWithHistory={discardedDetailAd} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {rejected.map((adh, i) => (
              <AdCard
                key={adh.ad.id}
                adWithHistory={adh}
                onClick={() => setDiscardedDetailAd(adh)}
                index={i}
              />
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default App;
