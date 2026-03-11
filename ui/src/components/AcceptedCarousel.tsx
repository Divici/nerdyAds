import { useRef } from 'react';
import type { AdWithHistory } from '../types.ts';
import { AdCard } from './AdCard.tsx';

interface AcceptedCarouselProps {
  ads: AdWithHistory[];
  onAdClick: (ad: AdWithHistory) => void;
  onViewAll: () => void;
}

export function AcceptedCarousel({ ads, onAdClick, onViewAll }: AcceptedCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = 340;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -amount : amount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-heading font-semibold text-vt-text">Accepted Ads</h2>
          <p className="text-sm text-gray-400">
            {ads.length > 0
              ? `${ads.length} ad${ads.length !== 1 ? 's' : ''} passed quality threshold`
              : 'No ads generated yet. Start a campaign below.'}
          </p>
        </div>
        {ads.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-vt-text transition-colors"
            >
              &#8249;
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-vt-text transition-colors"
            >
              &#8250;
            </button>
            <button
              onClick={onViewAll}
              className="text-sm font-button font-medium text-vt-accent hover:text-vt-primary transition-colors ml-2"
            >
              View All
            </button>
          </div>
        )}
      </div>

      {ads.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-200 h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2 opacity-20">&#x1F4E2;</div>
            <p className="text-sm text-gray-400">
              No ads generated yet. Select a brief and start generating below.
            </p>
          </div>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto pb-4 scroll-smooth"
          style={{ scrollbarWidth: 'thin' }}
        >
          {ads.map((adh, i) => (
            <AdCard
              key={adh.ad.id}
              adWithHistory={adh}
              onClick={() => onAdClick(adh)}
              index={i}
              variant="default"
            />
          ))}
        </div>
      )}
    </section>
  );
}
