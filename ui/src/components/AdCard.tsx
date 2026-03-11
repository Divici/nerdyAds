import { motion } from 'framer-motion';
import type { AdWithHistory } from '../types.ts';
import { ScoreBadge } from './ScoreBadge.tsx';

interface AdCardProps {
  adWithHistory: AdWithHistory;
  onClick?: () => void;
  index?: number;
  variant?: 'default' | 'compact';
}

export function AdCard({ adWithHistory, onClick, index = 0, variant = 'default' }: AdCardProps) {
  const { ad, evaluations, accepted } = adWithHistory;
  const lastEval = evaluations[evaluations.length - 1];
  const score = lastEval?.weightedScore ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateY: -10 }}
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4, ease: 'easeOut' }}
      onClick={onClick}
      className={`
        bg-white rounded-lg shadow-md overflow-hidden cursor-pointer
        hover:shadow-lg transition-shadow duration-200
        ${variant === 'compact' ? 'w-[280px]' : 'w-[320px]'}
        flex-shrink-0 border border-gray-100
      `}
    >
      {/* Brand Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-vt-navy flex items-center justify-center">
            <span className="text-white text-xs font-bold font-heading">VT</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-vt-text leading-tight">Varsity Tutors</p>
            <p className="text-xs text-gray-400">Sponsored</p>
          </div>
        </div>
        <ScoreBadge score={score} size="sm" />
      </div>

      {/* Primary Text */}
      <div className="px-4 pb-3">
        <p className="text-sm text-vt-dark leading-snug line-clamp-4">{ad.primaryText}</p>
      </div>

      {/* Image Placeholder */}
      <div className="bg-vt-light-blue mx-0 h-40 flex items-center justify-center border-y border-gray-100">
        <div className="text-center">
          <div className="text-3xl mb-1 opacity-40">&#x1F393;</div>
          <p className="text-xs text-vt-accent opacity-60 font-button">IMAGE — v2</p>
        </div>
      </div>

      {/* Headline + Description + CTA */}
      <div className="px-4 py-3 bg-vt-light border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 mr-3">
            <p className="text-sm font-bold text-vt-text truncate">{ad.headline}</p>
            <p className="text-xs text-gray-500 truncate">{ad.description}</p>
          </div>
          <button className="bg-vt-primary text-white text-xs font-button font-medium px-3 py-1.5 rounded whitespace-nowrap hover:bg-vt-primary-hover transition-colors">
            {ad.ctaButton}
          </button>
        </div>
      </div>

      {/* Status indicator */}
      <div
        className={`h-1 ${accepted ? 'bg-score-good' : 'bg-score-bad'}`}
      />
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
      className="bg-white rounded-lg shadow-md overflow-hidden w-[320px] flex-shrink-0 border border-gray-100"
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
      <div className="bg-gray-100 h-40 animate-pulse" />
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
      className="w-[120px] h-[170px] rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow flex-shrink-0"
    >
      <div
        className="w-full h-full rounded-lg flex items-center justify-center"
        style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
      >
        <div className="w-full h-full rounded-lg bg-gradient-to-br from-vt-navy to-vt-dark flex items-center justify-center border-2 border-vt-lavender/30">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto rounded-full bg-vt-lavender/20 flex items-center justify-center mb-1">
              <span className="text-vt-lavender text-lg font-bold font-heading">VT</span>
            </div>
            <div className="w-8 h-0.5 mx-auto bg-vt-lavender/20 rounded mt-1" />
            <div className="w-6 h-0.5 mx-auto bg-vt-lavender/20 rounded mt-1" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
