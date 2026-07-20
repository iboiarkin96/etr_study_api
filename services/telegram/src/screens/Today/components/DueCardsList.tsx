/**
 * Due-cards list — `.tma-section__plate` + `.tma-swipe` rows.
 *
 * Each row layers two elements on top of each other:
 *   - a colour-coded action bar (`.tma-swipe__bg`) that fades in as the row
 *     is dragged;
 *   - a draggable foreground (`.tma-swipe__fg`) that wraps the tap-target
 *     `<Link>` to `/conspectus/$uuid`.
 *
 * Gesture map:
 *   tap                       → route to detail
 *   swipe right past +COMMIT  → tag: 'easy'   (accent trail)
 *   swipe left  past –COMMIT  → tag: 'hard'   (warn trail)
 *   swipe left  past –DEEP    → tag: 'forgot' (danger trail — «snooze»)
 *
 * The component is pure UI: it emits `onReview(uuid, tag, direction, expected)`
 * and lets the parent wire the mutation. The parent also OWNS the per-row
 * committing state (`committing: Map<uuid, 1|-1>`) so it can clear the state
 * on error — otherwise a row whose mutation fails would stay off-screen
 * forever (the SwipeRow has no path to know about rollback).
 */

import { Link } from '@tanstack/react-router';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
import { type TFunction } from 'i18next';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { formatRelative } from '../../../shared/time/formatRelative';
import type { DueConspectus } from '../hooks/useConspectusesDue';
import type { ReviewTag } from '../hooks/useReviewConspectus';
import {
  resolveTag,
  resolveTone,
  SWIPE_THRESHOLDS,
} from './swipe-thresholds';

export type CommitDirection = 1 | -1;

type Props = {
  items: DueConspectus[];
  /** Called when a swipe crosses the commit threshold. */
  onReview?: (
    conspectus_uuid: string,
    tag: ReviewTag,
    direction: CommitDirection,
    expected_schedule_revision: number | null,
  ) => void;
  /** Per-row in-flight review direction — parent-controlled. */
  committing?: ReadonlyMap<string, CommitDirection>;
};

const SLOT_TONE: Record<string, 'accent' | 'success' | 'info' | 'warn'> = {
  A: 'accent',
  B: 'info',
  C: 'success',
  D: 'warn',
};

const { ARM, COMMIT, COMMIT_DEEP } = SWIPE_THRESHOLDS;

export function DueCardsList({ items, onReview, committing }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="tma-section__plate tma-section__plate--overflow tma-tip"
      role="list"
      aria-label={t('today.dueSection')}
      data-tip={t('today.dueList.tip')}
    >
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <SwipeRow
            key={item.conspectus_uuid}
            item={item}
            t={t}
            committing={committing?.get(item.conspectus_uuid) ?? null}
            onCommit={(tag, direction) =>
              onReview?.(
                item.conspectus_uuid,
                tag,
                direction,
                item.schedule_revision ?? null,
              )
            }
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

type RowProps = {
  item: DueConspectus;
  t: TFunction;
  onCommit: (tag: ReviewTag, direction: CommitDirection) => void;
  committing: CommitDirection | null;
};

function SwipeRow({ item, t, onCommit, committing }: RowProps) {
  // Default to `true` (safest) until the media query resolves — otherwise a
  // reduced-motion user briefly gets a draggable row on the first paint.
  const reduce = useReducedMotion() ?? true;
  const x = useMotionValue(0);
  const [armDir, setArmDir] = useState<'right' | 'left' | null>(null);
  const [commit, setCommit] = useState(false);
  const [tone, setTone] = useState<'accent' | 'warn' | 'danger'>('accent');

  useEffect(() => {
    const unsub = x.on('change', (v) => {
      if (Math.abs(v) < ARM) setArmDir(null);
      else setArmDir(v > 0 ? 'right' : 'left');
      setCommit(resolveTag(v) !== null);
      setTone(resolveTone(v));
    });
    return unsub;
  }, [x]);

  const handleDragEnd = (
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: { offset: { x: number } },
  ) => {
    const tag = resolveTag(info.offset.x);
    if (tag === null) return; // let the `animate={{ x: 0 }}` prop spring us back
    const direction: CommitDirection = info.offset.x > 0 ? 1 : -1;
    onCommit(tag, direction);
  };

  const iconTone = SLOT_TONE[item.slot] ?? 'accent';
  const leftLabel = tone === 'danger' ? t('today.swipe.forgot') : t('today.swipe.hard');

  return (
    <motion.div
      className="tma-swipe"
      role="listitem"
      data-armed-dir={armDir ?? ''}
      data-commit={commit ? 'true' : 'false'}
      data-committing={committing ? 'true' : 'false'}
      exit={
        reduce
          ? { opacity: 0 }
          : { opacity: 0, height: 0, transition: { duration: 0.25 } }
      }
      layout="position"
    >
      <div
        className="tma-swipe__bg tma-swipe__bg--right"
        data-tone="accent"
        aria-hidden="true"
      >
        <span className="tma-swipe__bg-label">
          <span className="tma-swipe__bg-glyph">✓</span>
          {t('today.swipe.easy')}
        </span>
      </div>
      <div
        className="tma-swipe__bg tma-swipe__bg--left"
        data-tone={tone === 'danger' ? 'danger' : 'warn'}
        aria-hidden="true"
      >
        <span className="tma-swipe__bg-label">
          {leftLabel}
          <span className="tma-swipe__bg-glyph">{tone === 'danger' ? '↺' : '·'}</span>
        </span>
      </div>

      <motion.div
        className="tma-swipe__fg"
        drag={reduce || committing ? false : 'x'}
        dragConstraints={{ left: -COMMIT_DEEP - ARM, right: COMMIT + ARM }}
        dragElastic={0.2}
        style={{ x }}
        onDragEnd={handleDragEnd}
        animate={
          committing
            ? { x: committing * window.innerWidth, opacity: 0 }
            : { x: 0 }
        }
        transition={{ type: 'spring', stiffness: 400, damping: 40 }}
      >
        <Link
          to="/conspectus/$conspectus_uuid"
          params={{ conspectus_uuid: item.conspectus_uuid }}
          className="tma-cell"
          style={{ textDecoration: 'none', color: 'inherit' }}
          draggable={false}
        >
          <div className="tma-cell__icon" data-tone={iconTone}>
            {item.slot}
          </div>
          <div className="tma-cell__main">
            <div className="tma-cell__title">{item.title}</div>
            {item.next_review_at && (
              <div className="tma-cell__subtitle">
                {formatRelative(item.next_review_at, t)}
              </div>
            )}
          </div>
          <div className="tma-cell__aside">{item.slot}</div>
          <div className="tma-cell__chevron" aria-hidden="true">
            ›
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}
