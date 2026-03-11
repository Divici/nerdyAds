import { useRef, useState, useEffect, useCallback } from 'react';
import type { AdWithHistory } from '../types.ts';
import { AdCard } from './AdCard.tsx';

interface AcceptedCarouselProps {
  ads: AdWithHistory[];
  onAdClick: (ad: AdWithHistory) => void;
  onViewAll: () => void;
}

export function AcceptedCarousel({ ads, onAdClick, onViewAll }: AcceptedCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [ads.length, updateScrollState]);

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
    <section className="mb-10">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-heading font-semibold text-vt-text">Accepted Ads</h2>
          <p className="text-sm text-gray-400">
            {ads.length > 0
              ? `${ads.length} ad${ads.length !== 1 ? 's' : ''} passed quality threshold`
              : 'No ads generated yet. Start a campaign below.'}
          </p>
        </div>
        {ads.length > 0 && (
          <button
            onClick={onViewAll}
            className="text-sm font-button font-medium text-vt-accent hover:text-vt-primary transition-colors"
          >
            View All
          </button>
        )}
      </div>

      {ads.length === 0 ? (
        <div className="bg-white/60 rounded-2xl border-2 border-dashed border-gray-200/60 h-64 flex items-center justify-center">
          <div className="text-center">
            <div className="text-4xl mb-2 opacity-20">&#x1F4E2;</div>
            <p className="text-sm text-gray-400">
              No ads generated yet. Select a brief and start generating below.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative flex items-center">
          {/* Left arrow */}
          <button
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="absolute -left-5 z-20 w-10 h-10 rounded-full bg-white border border-gray-200/60 shadow-md flex items-center justify-center hover:bg-gray-50 text-vt-text text-xl transition-opacity disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Carousel */}
          <div className="flex-1 overflow-hidden">
            {/* Left fade */}
            <div
              className="pointer-events-none absolute left-0 top-0 bottom-0 w-12 z-10 rounded-l-xl transition-opacity duration-200"
              style={{
                background: 'linear-gradient(to right, var(--color-vt-light), transparent)',
                opacity: canScrollLeft ? 1 : 0,
              }}
            />
            {/* Right fade */}
            <div
              className="pointer-events-none absolute right-0 top-0 bottom-0 w-12 z-10 rounded-r-xl transition-opacity duration-200"
              style={{
                background: 'linear-gradient(to left, var(--color-vt-light), transparent)',
                opacity: canScrollRight ? 1 : 0,
              }}
            />

            <div
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto pb-4 scroll-smooth styled-scrollbar"
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
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="absolute -right-5 z-20 w-10 h-10 rounded-full bg-white border border-gray-200/60 shadow-md flex items-center justify-center hover:bg-gray-50 text-vt-text text-xl transition-opacity disabled:opacity-30"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
