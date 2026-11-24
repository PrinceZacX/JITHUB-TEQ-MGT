/**
 * Motion tokens for JITHUB-TEQ dashboard.
 * Primary: Emil Kowalski (restraint, ≤300ms)
 * Secondary: Jakub Krehel (subtle production polish)
 */

export const motionTokens = {
  // Durations (Emil: fast, purposeful, under 300ms)
  durations: {
    instant: 0.08,
    fast: 0.15,
    normal: 0.18,
    deliberate: 0.25,
    slow: 0.35,
  } as const,

  // Easings
  easings: {
    emil: [0.22, 1, 0.36, 1] as const, // Emil's signature ease-out
    jakub: [0.16, 1, 0.3, 1] as const, // Jakub's slightly softer
    standard: [0.25, 0.46, 0.45, 0.94] as const,
  } as const,

  // Scales (Jakub: subtle production values)
  scales: {
    press: 0.98,
    hover: 1.005,
    selected: 1.005,
    enter: 0.92,
  } as const,

  // Shadows (Jakub: layered depth)
  shadows: {
    rest: '0 1px 2px rgb(16 36 58 / 0.05)',
    hover: '0 8px 24px -8px rgb(16 36 58 / 0.12)',
    selected: '0 4px 16px -4px rgb(18 184 166 / 0.25), 0 0 0 1px var(--jt-teal)',
    focus: '0 0 0 3px rgb(18 184 166 / 0.18)',
  } as const,

  // Stagger timing
  stagger: {
    children: 0.04, // Emil: quick, purposeful
    delay: 0.05,
  } as const,
} as const;

// Reduced motion media query
export const reducedMotionQuery = '@media (prefers-reduced-motion: reduce)';

export type MotionTokens = typeof motionTokens;
