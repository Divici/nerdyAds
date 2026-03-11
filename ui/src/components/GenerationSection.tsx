import { useState, useRef, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Brief, AdWithHistory, AdStatus, GenerationMode } from '../types.ts';
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
  mode: GenerationMode;
  onModeChange: (mode: GenerationMode) => void;
}

export function GenerationSection({
  briefs,
  onGenerate,
  generating,
  currentRound,
  pendingAds,
  pendingStatus,
  skeletonCount,
  mode,
  onModeChange,
}: GenerationSectionProps) {
  const [selectedBrief, setSelectedBrief] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [modeTooltipOpen, setModeTooltipOpen] = useState(false);

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
    ? `${AUDIENCE_LABELS[selectedBriefData?.targetAudience ?? ''] ?? selectedBriefData?.targetAudience} / ${ANGLE_LABELS[selectedBriefData?.emotionalAngle ?? ''] ?? selectedBriefData?.emotionalAngle}`
    : `All Briefs (${briefs.length})`;

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-5">
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
      <div className="bg-white rounded-2xl border border-gray-100/60 shadow-sm p-5 mb-4">
        <div className="flex items-center gap-3">
          {/* Custom brief dropdown */}
          <div className="relative flex-1 min-w-[200px]" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => !generating && setDropdownOpen((o) => !o)}
              disabled={generating}
              className="w-full px-4 py-2.5 rounded-full border border-gray-200 text-sm text-vt-dark bg-white text-left flex items-center justify-between focus:border-vt-accent focus:ring-1 focus:ring-vt-accent/20 outline-none disabled:opacity-50 transition-colors"
            >
              <span className="truncate">{briefButtonLabel}</span>
              <svg className={`w-4 h-4 ml-2 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white rounded-2xl border border-gray-100/60 shadow-lg max-h-80 overflow-y-auto">
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
                    <span className="text-sm font-medium text-vt-dark">
                      {AUDIENCE_LABELS[b.targetAudience] ?? b.targetAudience} / {ANGLE_LABELS[b.emotionalAngle] ?? b.emotionalAngle}
                    </span>
                    <span className="text-xs text-gray-400 ml-2">{GOAL_LABELS[b.campaignGoal] ?? b.campaignGoal}</span>
                    <div className="mt-1.5">
                      <BriefPreview brief={b} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-vt-primary text-white font-button font-medium text-sm px-7 py-2.5 rounded-full hover:bg-vt-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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

          {/* Mode toggle */}
          <div className="relative flex items-center">
            <div className="flex rounded-full border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => !generating && onModeChange('quick')}
                disabled={generating}
                className={`text-xs font-button font-medium px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  mode === 'quick'
                    ? 'bg-vt-text text-white'
                    : 'text-gray-400 hover:text-vt-text'
                }`}
              >
                Quick
              </button>
              <button
                type="button"
                onClick={() => !generating && onModeChange('quality')}
                disabled={generating}
                className={`text-xs font-button font-medium px-3 py-1.5 transition-colors disabled:opacity-50 ${
                  mode === 'quality'
                    ? 'bg-vt-text text-white'
                    : 'text-gray-400 hover:text-vt-text'
                }`}
              >
                Quality
              </button>
            </div>
            <button
              type="button"
              onMouseEnter={() => setModeTooltipOpen(true)}
              onMouseLeave={() => setModeTooltipOpen(false)}
              className="ml-1.5 text-gray-300 hover:text-gray-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {modeTooltipOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded-lg p-3 shadow-lg z-40">
                <p className="font-medium mb-1.5">Generation Modes</p>
                <p className="mb-1"><span className="font-medium text-blue-300">Quick:</span> Flash evaluator, 7.5 threshold. Fast iteration for testing.</p>
                <p><span className="font-medium text-amber-300">Quality:</span> Pro evaluator, 8.0 threshold. Slower but stricter scoring for final runs.</p>
                <div className="absolute right-3 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
              </div>
            )}
          </div>
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
