/**
 * 90-day heat-map — GitHub-contribution-style grid showing review activity.
 *
 * Data source: `useDailyStats().heatmap` — mocked (deterministic seeded);
 * swaps onto `GET /api/v1/schedule/history?days=90` once the endpoint lands.
 *
 * Layout: `weeks × 7` grid rendered as CSS grid, so the columns wrap into
 * a natural calendar shape without touching flex math. Each cell tints
 * from `--tg-secondary-bg-color` (intensity 0) up to `--tg-button-color`
 * (intensity 4) via CSS `color-mix`, so light and dark modes get the same
 * legibility for free.
 */

import { useTranslation } from 'react-i18next';

import type { HeatmapDay } from '../hooks/useDailyStats';

type Props = { data: HeatmapDay[] };

// Intensity → tint mix percentage (0 = base grey, 4 = full accent).
const INTENSITY_MIX = [0, 24, 46, 68, 92] as const;

export function HeatmapCalendar({ data }: Props) {
  const { t } = useTranslation();

  // Group into weeks (7 cells per column). The first column may be partial
  // when the window doesn't start on Monday; we pad the *front* with empty
  // cells so today lands in the correct row of the last column.
  const daysWithWeekday = data.map((d) => ({ ...d, weekday: new Date(`${d.isoDate}T00:00:00Z`).getUTCDay() }));
  const first = daysWithWeekday[0];
  // Convert Sun=0..Sat=6 to a Mon-first offset (Mon=0..Sun=6).
  const leadingPad = first ? (first.weekday + 6) % 7 : 0;
  const cells: (HeatmapDay | null)[] = [
    ...Array.from({ length: leadingPad }, () => null),
    ...data,
  ];
  const weekCount = Math.ceil(cells.length / 7);

  return (
    <section aria-labelledby="heatmap-h" style={{ marginTop: '1.25rem' }}>
      <h2
        id="heatmap-h"
        style={{
          fontSize: '0.75rem',
          color: 'var(--tg-hint-color, #708499)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          margin: '0 0 0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{t('today.heatmap.title')}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.6rem' }}>
          <span>{t('today.heatmap.less')}</span>
          {INTENSITY_MIX.map((mix, idx) => (
            <span
              key={idx}
              aria-hidden="true"
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background:
                  mix === 0
                    ? 'var(--tg-secondary-bg-color, #232e3c)'
                    : `color-mix(in oklab, var(--tg-button-color, #3390ec) ${mix}%, var(--tg-secondary-bg-color, #232e3c))`,
              }}
            />
          ))}
          <span>{t('today.heatmap.more')}</span>
        </span>
      </h2>
      <div
        role="grid"
        aria-label={t('today.heatmap.title')}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${weekCount}, 1fr)`,
          gridAutoRows: 'auto',
          gap: 3,
          padding: '0.5rem',
          borderRadius: 12,
          background: 'var(--tg-bg-color, #17212b)',
          border: '1px solid var(--tg-secondary-bg-color, #232e3c)',
        }}
      >
        {Array.from({ length: weekCount }).map((_, week) => (
          <div
            key={week}
            role="row"
            style={{ display: 'grid', gridTemplateRows: 'repeat(7, 1fr)', gap: 3 }}
          >
            {Array.from({ length: 7 }).map((__, day) => {
              const cell = cells[week * 7 + day] ?? null;
              const mix = cell ? INTENSITY_MIX[cell.intensity] : 0;
              return (
                <div
                  key={day}
                  role="gridcell"
                  aria-label={
                    cell
                      ? t('today.heatmap.cell', { date: cell.isoDate, count: cell.count })
                      : ''
                  }
                  title={cell ? `${cell.isoDate} · ${cell.count}` : ''}
                  style={{
                    aspectRatio: '1 / 1',
                    borderRadius: 3,
                    background:
                      !cell
                        ? 'transparent'
                        : mix === 0
                          ? 'var(--tg-secondary-bg-color, #232e3c)'
                          : `color-mix(in oklab, var(--tg-button-color, #3390ec) ${mix}%, var(--tg-secondary-bg-color, #232e3c))`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
