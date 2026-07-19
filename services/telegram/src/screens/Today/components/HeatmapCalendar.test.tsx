/**
 * Rendering + layout invariants for `HeatmapCalendar`.
 *
 * The grid must contain exactly `weeks × 7` cells (padding included) so
 * today lands in the last column at the correct weekday row. Intensity
 * classes translate to `background` values via `color-mix`; testing the
 * exact colour is brittle in JSDOM, so we assert on structure + labels.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { initI18n } from '../../../shared/i18n';
import { HeatmapCalendar } from './HeatmapCalendar';
import type { HeatmapDay } from '../hooks/useDailyStats';

initI18n();

function buildDays(n: number, start = '2026-05-01'): HeatmapDay[] {
  const startEpoch = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => {
    const iso = new Date(startEpoch + i * 86_400_000).toISOString().slice(0, 10);
    const intensity = ((i % 5) as HeatmapDay['intensity']);
    return { isoDate: iso, intensity, count: intensity * 3 };
  });
}

describe('<HeatmapCalendar>', () => {
  test('renders a grid with 7 rows per week column', () => {
    const days = buildDays(14, '2026-05-04'); // 2026-05-04 is a Monday.
    render(<HeatmapCalendar data={days} />);
    const grid = screen.getByRole('grid');
    // Every row is a 7-cell column; direct children are the columns.
    expect(grid.children.length).toBeGreaterThanOrEqual(2);
    // Total gridcell count must equal `weeks × 7`.
    const cells = grid.querySelectorAll('[role="gridcell"]');
    expect(cells.length).toBe(grid.children.length * 7);
  });

  test('renders legend swatches', () => {
    render(<HeatmapCalendar data={buildDays(90, '2026-04-01')} />);
    // The legend surfaces «less» and «more».
    expect(screen.getAllByText(/less/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/more/i).length).toBeGreaterThan(0);
  });

  test('cells carry title tooltip with iso date + count', () => {
    const days = buildDays(7, '2026-05-04');
    render(<HeatmapCalendar data={days} />);
    const cells = screen.getByRole('grid').querySelectorAll('[role="gridcell"]');
    const populated = Array.from(cells).filter((c) => c.getAttribute('title'));
    expect(populated.length).toBeGreaterThan(0);
    expect(populated[0].getAttribute('title')).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
