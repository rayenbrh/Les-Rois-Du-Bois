/**
 * Animation utilities and constants for consistent animations across the app
 */

// Animation durations (in seconds)
export const ANIMATION_DURATION = {
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
};

// Easing functions
export const EASING = {
  easeOut: [0.0, 0.0, 0.2, 1],
  easeInOut: [0.4, 0.0, 0.2, 1],
  spring: { type: 'spring', stiffness: 300, damping: 30 },
};

// Common animation variants
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { duration: ANIMATION_DURATION.normal, ease: EASING.easeOut }
  },
};

export const slideUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: EASING.easeOut }
  },
};

export const slideDown = {
  hidden: { opacity: 0, y: -20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: EASING.easeOut }
  },
};

export const slideInRight = {
  hidden: { opacity: 0, x: -20 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: EASING.easeOut }
  },
};

export const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: ANIMATION_DURATION.normal, ease: EASING.easeOut }
  },
};

// Stagger children animation
export const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

// Hover animations
export const hoverScale = {
  scale: 1.05,
  transition: { duration: ANIMATION_DURATION.fast, ease: EASING.easeOut },
};

export const hoverLift = {
  y: -4,
  transition: { duration: ANIMATION_DURATION.fast, ease: EASING.easeOut },
};

// Page transition
export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: ANIMATION_DURATION.normal, ease: EASING.easeOut }
  },
  exit: { 
    opacity: 0, 
    y: -20,
    transition: { duration: ANIMATION_DURATION.fast }
  },
};

