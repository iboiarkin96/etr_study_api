/**
 * FocusCard — full-screen card in the Focus review flow.
 *
 * Two visible faces: `front` (title + «Tap to reveal») and `back` (title +
 * dense_paragraph + bullets). Tap on the card body toggles prompt ↔
 * revealed via the parent's `onReveal` — the parent's `useFocusSession`
 * guards the toggle against `phase='grading'` so a stray tap can't cancel
 * a grade the user just committed.
 *
 * Element choice: this is a `<motion.div role="button" tabIndex={0}>`, not
 * a real `<button>` — buttons cannot contain block/flow content per HTML
 * spec (`<p>`, `<ul>`, `<li>` are forbidden), and Safari/Firefox can
 * reparent invalid nested DOM in ways that break the 3D-preserve layout
 * the flip depends on. The div-with-role gives us the same accessibility
 * semantics without the parsing risk; Enter/Space are handled explicitly.
 *
 * Reveal effect (respects `prefers-reduced-motion`):
 *   - **Full motion:** 3D flashcard flip 180° over 550 ms; two faces share
 *     one grid cell, back is pre-rotated 180° so it reads correctly when
 *     the whole card is at 180°; ember bloom on the stage pseudo; paragraph
 *     + bullets stagger in half-way through the flip.
 *   - **Reduced motion:** no rotation — conditionally render front OR back
 *     face. Without this branch the container stays at rotateY=0, so the
 *     back face's own rotateY(180°) would keep it facing away → reduced-
 *     motion users would toggle `revealed` forever but never see the
 *     answer.
 */

import { motion, useReducedMotion } from 'framer-motion';
import type { KeyboardEvent } from 'react';

import { haptic } from '../../../shared/haptics/haptics';
import type { DueConspectus } from '../../Today/hooks/useConspectusesDue';

type Props = {
  item: DueConspectus;
  revealed: boolean;
  onReveal: () => void;
  revealHint: string;
};

/** Hoisted at module scope so the variants object identity is stable
 * across renders — framer-motion re-triggers enter animations when the
 * variants prop is a fresh reference each render, causing stutter mid-
 * reveal on unrelated parent re-renders (query poll, keyboard-listener
 * churn, etc.). Two static constants cover both branches. */
const ITEM_VARIANTS_FULL = {
  hidden: { opacity: 0, y: 8 },
  shown: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 260, damping: 26 },
  },
} as const;

const ITEM_VARIANTS_REDUCED = {
  hidden: { opacity: 0 },
  shown: { opacity: 1 },
} as const;

const STAGGER_FULL = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.3 } },
} as const;

const STAGGER_REDUCED = {
  hidden: {},
  shown: {},
} as const;

export function FocusCard({ item, revealed, onReveal, revealHint }: Props) {
  const reduce = useReducedMotion() ?? true;
  const itemVariants = reduce ? ITEM_VARIANTS_REDUCED : ITEM_VARIANTS_FULL;
  const staggerVariants = reduce ? STAGGER_REDUCED : STAGGER_FULL;

  const handleReveal = () => {
    haptic('selection');
    onReveal();
  };

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      handleReveal();
    }
  };

  return (
    <div className="tma-focus__flip-stage" data-revealed={revealed ? 'true' : 'false'}>
      <motion.div
        role="button"
        tabIndex={0}
        className="tma-focus__card"
        data-revealed={revealed ? 'true' : 'false'}
        onClick={handleReveal}
        onKeyDown={handleKey}
        aria-live="polite"
        aria-expanded={revealed}
        animate={reduce ? { rotateY: 0 } : { rotateY: revealed ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.7, 0, 0.3, 1] }}
        style={{
          transformStyle: 'preserve-3d',
          WebkitTransformStyle: 'preserve-3d',
        }}
      >
        {/* FRONT face — visible when NOT revealed. Under reduced-motion we
            conditionally render only one face at a time (no rotation), so
            the front vanishes and the back appears without a flip. */}
        {(!reduce || !revealed) && (
          <div className="tma-focus__face tma-focus__face--front" aria-hidden={revealed}>
            <h2 className="tma-focus__prompt">{item.title ?? '—'}</h2>
            <p className="tma-focus__reveal-hint">{revealHint}</p>
          </div>
        )}

        {/* BACK face — title + paragraph + bullets. Stagger fires half-way
            through the flip so content appears to unfold as the card turns. */}
        {(!reduce || revealed) && (
          <div className="tma-focus__face tma-focus__face--back" aria-hidden={!revealed}>
            <h2 className="tma-focus__prompt">{item.title ?? '—'}</h2>
            <motion.div
              className="tma-focus__answer"
              initial="hidden"
              animate={revealed ? 'shown' : 'hidden'}
              variants={staggerVariants}
            >
              {item.dense_paragraph && (
                <motion.p className="tma-focus__paragraph" variants={itemVariants}>
                  {item.dense_paragraph}
                </motion.p>
              )}
              {item.bullets && item.bullets.length > 0 && (
                <motion.ul className="tma-focus__bullets">
                  {item.bullets.map((b, i) => (
                    /* Stable key: bullet text + index. If bullets can ever
                       reorder, the text prefix keeps framer's layout tracking
                       aligned with content, not with array position. */
                    <motion.li key={`${i}:${b.slice(0, 32)}`} variants={itemVariants}>
                      {b}
                    </motion.li>
                  ))}
                </motion.ul>
              )}
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
