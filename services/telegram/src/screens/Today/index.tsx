/**
 * Today screen · variant A (Amie · Signature).
 *
 * Composed from real data: `useConspectusesDue`, `useScheduleSummary`,
 * `useMeStats`, `useMeYesterday`, `useScheduleHistory`. Every block owns
 * its own loading / error surface so a slow endpoint doesn't blank the
 * whole screen; only the auth gate hides the composed body entirely.
 */

import { Link, useNavigate } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useSearch } from '../Search/search-context';
import { LangSwitch } from '../../shared/i18n/LangSwitch';
import { Assemble } from './components/Assemble';
import { DueCardsList, type CommitDirection } from './components/DueCardsList';
import { DueCardsSkeleton } from './components/DueCardsSkeleton';
import { EmptyToday } from './components/EmptyToday';
import { ErrorInline } from './components/ErrorInline';
import { HeatmapCalendar } from './components/HeatmapCalendar';
import { MissPeek } from './components/MissPeek';
import { RecentlyReviewedPeek } from './components/RecentlyReviewedPeek';
import { ScheduleSummaryStrip } from './components/ScheduleSummaryStrip';
import { StreakOrb } from './components/StreakOrb';
import { YesterdayDigest } from './components/YesterdayDigest';
import { useIsTelegramClient } from '../../shared/chrome/useIsTelegramClient';
import { useTelegramMainButton } from '../../shared/chrome/useTelegramMainButton';
import { useTelegramSettingsButton } from '../../shared/chrome/useTelegramSettingsButton';
import {
  DURATION_BASE_MS,
  DURATION_FAST_MS,
  durationSec,
} from '../../shared/motion/tokens';
import { useConspectusesDue } from './hooks/useConspectusesDue';
import { useMeStats } from './hooks/useMeStats';
import { useMeYesterday } from './hooks/useMeYesterday';
import { useReviewConspectus } from './hooks/useReviewConspectus';
import { useScheduleHistory } from './hooks/useScheduleHistory';
import { useScheduleSummary } from './hooks/useScheduleSummary';

