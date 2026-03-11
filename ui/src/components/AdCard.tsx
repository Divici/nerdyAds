import { motion } from 'framer-motion';
import type { AdWithHistory, AdStatus, AdStatusType } from '../types.ts';
import { ScoreBadge } from './ScoreBadge.tsx';

function VTLogoSmall() {
  return (
    <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="16" fill="#20205F" />
      <path d="M10 12c0-2.5 2-4.5 4.5-4.5 3.5 0 5.5 2.5 5.5 5.5 0 4-3 7.5-7 11-1.5-1.3-2.8-2.6-3.8-4" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <path d="M22 20c0 2.5-2 4.5-4.5 4.5-3.5 0-5.5-2.5-5.5-5.5 0-4 3-7.5 7-11 1.5 1.3 2.8 2.6 3.8 4" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

interface AdCardProps {
  adWithHistory: AdWithHistory;
  onClick?: () => void;
  index?: number;
  variant?: 'default' | 'compact';
  /** Pipeline status — when set, overrides default score/status display */
  status?: AdStatus;
}

const STATUS_CONFIG: Record<AdStatusType, { label: string; color: string; barClass: string; animate: boolean }> = {
  generating: { label: 'Draft', color: 'bg-gray-400 text-white', barClass: 'bg-gray-300', animate: true },
  evaluating: { label: 'Scoring', color: 'bg-vt-accent text-white', barClass: 'bg-vt-accent', animate: true },
  improving: { label: 'Editing', color: 'bg-amber-500 text-white', barClass: 'bg-amber-400', animate: true },
  accepted: { label: '', color: '', barClass: 'bg-score-good', animate: false },
  rejected: { label: '', color: '', barClass: 'bg-score-bad', animate: false },
};

function StatusBadge({ status }: { status: AdStatus }) {
  const cfg = STATUS_CONFIG[status.status];
  const cycleLabel = status.cycle ? ` (${status.cycle}/3)` : '';
  return (
    <span className={`${cfg.color} text-xs px-2 py-0.5 rounded-md font-button font-semibold inline-flex items-center gap-1.5`}>
      {cfg.animate && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-white" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
      )}
      {cfg.label}{cycleLabel}
    </span>
  );
}

export function AdCard({ adWithHistory, onClick, index = 0, variant = 'default', status }: AdCardProps) {
  const { ad, evaluations, accepted } = adWithHistory;
  const lastEval = evaluations[evaluations.length - 1];
  const score = lastEval?.weightedScore ?? 0;

  // Determine if we're in an in-progress state
  const statusType = status?.status;
  const inProgress = statusType === 'generating' || statusType === 'evaluating' || statusType === 'improving';
  const resolvedBarClass = statusType
    ? STATUS_CONFIG[statusType].barClass
    : accepted ? 'bg-score-good' : 'bg-score-bad';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateY: -10 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4, ease: 'easeOut' }}
      onClick={onClick}
      className={`
        bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer
        hover:shadow-md transition-shadow duration-200
        ${variant === 'compact' ? 'w-[280px]' : 'w-[320px]'}
        flex-shrink-0 border border-gray-100/60
        ${inProgress ? 'ring-1 ring-vt-accent/20' : ''}
      `}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <VTLogoSmall />
          <div>
            <p className="text-sm font-semibold text-vt-text leading-tight">Varsity Tutors</p>
            <p className="text-xs text-gray-400">Sponsored</p>
          </div>
        </div>
        {inProgress ? (
          <StatusBadge status={status!} />
        ) : (
          <ScoreBadge score={score} size="sm" />
        )}
      </div>

      {/* Primary Text */}
      <div className="px-4 pb-3">
        <p className="text-sm text-vt-dark leading-snug line-clamp-4">{ad.primaryText}</p>
      </div>

      {/* Image Placeholder */}
      <div className="bg-vt-light-blue mx-0 aspect-square flex items-center justify-center border-y border-gray-100/60">
        <div className="text-center">
          <div className="text-3xl mb-1 opacity-40">&#x1F393;</div>
          <p className="text-xs text-vt-accent opacity-60 font-button">IMAGE — v2</p>
        </div>
      </div>

      {/* Headline + Description + CTA */}
      <div className="px-4 py-3 bg-vt-light border-t border-gray-100/60">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-sm font-bold text-vt-text truncate">{ad.headline}</p>
            <p className="text-xs text-gray-500 truncate">{ad.description}</p>
          </div>
          <button className="bg-vt-primary text-white text-xs font-button font-medium px-3.5 py-1.5 rounded-full whitespace-nowrap hover:bg-vt-primary-hover transition-colors">
            {ad.ctaButton}
          </button>
        </div>
      </div>

      {/* Status indicator bar */}
      <div className={`h-1 ${resolvedBarClass} ${statusType && STATUS_CONFIG[statusType].animate ? 'animate-pulse' : ''}`} />
    </motion.div>
  );
}

/** Skeleton card shown while ad is being generated */
export function AdCardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -50, rotateY: -30 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      transition={{ delay: index * 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white rounded-2xl shadow-sm overflow-hidden w-[320px] shrink-0 border border-gray-100/60"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        <div className="flex-1">
          <div className="h-3 bg-gray-200 rounded animate-pulse w-24 mb-1" />
          <div className="h-2 bg-gray-100 rounded animate-pulse w-16" />
        </div>
      </div>
      <div className="px-4 pb-3 space-y-2">
        <div className="h-3 bg-gray-200 rounded animate-pulse" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-4/5" />
        <div className="h-3 bg-gray-200 rounded animate-pulse w-3/5" />
      </div>
      <div className="bg-gray-100 aspect-square animate-pulse" />
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 mr-3">
            <div className="h-4 bg-gray-200 rounded animate-pulse w-32 mb-1" />
            <div className="h-3 bg-gray-100 rounded animate-pulse w-48" />
          </div>
          <div className="h-7 w-20 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}

/** Back of card (flipped/discarded) */
export function AdCardBack({ onClick, index = 0 }: { onClick?: () => void; index?: number }) {
  return (
    <motion.div
      initial={{ rotateY: 0 }}
      animate={{ rotateY: 180 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      onClick={onClick}
      style={{ transformStyle: 'preserve-3d' }}
      className="w-[120px] h-[170px] rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow shrink-0"
    >
      <div
        className="w-full h-full rounded-lg flex items-center justify-center"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      >
        <div className="w-full h-full rounded-lg bg-gradient-to-br from-vt-navy to-vt-dark flex items-center justify-center border-2 border-vt-lavender/30">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-1 opacity-30">
              <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 12c0-2.5 2-4.5 4.5-4.5 3.5 0 5.5 2.5 5.5 5.5 0 4-3 7.5-7 11-1.5-1.3-2.8-2.6-3.8-4" stroke="#d4d1ec" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                <path d="M22 20c0 2.5-2 4.5-4.5 4.5-3.5 0-5.5-2.5-5.5-5.5 0-4 3-7.5 7-11 1.5 1.3 2.8 2.6 3.8 4" stroke="#d4d1ec" strokeWidth="2.2" strokeLinecap="round" fill="none" />
              </svg>
            </div>
            <div className="w-8 h-0.5 mx-auto bg-vt-lavender/20 rounded mt-1" />
            <div className="w-6 h-0.5 mx-auto bg-vt-lavender/20 rounded mt-1" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
