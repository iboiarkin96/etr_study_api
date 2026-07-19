/**
 * Compact three-count strip at the top of Today: due-now / next-24h /
 * total-active. Structural rendering only — the rich HeatmapCalendar
 * arrives in T-15.
 */

import type { ScheduleSummary } from '../hooks/useScheduleSummary';

type Props = { data: ScheduleSummary };

export function ScheduleSummaryStrip({ data }: Props) {
  const cell = (label: string, value: number) => (
    <div
      key={label}
      style={{
        flex: 1,
        padding: '0.65rem 0.5rem',
        borderRadius: 12,
        background: 'var(--tg-secondary-bg-color, #232e3c)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontSize: '1.35rem',
          fontWeight: 600,
          color: 'var(--tg-text-color, #f5f5f7)',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '0.68rem',
          color: 'var(--tg-hint-color, #708499)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );

  return (
    <div
      aria-label="Schedule summary"
      style={{
        display: 'flex',
        gap: 8,
        margin: '1rem 0',
      }}
    >
      {cell('сейчас', data.due_now)}
      {cell('за 24 ч', data.due_next_24h)}
      {cell('всего', data.total)}
    </div>
  );
}
