import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Brief, AdWithHistory, AdStatus } from '../types.ts';
import { AdCard, AdCardSkeleton } from './AdCard.tsx';

const AUDIENCE_LABELS: Record<string, string> = {
  student: 'Students',
  parent: 'Parents',
  both: 'Students & Parents',
};

const GOAL_LABELS: Record<string, string> = {
  conversion: 'Drive Signups',
  awareness: 'Build Awareness',
  engagement: 'Boost Engagement',
};

const ANGLE_LABELS: Record<string, string> = {
  aspiration: 'Aspirational',
  anxiety: 'Anxiety Relief',
  urgency: 'Urgency',
  social_proof: 'Social Proof',
  relief: 'Relief',
  fomo: 'FOMO',
  curiosity: 'Curiosity',
};

function BriefPreview({ brief }: { brief: Brief }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
      <div>
        <span className="text-gray-400">Audience</span>
        <p className="text-vt-dark font-medium">{AUDIENCE_LABELS[brief.targetAudience] ?? brief.targetAudience}</p>
      </div>
      <div>
        <span className="text-gray-400">Goal</span>
        <p className="text-vt-dark font-medium">{GOAL_LABELS[brief.campaignGoal] ?? brief.campaignGoal}</p>
      </div>
      <div>
        <span className="text-gray-400">Angle</span>
        <p className="text-vt-dark font-medium">{ANGLE_LABELS[brief.emotionalAngle] ?? brief.emotionalAngle}</p>
      </div>
      <div>
        <span className="text-gray-400">Offer</span>
        <p className="text-vt-dark font-medium truncate">{brief.offer}</p>
      </div>
    </div>
  );
}

interface GenerationSectionProps {
  briefs: Brief[];
  onGenerate: (briefId?: string) => void;
  generating: boolean;
  currentRound: number;
  /** Ads currently being generated/evaluated in this round */
  pendingAds: AdWithHistory[];
  /** Status per ad ID for in-progress cards */
  pendingStatus: Map<string, AdStatus>;
  skeletonCount: number;
}

export function GenerationSection({
  briefs,
  onGenerate,
  generating,
  currentRound,
  pendingAds,
  pendingStatus,
  skeletonCount,
}: GenerationSectionProps) {
  const [selectedBrief, setSelectedBrief] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleGenerate = () => {
    onGenerate(selectedBrief || undefined);
  };

  const selectedBriefData = briefs.find((b) => b.id === selectedBrief);

  const briefButtonLabel = selectedBrief
    ? `${selectedBriefData?.id} — ${AUDIENCE_LABELS[selectedBriefData?.targetAudience ?? ''] ?? selectedBriefData?.targetAudience} / ${ANGLE_LABELS[selectedBriefData?.emotionalAngle ?? ''] ?? selectedBriefData?.emotionalAngle}`
    : `All Briefs (${briefs.length})`;

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
          {/* Custom brief dropdown */}
          <div className="relative flex-1 min-w-[200px]" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => !generating && setDropdownOpen((o) => !o)}
              disabled={generating}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-vt-dark bg-white text-left flex items-center justify-between focus:border-vt-accent focus:ring-1 focus:ring-vt-accent/20 outline-none disabled:opacity-50 transition-colors"
            >
              <span className="truncate">{briefButtonLabel}</span>
              <svg className={`w-4 h-4 ml-2 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-gray-200 shadow-lg max-h-80 overflow-y-auto">
                {/* All briefs option */}
                <button
                  type="button"
                  onClick={() => { setSelectedBrief(''); setDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-vt-light-blue/50 transition-colors border-b border-gray-100 ${selectedBrief === '' ? 'bg-vt-light-blue/30 font-medium' : ''}`}
                >
                  <span className="font-medium text-vt-dark">All Briefs ({briefs.length})</span>
                  <p className="text-xs text-gray-400 mt-0.5">Run the full pipeline across every brief</p>
                </button>

                {briefs.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => { setSelectedBrief(b.id); setDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-3 hover:bg-vt-light-blue/50 transition-colors border-b border-gray-100 last:border-b-0 ${selectedBrief === b.id ? 'bg-vt-light-blue/30' : ''}`}
                  >
                    <span className="text-sm font-medium text-vt-dark">{b.id}</span>
                    <div className="mt-1.5">
                      <BriefPreview brief={b} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

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

        {/* Selected brief preview */}
        {selectedBriefData && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <BriefPreview brief={selectedBriefData} />
          </div>
        )}
      </div>

      {/* Card dealing area */}
      {(generating || pendingAds.length > 0) && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          <AnimatePresence mode="popLayout">
            {pendingAds.map((adh, i) => (
              <AdCard key={adh.ad.id} adWithHistory={adh} index={i} status={pendingStatus.get(adh.ad.id)} />
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