export function Today() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = useSearch();
  const due = useConspectusesDue();
  const summary = useScheduleSummary();
  const stats = useMeStats();
  const yesterday = useMeYesterday();
  const history = useScheduleHistory(90);
  const review = useReviewConspectus();

  // Native SDK chrome (T-25d): Telegram-drawn Settings gear in the header
  // deep-links to Profile; MainButton at the bottom carries the primary
  // «Start Focus» CTA and disappears when there is nothing to review.
  // Both no-op outside real Telegram — the on-canvas «Start Focus» button
  // below hides via `isTelegramClient` so the user never sees two primary
  // CTAs that do the same thing.
  const isTelegramClient = useIsTelegramClient();
  useTelegramSettingsButton(() => {
    void navigate({ to: '/me' });
  });
  const dueCount = due.data?.length ?? 0;
  useTelegramMainButton(
    dueCount > 0
      ? {
          text: t('focus.start'),
          onClick: () => void navigate({ to: '/focus' }),
        }
      : null,
  );

  /** Per-row in-flight direction — drives the swipe-off animation on the
   * matching SwipeRow, independent of the useMutation's singleton state. */
  const [committing, setCommitting] = useState<Map<string, CommitDirection>>(new Map());
  /** Uuids whose review request failed — the inline banner names them. */
  const [failedUuids, setFailedUuids] = useState<Set<string>>(new Set());

  const handleReview = useCallback(
    (uuid: string, tag: 'easy' | 'hard' | 'forgot', direction: CommitDirection, expected: number | null) => {
      setCommitting((m) => {
        const n = new Map(m);
        n.set(uuid, direction);
        return n;
      });
      setFailedUuids((s) => {
        if (!s.has(uuid)) return s;
        const n = new Set(s);
        n.delete(uuid);
        return n;
      });
      review.mutate(
        { conspectus_uuid: uuid, tag, expected_schedule_revision: expected },
        {
          onError: () =>
            setFailedUuids((s) => {
              const n = new Set(s);
              n.add(uuid);
              return n;
            }),
          onSettled: () =>
            setCommitting((m) => {
              const n = new Map(m);
              n.delete(uuid);
              return n;
            }),
        },
      );
    },
    [review],
  );

  const clearFailed = useCallback(() => setFailedUuids(new Set()), []);

  const dueToday = summary.data?.due_now ?? due.data?.length ?? 0;
  const recentlyReviewed = (due.data ?? []).slice(0, 5);

  // Auth loading + error states handled globally by <AuthGate>; by the
  // time this screen renders, `auth.status === 'authenticated'` is a
  // given. Local `auth.status === 'authenticating'` plates were removed.

  return (
    <main
      className="tma-scope"
      data-density="regular"
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        paddingTop: 'var(--tma-safe-top, 0)',
        paddingBottom: 'var(--tma-safe-bottom, 0)',
        background: 'var(--tma-surface-canvas)',
        color: 'var(--tma-text-primary)',
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--tma-sp-5) 0 var(--tma-sp-12)' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--tma-sp-3)',
            padding: '0 var(--tma-sp-4)',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              style={{
                fontSize: 'var(--tma-fs-h3)',
                fontWeight: 'var(--tma-fw-bold)',
                margin: 0,
                color: 'var(--tma-text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              {t('today.title')}
            </h1>
            <p
              style={{
                margin: 'var(--tma-sp-1) 0 0',
                fontSize: 'var(--tma-fs-small)',
                color: 'var(--tma-text-tertiary)',
              }}
            >
              {t('today.greeting')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => search.open()}
            aria-label={t('search.open')}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              color: 'var(--tma-text-tertiary)',
              fontSize: 'var(--tma-fs-lead)',
              padding: 'var(--tma-sp-2)',
              borderRadius: 'var(--tma-rad-2)',
              cursor: 'pointer',
              minWidth: 44,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ⌕
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/encode' })}
            aria-label={t('today.newNote')}
            title={t('today.newNote')}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'color-mix(in oklab, var(--tma-tone-accent) 14%, transparent)',
              color: 'var(--tma-tone-accent)',
              padding: 'var(--tma-sp-2)',
              borderRadius: 'var(--tma-rad-full)',
              cursor: 'pointer',
              minWidth: 40,
              minHeight: 40,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'var(--tma-fw-semi)',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M8 2v12M2 8h12"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => void navigate({ to: '/me' })}
            aria-label={t('today.openProfile')}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              color: 'var(--tma-text-tertiary)',
              padding: 'var(--tma-sp-2)',
              borderRadius: 'var(--tma-rad-2)',
              cursor: 'pointer',
              minWidth: 44,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-6.5 8-6.5S20 17 20 21" />
            </svg>
          </button>
          <LangSwitch />
          {import.meta.env.DEV && (
            <Link
              to="/debug/haptics"
              aria-label="Debug haptics"
              title="Debug haptics"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 'var(--tma-rad-full)',
                background: 'color-mix(in oklab, var(--tma-tone-warn) 20%, transparent)',
                color: 'var(--tma-tone-warn)',
                fontSize: 16,
                textDecoration: 'none',
                marginLeft: 4,
              }}
            >
              🐛
            </Link>
          )}
        </header>

        {/* AuthGate guarantees auth.status === 'authenticated' by the time
            we render here. */}
        <>
          {stats.isPending && <OrbSlotPlaceholder />}
            {stats.data && (
              <Assemble hero>
                <StreakOrb data={stats.data.streak} dueToday={dueToday} size="lg" />
              </Assemble>
            )}
            {stats.isError && (
              <div style={{ padding: '0 var(--tma-sp-4)', marginTop: 'var(--tma-sp-4)' }}>
                <ErrorInline label={t('today.error.streak')} onRetry={() => stats.refetch()} />
              </div>
            )}
            <Assemble order={1}>
              {yesterday.isPending && <YesterdayDigestSkeleton />}
              {yesterday.isError && (
                <div style={{ padding: '0 var(--tma-sp-4)' }}>
                  <ErrorInline
                    label={t('today.error.yesterday')}
                    onRetry={() => yesterday.refetch()}
                  />
                </div>
              )}
              {yesterday.data && <YesterdayDigest data={yesterday.data.yesterday} />}
            </Assemble>

            {/* Weekly miss peek — quiet 1-line pill under YesterdayDigest.
             * Renders only when at least one miss has been logged in the
             * last 7 days; own Assemble slot so the stagger looks intentional. */}
            <Assemble order={2}>
              <MissPeek />
            </Assemble>

            <Assemble order={3}>
              {summary.isPending && <ScheduleSummaryStripSkeleton />}
              {summary.isError && (
                <div style={{ padding: '0 var(--tma-sp-4)' }}>
                  <ErrorInline
                    label={t('today.error.summary')}
                    onRetry={() => summary.refetch()}
                  />
                </div>
              )}
              {summary.data && <ScheduleSummaryStrip data={summary.data} />}
            </Assemble>

            {due.data && due.data.length > 0 && !isTelegramClient && (
              <Assemble order={4}>
                <div style={{ padding: '0 var(--tma-sp-4)', marginTop: 'var(--tma-sp-4)' }}>
                  <Link
                    to="/focus"
                    className="tma-btn tma-btn--primary"
                    style={{ display: 'block', textAlign: 'center' }}
                  >
                    {t('focus.start')}
                  </Link>
                </div>
              </Assemble>
            )}

            <Assemble order={5}>
            <section className="tma-section" aria-labelledby="due-h">
              <div className="tma-section__header" id="due-h">
                {t('today.dueSection')}
              </div>
              {due.isPending && (
                <div style={{ padding: '0 var(--tma-sp-4)' }}>
                  <DueCardsSkeleton />
                </div>
              )}
              {due.isError && (
                <div style={{ padding: '0 var(--tma-sp-4)' }}>
                  <ErrorInline
                    label={t('today.error.cards')}
                    onRetry={() => due.refetch()}
                  />
                </div>
              )}
              {due.data && (
                <AnimatePresence initial={false} mode="wait">
                  {due.data.length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: durationSec(DURATION_BASE_MS) }}
                    >
                      <EmptyToday />
                    </motion.div>
                  ) : (
                    <motion.div key="list" exit={{ opacity: 0, transition: { duration: durationSec(DURATION_FAST_MS) } }}>
                      <DueCardsList
                        items={due.data}
                        committing={committing}
                        onReview={handleReview}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
              {failedUuids.size > 0 && (
                <div style={{ padding: 'var(--tma-sp-2) var(--tma-sp-4) 0' }}>
                  <ErrorInline
                    label={t('today.reviewError', { count: failedUuids.size })}
                    onRetry={clearFailed}
                  />
                </div>
              )}
            </section>
            </Assemble>

            <Assemble order={6}>
              {history.isPending && <HeatmapSkeleton />}
              {history.isError && (
                <div style={{ padding: '0 var(--tma-sp-4)', marginTop: 'var(--tma-sp-4)' }}>
                  <ErrorInline
                    label={t('today.error.history')}
                    onRetry={() => history.refetch()}
                  />
                </div>
              )}
              {history.data && (
                /* Tapping the heat-map opens the dedicated /schedule surface —
                 * the same 90-day window at full width, with the summary strip
                 * up top and screen-level empty state. The link wraps the whole
                 * block so it reads as a single tap-target for screen readers. */
                <Link
                  to="/schedule"
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
                  aria-label={t('today.heatmap.openSchedule')}
                >
                  <HeatmapCalendar data={history.data.days} />
                </Link>
              )}
            </Assemble>
            {recentlyReviewed.length > 0 && (
              <Assemble order={7}>
                <RecentlyReviewedPeek items={recentlyReviewed} />
              </Assemble>
            )}
        </>
      </div>
    </main>
  );
}

