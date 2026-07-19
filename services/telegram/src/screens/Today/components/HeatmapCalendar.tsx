/**
 * 90-day heat-map — rendered on `.tma-heat-frame > .tma-heat` from
 * `tma-kit.css`. The kit lays cells left-to-right, wrapping into
 * `grid-template-columns: repeat(13, 1fr)`, and drives colour + hover
 * tooltip entirely through `data-level` / `data-count` / `data-date`
 * attributes — so this component is pure attribute glue, no inline
 * styling and no CSS of its own.
 *
 * Data source: `useDailyStats().heatmap` — mocked (deterministic seeded);
 * swaps onto `GET /api/v1/schedule/history?days=90` once the endpoint lands.
 */

import { useTranslation } from 'react-i18next';

import type { components } from '../../../shared/api/schema';

type HeatmapDay = components['schemas']['HistoryDay'];

type Props = { data: HeatmapDay[] };

const MONTH_LABEL_INTL = new Intl.DateTimeFormat(undefined, {
  month: 'short',
});

function monthsAcross(days: HeatmapDay[], columnCount = 13): string[] {
  if (days.length === 0) return [];
  const step = Math.max(1, Math.floor(days.length / columnCount));
  const labels: string[] = [];
  let prev = '';
  for (let i = 0; i < columnCount; i++) {
    const idx = Math.min(i * step, days.length - 1);
    const d = new Date(`${days[idx].date}T00:00:00Z`);
    const label = MONTH_LABEL_INTL.format(d);
    labels.push(label === prev ? '' : label);
    prev = label;
  }
  return labels;
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function HeatmapCalendar({ data }: Props) {
  const { t } = useTranslation();
  const todayIso = new Date().toISOString().slice(0, 10);
  const months = monthsAcross(data);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const activeDays = data.filter((d) => d.count > 0).length;
  const bestDay = data.reduce<HeatmapDay | null>(
    (best, d) => (!best || d.count > best.count ? d : best),
    null,
  );

  return (
    <section className="tma-section" aria-labelledby="heatmap-h">
      <div className="tma-section__header" id="heatmap-h">
        {t('today.heatmap.title')}
      </div>
      <div className="tma-section__plate">
        <div className="tma-heat-frame">
          <div className="tma-heat__months" aria-hidden="true">
            {months.map((label, i) => (
              <span key={i} className="tma-heat__month">
                {label}
              </span>
            ))}
          </div>
          <div className="tma-heat" role="grid" aria-label={t('today.heatmap.title')}>
            {data.map((d) => (
              <div
                key={d.date}
                className="tma-heat__cell"
                role="gridcell"
                data-level={d.intensity}
                data-count={d.count === 0 ? '0' : `${d.count} reviews`}
                data-date={shortDate(d.date)}
                data-today={d.date === todayIso ? 'true' : undefined}
                aria-label={t('today.heatmap.cell', { date: d.date, count: d.count })}
              />
            ))}
          </div>
          <div className="tma-heat__legend" aria-hidden="true">
            <span>{t('today.heatmap.less')}</span>
            {[0, 22, 45, 70, 100].map((mixPct, lvl) => (
              <span
                key={lvl}
                className="tma-heat__legend-cell"
                style={{
                  background:
                    mixPct === 0
                      ? 'var(--tma-border-soft)'
                      : mixPct === 100
                        ? 'var(--tma-ember-500)'
                        : `color-mix(in oklab, var(--tma-ember-500) ${mixPct}%, var(--tma-border-soft))`,
                }}
              />
            ))}
            <span>{t('today.heatmap.more')}</span>
          </div>
          <div className="tma-heat__stats">
            <div className="tma-heat__stat">
              <span className="tma-heat__stat-k">{t('today.heatmap.stats.total')}</span>
              <span className="tma-heat__stat-v tma-heat__stat-v--accent">{total}</span>
              <span className="tma-heat__stat-s">{t('today.heatmap.stats.totalUnit')}</span>
            </div>
            <div className="tma-heat__stat">
              <span className="tma-heat__stat-k">{t('today.heatmap.stats.active')}</span>
              <span className="tma-heat__stat-v">{activeDays}</span>
              <span className="tma-heat__stat-s">/ {data.length}</span>
            </div>
            {bestDay && bestDay.count > 0 && (
              <div className="tma-heat__stat">
                <span className="tma-heat__stat-k">{t('today.heatmap.stats.best')}</span>
                <span className="tma-heat__stat-v">{bestDay.count}</span>
                <span className="tma-heat__stat-s">{shortDate(bestDay.date)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
