/**
 * Motion tokens for the Telegram Mini App (T-25e).
 *
 * Before this module, spring stiffness / damping and duration values were
 * scattered as magic numbers across four files — Today, DueCardsList,
 * Focus and FocusCard — and drifted whenever one screen was tweaked. Any
 * new callsite guessed. Centralising them keeps the whole app on the
 * same feel: light springs for content that arrives, medium springs for
 * cards, stiff springs for controls settling into place, and one shared
 * easing for the glassy card flip.
 *
 * All values are `as const` so `motion.div transition={SPRING_MEDIUM}`
 * type-checks against framer-motion's `Transition` union without a
 * widening cast.
 *
 * When adding a new callsite:
 *   - Pick from an existing token before minting a new one. Two nearly
 *     identical springs feel indistinguishable to the eye but drift on
 *     paper — pick the closest match and lift the reason for the choice
 *     into this file, not into the callsite.
 *   - If nothing fits, add the token here with the same shape (name +
 *     JSDoc explaining *when* to reach for it) and use it. That's how
 *     the vocabulary grows on purpose instead of by accident.
 */

/** Content that arrives — hero mount, ambient fade-ins. Overshoot is
 *  visible but subtle; matches the app's «warm, not bouncy» tone. */
export const SPRING_SOFT = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 24,
};

/** Default for cards, panels, sheets. Reads as «placed, not thrown». */
export const SPRING_MEDIUM = {
  type: 'spring' as const,
  stiffness: 300,
  damping: 28,
};

/** Controls settling to their resting position — swipe rows returning
 *  to x=0, focused card seating into the stage. Snaps hard, minimal
 *  overshoot so the eye doesn't track the wobble. */
export const SPRING_STIFF = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 40,
};

/** Fast exit / discreet fade — «this is leaving, don't linger». */
export const DURATION_FAST_MS = 150;

/** The default transition budget for elements changing appearance in
 *  place (colour, opacity, small transforms). Fits within one frame
 *  buffer on 60 Hz devices without dragging. */
export const DURATION_BASE_MS = 220;

/** The «watchable» transition — reserved for the Focus card flip and
 *  full-screen route transitions where the movement itself is content.
 *  Under 450 ms so it never blocks a rapid tap-tap flow. */
export const DURATION_SLOW_MS = 450;

/** Framer expresses durations in seconds, DOM APIs in milliseconds.
 *  These helpers keep unit conversions on ONE line instead of every
 *  callsite doing `duration: 0.22`. */
export const durationSec = (ms: number): number => ms / 1000;
export const durationMs = (sec: number): number => sec * 1000;

/** The glassy card-flip easing — asymmetric cubic-bezier that leans
 *  into the halfway point (peak visual interest at ~55 % progress).
 *  Same numbers ship on FocusCard's 180° rotation. */
export const EASE_GLASS = [0.7, 0, 0.3, 1] as const;

/** Standard ease-out for exits — quick handoff to the next state
 *  without the classic material-design bounce-back. */
export const EASE_OUT = [0.2, 0, 0, 1] as const;
