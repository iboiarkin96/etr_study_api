/**
 * Session driver for the Focus screen.
 *
 * Wraps `useConspectusesDue` — takes at most `SESSION_CAP` cards, tracks the
 * current index, exposes reveal + grade + advance transitions, and rolls up
 * a lightweight session summary (`graded`, `perTag`, `elapsedMs`). Reveal
 * toggles prompt ↔ revealed; grade fires the shared `useReviewConspectus`
 * mutation and — on server-ack — advances the index. On error the parent
 * keeps the card visible with a toast; the caller can retry the same card
 * via `retryLastGrade` (which replays the last attempted grade, NOT a
 * hard-coded fallback — the user's intent survives the round trip).
 *
 * The mutation itself is pessimistic (row leaves the due-list cache only on
 * server-ack), so the session's «advance to next card» reads deterministic
 * server state, not an optimistic guess.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { DueConspectus } from '../../Today/hooks/useConspectusesDue';
import { useConspectusesDue } from '../../Today/hooks/useConspectusesDue';
import {
  useReviewConspectus,
  type ReviewTag,
} from '../../Today/hooks/useReviewConspectus';

/** Duolingo-tier session cap — anything longer degrades recall (per mock). */
export const SESSION_CAP = 20;

/** UI grades the Focus buttons expose. Server tags collapse Good → hard until
 * the 4-tag server contract lands; the client keeps the 4-value distinction
 * for analytics + UX (button colour + haptic pattern differ). */
export type FocusGrade = 'again' | 'hard' | 'good' | 'easy';

const GRADE_TO_TAG: Record<FocusGrade, ReviewTag> = {
  again: 'forgot',
  hard: 'hard',
  good: 'hard',
  easy: 'easy',
};

export type SessionSummary = {
  graded: number;
  perGrade: Record<FocusGrade, number>;
  perTag: Record<ReviewTag, number>;
  elapsedMs: number;
};

/** Factory keeps every SessionSummary field in one literal so adding a field
 * only requires touching this function (not `restart()` and `EMPTY_SUMMARY`
 * separately). */
function emptySummary(): SessionSummary {
  return {
    graded: 0,
    perGrade: { again: 0, hard: 0, good: 0, easy: 0 },
    perTag: { easy: 0, hard: 0, forgot: 0 },
    elapsedMs: 0,
  };
}

export type FocusPhase =
  | 'loading'
  | 'empty'
  | 'error'
  | 'prompt'
  | 'revealed'
  | 'grading'
  | 'complete';

/** A single card the user marked Again/Hard in this session — kept in-order,
 * newest last. Consumed by the completion screen's «Log a miss» hook: the
 * last entry becomes the pre-filled conspectus link on `/errors`. */
export type SessionMiss = {
  conspectus_uuid: string;
  title: string | null;
  grade: Extract<FocusGrade, 'again' | 'hard'>;
};

export type FocusSession = {
  phase: FocusPhase;
  queue: readonly DueConspectus[];
  current: DueConspectus | null;
  index: number;
  total: number;
  summary: SessionSummary;
  /** Cards the user marked Again or Hard in this session, in grade order. Good
   * counts as recall (client-only distinction — server tag is still `hard`);
   * Easy is obviously not a miss. Reset on `restart()`. */
  sessionMisses: readonly SessionMiss[];
  nextPreviewAt: string | null;
  /** The last grade the user tried to submit — persists through the error
   * banner so `retryLastGrade` can re-send the same intent. */
  lastAttempt: FocusGrade | null;
  reveal: () => void;
  grade: (grade: FocusGrade) => void;
  retryLastGrade: () => void;
  restart: () => void;
  gradeError: Error | null;
  reload: () => void;
};

