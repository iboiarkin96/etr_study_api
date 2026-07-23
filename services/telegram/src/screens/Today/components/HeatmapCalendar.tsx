/**
 * 90-day heat-map — GitHub-contribution-style grid.
 *
 * Layout: columns = weeks, rows = days of the week (Mon top → Sun bottom).
 * The kit's `.tma-heat` primitive uses `grid-auto-flow: column`, so cells
 * pushed in chronological order automatically stack top-to-bottom per week
 * before advancing to the next week to the right.
 *
 * Padding: leading empties for the first week (so Monday sits at the top),
 * trailing empties for the last week (so Sunday sits at the bottom). Month
 * labels above the grid appear once per month change.
 *
 * Data source: `useScheduleHistory` → `GET /api/v1/schedule/history?days=N`.
 */

import { useTranslation } from 'react-i18next';

import type { components } from '../../../shared/api/schema';

type HeatmapDay = components['schemas']['HistoryDay'];

type Props = { data: HeatmapDay[] };

const MONTH_LABEL_INTL = new Intl.DateTimeFormat(undefined, { month: 'short' });

/** Convert JS getDay() (Sun=0..Sat=6) to a Mon-first index (Mon=0..Sun=6). */
function monWeekday(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(`${iso}T00:00:00Z`),
  );
}

export function HeatmapCalendar({ data }: Props) {
  const { t } = useTranslation();
  const todayIso = new Date().toISOString().slice(0, 10);

  const layout = buildLayout(data);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const activeDays = data.filter((d) => d.count > 0).length;
  const bestDay = data.reduce<HeatmapDay | null>(
    (best, d) => (!best || d.count > best.count ? d : best),
    null,
  );

  return (
    <section className="tma-section" aria-labelledby="heatmap-h">
      <div
        className="tma-section__header tma-tip tma-tip--below"
        id="heatmap-h"
        data-tip={t('today.heatmap.tip')}
      >
        {t('today.heatmap.title')}
      </div>
      <div className="tma-section__plate tma-section__plate--overflow">
        <div
          className="tma-heat-frame"
          style={{ ['--tma-heat-week-count' as string]: layout.weekCount }}
        >
          <div className="tma-heat__months" aria-hidden="true">
            {layout.monthLabels.map((label, i) => (
              <span key={i} className="tma-heat__month">
                {label}
              </span>
            ))}
          </div>
          {/* Non-interactive visualization: `role="img"` + one summary label.
            * A `grid` role would demand row/gridcell structure and per-cell
            * focus semantics the surface doesn't have; the textual stats
            * below carry the same data for screen-reader users. */}
          <div
            className="tma-heat"
            role="img"
            aria-label={t('today.heatmap.aria', { days: data.length, total })}
          >
            {layout.cells.map((cell, i) =>
              cell === null ? (
                <div key={`pad-${i}`} aria-hidden="true" style={{ visibility: 'hidden' }} />
              ) : (
                <div
                  key={cell.date}
                  className="tma-heat__cell"
                  aria-hidden="true"
                  data-level={cell.intensity}
                  data-count={t('today.heatmap.cellCount', { count: cell.count })}
                  data-date={shortDate(cell.date)}
                  data-today={cell.date === todayIso ? 'true' : undefined}
                />
              ),
            )}
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
            <div
              className="tma-heat__stat tma-tip"
              data-tip={t('today.heatmap.stats.totalTip')}
            >
              <span className="tma-heat__stat-k">{t('today.heatmap.stats.total')}</span>
              <span className="tma-heat__stat-v tma-heat__stat-v--accent">{total}</span>
              <span className="tma-heat__stat-s">{t('today.heatmap.stats.totalUnit')}</span>
            </div>
            <div
              className="tma-heat__stat tma-tip"
              data-tip={t('today.heatmap.stats.activeTip', { total: data.length })}
            >
              <span className="tma-heat__stat-k">{t('today.heatmap.stats.active')}</span>
              <span className="tma-heat__stat-v">{activeDays}</span>
              <span className="tma-heat__stat-s">/ {data.length}</span>
            </div>
            {bestDay && bestDay.count > 0 && (
              <div
                className="tma-heat__stat tma-tip"
                data-tip={t('today.heatmap.stats.bestTip')}
              >
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

type CellSlot = HeatmapDay | null;

type Layout = {
  cells: CellSlot[];
  weekCount: number;
  monthLabels: string[];
};

/**
 * Build a column-first layout: leading nulls to push the first day into its
 * correct weekday row, trailing nulls to complete the last column, and one
 * month label per column (blank when the month hasn't changed since the
 * previous column, so the header reads left-to-right as a rare stamp).
 */
function buildLayout(data: HeatmapDay[]): Layout {
  if (data.length === 0) {
    return { cells: [], weekCount: 0, monthLabels: [] };
  }
  const leadingPad = monWeekday(data[0].date);
  const trailingPad = 6 - monWeekday(data[data.length - 1].date);
  const cells: CellSlot[] = [
    ...Array.from({ length: leadingPad }, () => null),
    ...data,
    ...Array.from({ length: trailingPad }, () => null),
  ];
  const weekCount = cells.length / 7;

  const monthLabels: string[] = [];
  let prev = '';
  for (let w = 0; w < weekCount; w++) {
    // Anchor month by the *earliest real day* in this column so partial
    // leading/trailing columns don't produce a blank label.
    let label = '';
    for (let r = 0; r < 7; r++) {
      const cell = cells[w * 7 + r];
      if (cell) {
        label = MONTH_LABEL_INTL.format(new Date(`${cell.date}T00:00:00Z`));
        break;
      }
    }
    monthLabels.push(label === prev ? '' : label);
    if (label) prev = label;
  }

  return { cells, weekCount, monthLabels };
}
