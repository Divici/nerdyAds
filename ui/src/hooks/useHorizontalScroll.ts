import { useEffect, type RefObject } from 'react';

/** Converts vertical scroll-wheel events into horizontal scrolling on the target element. */
export function useHorizontalScroll(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      if (!el) return;
      // Only hijack vertical scroll when the container is horizontally scrollable
      if (el.scrollWidth <= el.clientWidth) return;
      if (e.deltaY === 0) return;

      e.preventDefault();
      el.scrollBy({ left: e.deltaY, behavior: 'smooth' });
    }

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [ref]);
}