export function useFocusSession(): FocusSession {
  const due = useConspectusesDue();
  const review = useReviewConspectus();

  /** Session start-time in a ref so `restart()` can reset it without going
   * through render (state would need `setState` + effect). Reset on restart. */
  const startedAtRef = useRef<number>(Date.now());
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [summary, setSummary] = useState<SessionSummary>(emptySummary);
  const [sessionMisses, setSessionMisses] = useState<readonly SessionMiss[]>([]);
  const [nextPreviewAt, setNextPreviewAt] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<FocusGrade | null>(null);
  /** Bump on restart so the queue-snapshot effect re-fires and pulls fresh
   * server state (memo on `[due.isSuccess]` didn't — flag stays true across
   * refetches). */
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [queue, setQueue] = useState<readonly DueConspectus[]>([]);
  /** Which epoch is currently frozen in `queue`. Prevents mid-session cache
   * mutations (e.g. useReviewConspectus.onSuccess drops the reviewed row
   * from due-list) from silently reshuffling the queue behind the user. */
  const seededEpochRef = useRef(-1);

  /** Seed the queue exactly once per epoch — on first success at epoch N, or
   * on `restart()` which bumps sessionEpoch. Later `due.data` mutations at
   * the same epoch DON'T reshuffle the frozen snapshot (that's the whole
   * point of a session queue). */
  useEffect(() => {
    if (!due.isSuccess) return;
    if (seededEpochRef.current === sessionEpoch) return;
    const fresh = (due.data ?? []).slice(0, SESSION_CAP);
    seededEpochRef.current = sessionEpoch;
    setQueue(fresh);
  }, [due.isSuccess, sessionEpoch, due.data]);

  const total = queue.length;
  const current = index < total ? queue[index] : null;

  const phase: FocusPhase = (() => {
    if (due.isPending) return 'loading';
    if (due.isError) return 'error';
    if (total === 0) return 'empty';
    if (current === null) return 'complete';
    if (review.isPending) return 'grading';
    return revealed ? 'revealed' : 'prompt';
  })();

  /** Toggle prompt ↔ revealed. Guarded against grading so a stray tap can't
   * cancel a grade the user just committed. */
  const reveal = useCallback(() => {
    if (review.isPending) return;
    setRevealed((r) => !r);
  }, [review.isPending]);

  const submitGrade = useCallback(
    (g: FocusGrade) => {
      if (!current) return;
      // Double-fire guard — a rapid tap or an autorepeating keyboard hotkey
      // between the mutation resolving and React committing the new index
      // would otherwise re-review the just-graded card.
      if (review.isPending) return;
      const tag = GRADE_TO_TAG[g];
      setLastAttempt(g);
      // Clear the previous card's preview so the banner never surfaces stale
      // data — the new preview lands via onSuccess below.
      setNextPreviewAt(null);
      review.mutate(
        {
          conspectus_uuid: current.conspectus_uuid,
          tag,
          expected_schedule_revision: current.schedule_revision ?? null,
        },
        {
          onSuccess: (data) => {
            setSummary((s) => ({
              graded: s.graded + 1,
              perGrade: { ...s.perGrade, [g]: s.perGrade[g] + 1 },
              perTag: { ...s.perTag, [tag]: s.perTag[tag] + 1 },
              elapsedMs: Date.now() - startedAtRef.current,
            }));
            if (g === 'again' || g === 'hard') {
              // Snapshot the card that was just missed so the completion
              // screen's «Log a miss» hook can pre-fill /errors with the
              // right conspectus_uuid + title.
              setSessionMisses((prev) => [
                ...prev,
                { conspectus_uuid: current.conspectus_uuid, title: current.title ?? null, grade: g },
              ]);
            }
            setNextPreviewAt(data?.next_review_at ?? null);
            setIndex((i) => i + 1);
            setRevealed(false);
            setLastAttempt(null); // cleared on success — retry banner disappears
          },
        },
      );
    },
    [current, review],
  );

  const retryLastGrade = useCallback(() => {
    if (lastAttempt != null) submitGrade(lastAttempt);
  }, [lastAttempt, submitGrade]);

  const restart = useCallback(() => {
    setIndex(0);
    setRevealed(false);
    setSummary(emptySummary());
    setSessionMisses([]);
    setNextPreviewAt(null);
    setLastAttempt(null);
    startedAtRef.current = Date.now();
    setSessionEpoch((e) => e + 1);
    void due.refetch();
  }, [due]);

  const reload = useCallback(() => {
    void due.refetch();
  }, [due]);

  return {
    phase,
    queue,
    current,
    index,
    total,
    summary,
    sessionMisses,
    nextPreviewAt,
    lastAttempt,
    reveal,
    grade: submitGrade,
    retryLastGrade,
    restart,
    gradeError: review.error,
    reload,
  };
}

export { GRADE_TO_TAG };
