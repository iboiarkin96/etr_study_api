/**
 * Today screen — data-layer wiring (T-14).
 *
 * Composes two data blocks (schedule summary + due list) with their
 * loading / empty / error / success variants. Structural rendering only;
 * the visual richness (streak ring, Yesterday-digest, 90-day heat-map,
 * carousel) lands in T-15.
 */

import { useAuth } from '../../app/use-auth';
import { DueCardsList } from './components/DueCardsList';
import { DueCardsSkeleton } from './components/DueCardsSkeleton';
import { EmptyToday } from './components/EmptyToday';
import { ErrorInline } from './components/ErrorInline';
import { ScheduleSummaryStrip } from './components/ScheduleSummaryStrip';
import { useConspectusesDue } from './hooks/useConspectusesDue';
import { useScheduleSummary } from './hooks/useScheduleSummary';

export function Today() {
  const auth = useAuth();
  const due = useConspectusesDue();
  const summary = useScheduleSummary();

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
        <header>
          <h1 style={{ fontSize: '1.35rem', margin: '0 0 .25rem' }}>Сегодня</h1>
          <p
            style={{
              margin: 0,
              fontSize: '0.85rem',
              color: 'var(--tg-hint-color, #708499)',
            }}
          >
            Привет 👋 Скоро тут будет твой день.
          </p>
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
            {auth.status === 'authenticating' && 'Подключаемся к серверу…'}
            {auth.status === 'error' && (auth.error?.message ?? 'Ошибка авторизации.')}
          </div>
        )}

        {auth.status === 'authenticated' && (
          <>
            {summary.isPending && <ScheduleSummaryStripSkeleton />}
            {summary.isError && (
              <ErrorInline
                label="Не смог получить расписание"
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
                К повторению
              </h2>
              {due.isPending && <DueCardsSkeleton />}
              {due.isError && (
                <ErrorInline
                  label="Не смог получить карточки"
                  onRetry={() => due.refetch()}
                />
              )}
              {due.data && due.data.length === 0 && <EmptyToday />}
              {due.data && due.data.length > 0 && <DueCardsList items={due.data} />}
            </section>
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