/** Reserves the orb's exact footprint while `/me/stats` loads, so the hero
 * fades into place instead of pushing everything below it down. */
function OrbSlotPlaceholder() {
  return (
    <div
      aria-hidden
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: 'var(--tma-sp-6, 24px) 0 var(--tma-sp-4, 16px)',
      }}
    >
      <div
        style={{
          width: 260,
          aspectRatio: '1 / 1',
          borderRadius: '50%',
          background: 'var(--tma-surface-plate)',
          opacity: 0.4,
        }}
      />
    </div>
  );
}

/** Reserves the yesterday-digest strip's footprint (single 44 px pill on a
 * plate) so the block below doesn't jump 44+16 px when /me/yesterday
 * settles. Same visual weight as the real digest — plate background at
 * 60 % opacity, matching corner radius, matching horizontal margins. */
function YesterdayDigestSkeleton() {
  return (
    <div
      aria-label="Yesterday loading"
      style={{
        margin: '0 var(--tma-sp-4) var(--tma-sp-4)',
        height: 52,
        borderRadius: 'var(--tma-rad-3)',
        background: 'var(--tma-surface-plate)',
        opacity: 0.6,
      }}
    />
  );
}

/** Reserves the heat-map's footprint (calendar grid + legend + stats,
 * roughly 220 px on Today) so the tap-target for /schedule doesn't
 * pop into existence 350 ms after the rest of Today has settled. Same
 * shape used by Schedule's own HeatmapSkeleton. */
function HeatmapSkeleton() {
  return (
    <div
      aria-label="Heat-map loading"
      style={{
        margin: 'var(--tma-sp-4)',
        padding: 'var(--tma-sp-5)',
        borderRadius: 'var(--tma-rad-3)',
        background: 'var(--tma-surface-plate)',
        opacity: 0.6,
        height: 220,
      }}
    />
  );
}

function ScheduleSummaryStripSkeleton() {
  const cell = (i: number) => (
    <div
      key={i}
      style={{
        flex: 1,
        height: 62,
        background: 'var(--tma-surface-plate)',
        opacity: 0.6,
        borderRadius: 'var(--tma-rad-2)',
      }}
    />
  );
  return (
    <div
      style={{
        display: 'flex',
        gap: 'var(--tma-sp-2)',
        margin: 'var(--tma-sp-4) var(--tma-sp-4)',
      }}
      aria-label="Summary loading"
    >
      {cell(0)}
      {cell(1)}
      {cell(2)}
    </div>
  );
}
