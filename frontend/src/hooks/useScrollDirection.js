import { useState, useEffect, useRef } from 'react';

/**
 * Detects scroll direction for the hide-on-scroll navbar.
 * Uses a ref + requestAnimationFrame so the listener is attached only once.
 */
export const useScrollDirection = (threshold = 10) => {
  const [scrollDirection, setScrollDirection] = useState(null);
  const lastY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const ticking = useRef(false);

  useEffect(() => {
    const update = () => {
      const y = Math.max(0, window.scrollY);
      const diff = y - lastY.current;
      if (Math.abs(diff) >= threshold) {
        setScrollDirection(diff > 0 ? 'down' : 'up');
        lastY.current = y;
      }
      ticking.current = false;
    };
    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        window.requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrollDirection;
};
