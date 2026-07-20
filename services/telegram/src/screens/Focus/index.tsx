/**
 * Focus screen — SRS review flow, T-18.
 *
 * Full-screen, chrome-free surface. Sequence:
 *   loading → prompt → revealed → grading → next card → …complete
 *
 * Composition:
 *   `useFocusSession`      queue + phase + grade + reveal (owns the state)
 *   `SessionProgress`      dot strip + N/M counter
 *   `FocusCard`            tap-to-reveal card
 *   `GradeButton × 4`      Again / Hard / Good / Easy → tag mutation
 *
 * Keyboard shortcuts (desktop only): Space to reveal, 1-4 to grade, Esc to
 * back to Today. Mobile users get on-canvas buttons only.
 */

import { useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../app/use-auth';
import { ErrorInline } from '../Today/components/ErrorInline';
import { ErrorScreen } from '../Today/components/ErrorScreen';
import { formatRelative } from '../../shared/time/formatRelative';
import { FocusCard } from './components/FocusCard';
import { GradeButton } from './components/GradeButton';
import { GRADES } from './components/grade-spec';
import { SessionCompleteOrb } from './components/SessionCompleteOrb';
import { SessionRecap } from './components/SessionRecap';
import { resolveScenario } from './components/session-scenario';
import { SessionProgress } from './components/SessionProgress';
import { useFocusSession, type FocusGrade } from './hooks/useFocusSession';
import type { SessionSummary } from './hooks/useFocusSession';

const ACTIVE_PHASES = new Set(['prompt', 'revealed', 'grading']);

export function Focus() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const session = useFocusSession();
  const hoverCapable = useHoverCapable();

  /** Stable ref to the latest session so the keyboard listener effect can
   * install ONCE and still call the current callbacks. Depending on
   * `session` directly would re-install on every render (fresh object
   * identity from the hook), losing keydown events during the swap. */
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const s = sessionRef.current;
      if (s.phase === 'prompt' && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        s.reveal();
        return;
      }
      if (s.phase === 'revealed') {
        const g = KEY_TO_GRADE[e.key];
        if (g) {
          e.preventDefault();
          s.grade(g);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        void navigate({ to: '/' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (auth.status === 'error') {
    return (
      <main
        className="tma-scope"
        data-density="regular"
        style={{
          minHeight: 'var(--tma-viewport-h, 100dvh)',
          background: 'var(--tma-surface-canvas)',
          color: 'var(--tma-text-primary)',
        }}
      >
        <ErrorScreen title={t('auth.error.title')} body={t('auth.error.body')} ctaLabel={t('auth.error.cta')} onRetry={() => auth.retry()} />
      </main>
    );
  }

  return (
    <main
      className="tma-scope tma-focus"
      data-density="regular"
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        paddingTop: 'var(--tma-safe-top, 0)',
        paddingBottom: 'var(--tma-safe-bottom, 0)',
        background: 'var(--tma-surface-canvas)',
        color: 'var(--tma-text-primary)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header className="tma-focus__header">
        {session.total > 0 && (
          <SessionProgress total={session.total} index={session.index} />
        )}
        <div className="tma-focus__meta">
          <span className="tma-focus__meta-count">
            {session.total > 0
              ? `${String(Math.min(session.index + 1, session.total)).padStart(2, '0')} / ${String(session.total).padStart(2, '0')}`
              : '00 / 00'}
          </span>
          <button
            type="button"
            className="tma-focus__exit"
            onClick={() => void navigate({ to: '/' })}
            aria-label={t('focus.exit')}
          >
            ✕
          </button>
        </div>
      </header>

      <section className="tma-focus__body">
        {session.phase === 'loading' && <FocusSkeleton />}
        {session.phase === 'error' && (
          <div style={{ padding: 'var(--tma-sp-4)' }}>
            <ErrorInline label={t('focus.error.queue')} onRetry={session.reload} />
          </div>
        )}
        {session.phase === 'empty' && <FocusEndState title={t('focus.empty.title')} body={t('focus.empty.body')} primaryLabel={t('focus.backToToday')} onPrimary={() => void navigate({ to: '/' })} />}
        {session.phase === 'complete' && (
          <FocusEndState
            title={t(completeTitleKey(session.summary))}
            body={t(completeBodyKey(session.summary), { count: session.summary.graded, seconds: Math.round(session.summary.elapsedMs / 1000) })}
            primaryLabel={t('focus.backToToday')}
            onPrimary={() => void navigate({ to: '/' })}
            secondaryLabel={t('focus.restart')}
            onSecondary={session.restart}
            visual={<SessionCompleteOrb summary={session.summary} />}
          >
            <SessionRecap misses={session.sessionMisses} />
          </FocusEndState>
        )}

        <AnimatePresence initial={false} mode="wait">
          {session.current && ACTIVE_PHASES.has(session.phase) && (
            <motion.div
              key={session.current.conspectus_uuid}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="tma-focus__stage"
            >
              <FocusCard
                item={session.current}
                revealed={session.phase !== 'prompt'}
                onReveal={session.reveal}
                revealHint={t('focus.tapToReveal')}
              />
              {session.nextPreviewAt && session.phase === 'grading' && (
                <p className="tma-focus__interval-preview" aria-live="polite">
                  {t('focus.nextReview', { relative: formatRelative(session.nextPreviewAt, t) })}
                </p>
              )}
              {session.gradeError && session.lastAttempt && (
                <div style={{ padding: '0 var(--tma-sp-4)' }}>
                  <ErrorInline label={t('focus.error.grade')} onRetry={session.retryLastGrade} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {ACTIVE_PHASES.has(session.phase) && session.current && (
        <footer className="tma-focus__grades">
          {GRADES.map((spec) => (
            <GradeButton
              key={spec.grade}
              spec={spec}
              label={t(spec.labelKey)}
              onPress={session.grade}
              disabled={session.phase !== 'revealed'}
              showHotkey={hoverCapable}
            />
          ))}
        </footer>
      )}
    </main>
  );
}

const KEY_TO_GRADE: Record<string, FocusGrade | undefined> = {
  '1': 'again',
  '2': 'hard',
  '3': 'good',
  '4': 'easy',
};

/** Reactive `(hover: hover)` media-query hook — reflects mid-session input
 * changes (Bluetooth keyboard plugged into a tablet, OS toggling capability
 * flags). SSR-safe: returns `false` before first client render. */
function useHoverCapable(): boolean {
  const [capable, setCapable] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(hover: hover)').matches;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(hover: hover)');
    const onChange = (e: MediaQueryListEvent) => setCapable(e.matches);
    setCapable(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return capable;
}

function FocusSkeleton() {
  return (
    <div className="tma-focus__skeleton" aria-label="Loading session">
      <div className="tma-focus__skeleton-card" />
      <div className="tma-focus__skeleton-grades">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="tma-focus__skeleton-grade" />
        ))}
      </div>
    </div>
  );
}

type EndStateProps = {
  title: string;
  body: string;
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  visual?: React.ReactNode;
  /** Slot between the copy and the exit buttons — the session debrief. */
  children?: React.ReactNode;
};

function FocusEndState({ title, body, primaryLabel, onPrimary, secondaryLabel, onSecondary, visual, children }: EndStateProps) {
  return (
    <div className="tma-focus__end">
      {visual}
      <h1 className="tma-focus__end-title">{title}</h1>
      <p className="tma-focus__end-body">{body}</p>
      {children}
      <div className="tma-focus__end-actions">
        <button type="button" className="tma-btn tma-btn--primary" onClick={onPrimary}>
          {primaryLabel}
        </button>
        {secondaryLabel && onSecondary && (
          <button type="button" className="tma-btn tma-btn--ghost" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/** Pick scenario-specific title/body keys so celebrate / solid / rough
 * each carry copy that matches the visual. */
function completeTitleKey(summary: SessionSummary): 'focus.complete.celebrate.title' | 'focus.complete.solid.title' | 'focus.complete.rough.title' {
  const s = resolveScenario(summary);
  return `focus.complete.${s}.title` as const;
}
function completeBodyKey(summary: SessionSummary): 'focus.complete.celebrate.body' | 'focus.complete.solid.body' | 'focus.complete.rough.body' {
  const s = resolveScenario(summary);
  return `focus.complete.${s}.body` as const;
}
