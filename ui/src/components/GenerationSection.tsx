import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Brief, AdWithHistory } from '../types.ts';
import { AdCard, AdCardSkeleton } from './AdCard.tsx';

interface GenerationSectionProps {
  briefs: Brief[];
  onGenerate: (briefId?: string) => void;
  generating: boolean;
  currentRound: number;
  /** Ads currently being generated/evaluated in this round */
  pendingAds: AdWithHistory[];
  skeletonCount: number;
}

export function GenerationSection({
  briefs,
  onGenerate,
  generating,
  currentRound,
  pendingAds,
  skeletonCount,
}: GenerationSectionProps) {
  const [selectedBrief, setSelectedBrief] = useState<string>('');

  const handleGenerate = () => {
    onGenerate(selectedBrief || undefined);
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-heading font-semibold text-vt-text">Generate Ads</h2>
          <p className="text-sm text-gray-400">
            {generating
              ? `Round ${currentRound} — generating and evaluating...`
              : 'Select a brief and generate ad copy'}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={selectedBrief}
            onChange={(e) => setSelectedBrief(e.target.value)}
            disabled={generating}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-gray-200 text-sm text-vt-dark bg-white focus:border-vt-accent focus:ring-1 focus:ring-vt-accent/20 outline-none disabled:opacity-50"
          >
            <option value="">All Briefs (10)</option>
            {briefs.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} — {b.targetAudience} / {b.campaignGoal} / {b.emotionalAngle}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-vt-primary text-white font-button font-medium text-sm px-6 py-2 rounded-lg hover:bg-vt-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              'Generate'
            )}
          </button>
        </div>
      </div>

      {/* Card dealing area */}
      {(generating || pendingAds.length > 0) && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          <AnimatePresence mode="popLayout">
            {pendingAds.map((adh, i) => (
              <AdCard key={adh.ad.id} adWithHistory={adh} index={i} />
            ))}
          </AnimatePresence>
          {generating &&
            Array.from({ length: skeletonCount }).map((_, i) => (
              <AdCardSkeleton key={`skeleton-${i}`} index={pendingAds.length + i} />
            ))}
        </div>
      )}
    </section>
  );
}
