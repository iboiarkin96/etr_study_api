/**
 * Today screen · variant A (Amie · Signature).
 *
 * Composed on `tma-kit.css` primitives — `.tma-scope` on the root activates
 * tier-2 tokens, `.tma-orb` carries the streak signature, `.tma-digest`
 * carries yesterday, `.tma-heat-frame` carries the 90-day map, and
 * `.tma-section__plate` + `.tma-cell` structure the due list. Anything
 * that doesn't have a native primitive (auth banner, langswitch, three-cell
 * summary strip) uses tokens directly (`--tma-*`, no `--tg-*`) so light /
 * dark and Ember tuning apply uniformly.
 */

import { useTranslation } from 'react-i18next';

import { useAuth } from '../../app/use-auth';
import { LangSwitch } from '../../shared/i18n/LangSwitch';
import { DueCardsList } from './components/DueCardsList';
import { DueCardsSkeleton } from './components/DueCardsSkeleton';
import { EmptyToday } from './components/EmptyToday';
import { ErrorInline } from './components/ErrorInline';
import { HeatmapCalendar } from './components/HeatmapCalendar';
import { RecentlyReviewedPeek } from './components/RecentlyReviewedPeek';
import { ScheduleSummaryStrip } from './components/ScheduleSummaryStrip';
import { StreakOrb } from './components/StreakOrb';
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

  const dueToday = summary.data?.due_now ?? due.data?.length ?? 0;

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
          <LangSwitch />
        </header>

        {auth.status !== 'authenticated' && (
          <div
            role="status"
            style={{
              margin: 'var(--tma-sp-6) var(--tma-sp-4) 0',
              padding: 'var(--tma-sp-4)',
              borderRadius: 'var(--tma-rad-3)',
              background: 'var(--tma-surface-plate)',
              fontSize: 'var(--tma-fs-small)',
              color: 'var(--tma-text-tertiary)',
              boxShadow: 'var(--tma-elev-1)',
            }}
          >
            {auth.status === 'authenticating' && t('auth.connecting')}
            {auth.status === 'error' && (auth.error?.message ?? t('auth.error'))}
          </div>
        )}

        {auth.status === 'authenticated' && (
          <>
            <StreakOrb data={stats.streak} dueToday={dueToday} size="lg" />
            <YesterdayDigest data={stats.yesterday} />

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
              {due.data && due.data.length === 0 && <EmptyToday />}
              {due.data && due.data.length > 0 && <DueCardsList items={due.data} />}
            </section>

            <RecentlyReviewedPeek items={stats.recentlyReviewed} />
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
