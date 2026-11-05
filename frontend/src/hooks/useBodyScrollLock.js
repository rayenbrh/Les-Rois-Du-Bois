import { useEffect } from 'react';

/**
 * Stops the page scrolling behind an open mobile menu.
 * iPhone browsers ignore `overflow: hidden` on the body, so the body is pinned in place.
 * That also keeps the browser toolbar from collapsing and leaving a gap under the menu.
 * On close the scroll position comes back, unless a link opened another page (then: top).
 */
export const useBodyScrollLock = (isLocked) => {
  useEffect(() => {
    if (!isLocked) return undefined;

    const { style } = document.body;
    const scrollY = window.scrollY;
    const startPath = window.location.pathname;
    const previous = {
      position: style.position,
      top: style.top,
      left: style.left,
      right: style.right,
      width: style.width,
      overflow: style.overflow,
    };

    Object.assign(style, {
      position: 'fixed',
      top: `-${scrollY}px`,
      left: '0',
      right: '0',
      width: '100%',
      overflow: 'hidden',
    });

    return () => {
      Object.assign(style, previous);
      const top = window.location.pathname === startPath ? scrollY : 0;
      window.scrollTo({ top, behavior: 'instant' });
    };
  }, [isLocked]);
};
