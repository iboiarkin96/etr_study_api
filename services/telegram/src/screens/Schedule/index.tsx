/**
 * Schedule screen — the look-ahead surface, T-19.
 *
 * A dedicated `/schedule` route that surfaces the same schedule primitives
 * Today already renders (`ScheduleSummaryStrip` + `HeatmapCalendar`) as a
 * chrome-full standalone screen — user can navigate here from Today's
 * heat-map tap (planned) or the nav-menu. Zero client-side aggregation —
 * numbers come straight from `GET /api/v1/schedule/summary` and
 * `GET /api/v1/schedule/history?days=90` per the epic's «no client
 * aggregation» rule.
 *
 * Composition:
 *   - back-header (X to Today · title)
 *   - Assemble choreography (hero = summary strip, slots = heatmap + tip)
 *   - loading skeleton per block; screen-level empty only if both queries
 *     return zero total (extremely rare — even one card in the whole system
 *     would populate the strip)
 */

import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useTelegramBackButton } from '../../shared/chrome/useTelegramBackButton';
import { Assemble } from '../Today/components/Assemble';
import { ErrorInline } from '../Today/components/ErrorInline';
import { HeatmapCalendar } from '../Today/components/HeatmapCalendar';
import { ScheduleSummaryStrip } from '../Today/components/ScheduleSummaryStrip';
import { useScheduleHistory } from '../Today/hooks/useScheduleHistory';
import { useScheduleSummary } from '../Today/hooks/useScheduleSummary';

export function Schedule() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const summary = useScheduleSummary();
  const history = useScheduleHistory(90);

  // T-25d — native BackButton returns to Today.
  useTelegramBackButton(() => void navigate({ to: '/' }));

  // Auth loading/error handled by <AuthGate>.

  const totalReviews = history.data?.days?.reduce((s, d) => s + (d.count ?? 0), 0) ?? 0;
  const totalDue = summary.data?.total ?? 0;
  const screenIsEmpty =
    summary.isSuccess && history.isSuccess && totalReviews === 0 && totalDue === 0;

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
            alignItems: 'center',
            gap: 'var(--tma-sp-3)',
            padding: '0 var(--tma-sp-4)',
          }}
        >
          <button
            type="button"
            onClick={() => void navigate({ to: '/' })}
            aria-label={t('schedule.back')}
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
            ‹
          </button>
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
              {t('schedule.title')}
            </h1>
            <p
              style={{
                margin: 'var(--tma-sp-1) 0 0',
                fontSize: 'var(--tma-fs-small)',
                color: 'var(--tma-text-tertiary)',
              }}
            >
              {t('schedule.subtitle')}
            </p>
          </div>
        </header>

        <>
            {/* Summary strip — hero of this screen (three-count read at a glance). */}
            {summary.isPending && <ScheduleSummaryStripSkeleton />}
            {summary.isError && (
              <div style={{ padding: '0 var(--tma-sp-4)' }}>
                <ErrorInline label={t('today.error.summary')} onRetry={() => summary.refetch()} />
              </div>
            )}
            {summary.data && (
              <Assemble hero>
                <ScheduleSummaryStrip data={summary.data} />
              </Assemble>
            )}

            {/* Heat-map — slot 1 (fly-up from below). */}
            {history.isPending && <HeatmapSkeleton />}
            {history.isError && (
              <div style={{ padding: 'var(--tma-sp-4) var(--tma-sp-4) 0' }}>
                <ErrorInline label={t('today.error.history')} onRetry={() => history.refetch()} />
              </div>
            )}
            {history.data && (
              <Assemble order={1}>
                <HeatmapCalendar data={history.data.days} />
              </Assemble>
            )}

            {/* Screen-level empty — only both queries returned zero. */}
            {screenIsEmpty && (
              <Assemble order={2}>
                <div
                  style={{
                    margin: 'var(--tma-sp-6) var(--tma-sp-4) 0',
                    padding: 'var(--tma-sp-5)',
                    borderRadius: 'var(--tma-rad-3)',
                    background: 'var(--tma-surface-plate)',
                    boxShadow: 'var(--tma-elev-1)',
                    textAlign: 'center',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 'var(--tma-fs-body)',
                      fontWeight: 'var(--tma-fw-semi)',
                      color: 'var(--tma-text-primary)',
                    }}
                  >
                    {t('schedule.empty.title')}
                  </p>
                  <p
                    style={{
                      margin: 'var(--tma-sp-2) 0 0',
                      fontSize: 'var(--tma-fs-small)',
                      color: 'var(--tma-text-tertiary)',
                    }}
                  >
                    {t('schedule.empty.body')}
                  </p>
                </div>
              </Assemble>
            )}
        </>
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

function HeatmapSkeleton() {
  return (
    <div
      style={{
        margin: 'var(--tma-sp-4)',
        padding: 'var(--tma-sp-5)',
        borderRadius: 'var(--tma-rad-3)',
        background: 'var(--tma-surface-plate)',
        opacity: 0.6,
        height: 220,
      }}
      aria-label="Heat-map loading"
    />
  );
}
