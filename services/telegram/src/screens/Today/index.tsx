/**
 * Today screen — composed from the data hooks (T-14) and the four hero
 * blocks (T-15): streak ring, Yesterday-digest, 90-day heat-map,
 * Recently-reviewed carousel.
 *
 * Streak / yesterday / heat-map read from `useDailyStats`, which returns
 * deterministic mock data until the matching backend endpoints ship
 * (`/api/v1/me/stats`, `/api/v1/me/yesterday`, `/api/v1/schedule/history`).
 * Every rich block is opt-out — the auth / due / summary flow keeps
 * working when swapping the mock hook for a real one.
 */

import { useTranslation } from 'react-i18next';

import { useAuth } from '../../app/use-auth';
import { LangSwitch } from '../../shared/i18n/LangSwitch';
import { DueCardsList } from './components/DueCardsList';
import { DueCardsSkeleton } from './components/DueCardsSkeleton';
import { EmptyToday } from './components/EmptyToday';
import { ErrorInline } from './components/ErrorInline';
import { HeatmapCalendar } from './components/HeatmapCalendar';
import { RecentlyReviewedCarousel } from './components/RecentlyReviewedCarousel';
import { ScheduleSummaryStrip } from './components/ScheduleSummaryStrip';
import { StreakRing } from './components/StreakRing';
import { YesterdayDigest } from './components/YesterdayDigest';
import { useConspectusesDue } from './hooks/useConspectusesDue';
import { useDailyStats } from './hooks/useDailyStats';
import { useScheduleSummary } from './hooks/useScheduleSummary';

export function Today() {
  const { t } = useTranslation();
  const auth = useAuth();
  const due = useConspectusesDue();
  const summary = useScheduleSummary();
  const stats = useDailyStats();

  return (
    <main
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        paddingTop: 'var(--tma-safe-top, 0)',
        paddingBottom: 'var(--tma-safe-bottom, 0)',
        background: 'var(--tg-bg-color, #0f0f10)',
        color: 'var(--tg-text-color, #f5f5f7)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.25rem 1rem 3rem' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '1.35rem', margin: '0 0 .25rem' }}>{t('today.title')}</h1>
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                color: 'var(--tg-hint-color, #708499)',
              }}
            >
              {t('today.greeting')}
            </p>
          </div>
          <LangSwitch />
        </header>

        {auth.status !== 'authenticated' && (
          <div
            style={{
              marginTop: '2rem',
              padding: '1rem',
              borderRadius: 12,
              background: 'var(--tg-secondary-bg-color, #232e3c)',
              fontSize: '0.85rem',
              color: 'var(--tg-hint-color, #708499)',
            }}
          >
            {auth.status === 'authenticating' && t('auth.connecting')}
            {auth.status === 'error' && (auth.error?.message ?? t('auth.error'))}
          </div>
        )}

        {auth.status === 'authenticated' && (
          <>
            <StreakRing data={stats.streak} />
            <YesterdayDigest data={stats.yesterday} />

            {summary.isPending && <ScheduleSummaryStripSkeleton />}
            {summary.isError && (
              <ErrorInline
                label={t('today.error.summary')}
                onRetry={() => summary.refetch()}
              />
            )}
            {summary.data && <ScheduleSummaryStrip data={summary.data} />}

            <section aria-labelledby="due-h" style={{ marginTop: '1rem' }}>
              <h2
                id="due-h"
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--tg-hint-color, #708499)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  margin: '0 0 0.5rem',
                }}
              >
                {t('today.dueSection')}
              </h2>
              {due.isPending && <DueCardsSkeleton />}
              {due.isError && (
                <ErrorInline
                  label={t('today.error.cards')}
                  onRetry={() => due.refetch()}
                />
              )}
              {due.data && due.data.length === 0 && <EmptyToday />}
              {due.data && due.data.length > 0 && <DueCardsList items={due.data} />}
            </section>

            <RecentlyReviewedCarousel items={stats.recentlyReviewed} />
            <HeatmapCalendar data={stats.heatmap} />
          </>
        )}
      </div>
    </main>
  );
}

function ScheduleSummaryStripSkeleton() {
  const cell = (i: number) => (
    <div
      key={i}
      style={{
        flex: 1,
        height: 68,
        background: 'var(--tg-secondary-bg-color, #232e3c)',
        opacity: 0.65,
        borderRadius: 12,
      }}
    />
  );
  return (
    <div style={{ display: 'flex', gap: 8, margin: '1rem 0' }} aria-label="Summary loading">
      {cell(0)}
      {cell(1)}
      {cell(2)}
    </div>
  );
}
