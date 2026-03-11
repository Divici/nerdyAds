import type { AdWithHistory } from '../types.ts';
import { AdCardBack } from './AdCard.tsx';

interface DiscardedSectionProps {
  ads: AdWithHistory[];
  onViewDiscarded: () => void;
}

export function DiscardedSection({ ads, onViewDiscarded }: DiscardedSectionProps) {
  if (ads.length === 0) return null;

  // Show max 8 card backs in the row
  const visibleCount = Math.min(ads.length, 8);

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-vt-text">
            Discarded
            <span className="ml-2 text-sm font-normal bg-red-100 text-red-600 px-2 py-0.5 rounded-full">
              {ads.length}
            </span>
          </h2>
          <p className="text-sm text-gray-400">Ads that didn't meet quality threshold</p>
        </div>
        <button
          onClick={onViewDiscarded}
          className="text-sm font-button font-medium text-vt-accent hover:text-vt-primary transition-colors"
        >
          View All
        </button>
      </div>

      <div
        onClick={onViewDiscarded}
        className="flex gap-2 cursor-pointer p-4 bg-white rounded-2xl border border-gray-100/60 shadow-sm hover:shadow-md transition-all overflow-hidden"
      >
        {Array.from({ length: visibleCount }).map((_, i) => (
          <AdCardBack key={i} index={i} />
        ))}
        {ads.length > visibleCount && (
          <div className="w-[120px] h-[170px] rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-sm text-gray-400 font-medium">
              +{ads.length - visibleCount}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
