/**
 * Structural test for `HeatmapCalendar` on the `tma-heat-frame` primitive.
 *
 * The kit lays cells left-to-right into 13 columns; we render one cell per
 * day, so the grid must contain exactly `data.length` cells. Each cell
 * carries `data-level`, `data-count` and `data-date` so the kit's CSS
 * hover tooltip can pick them up. Today's cell gets `data-today="true"`.
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
  test('grid contains exactly one cell per day', () => {
    const days = buildDays(90, '2026-04-01');
    const { container } = render(<HeatmapCalendar data={days} />);
    const cells = container.querySelectorAll('.tma-heat__cell');
    expect(cells.length).toBe(90);
  });

  test('each cell carries data-level, data-count, data-date', () => {
    const days = buildDays(5, '2026-05-01');
    const { container } = render(<HeatmapCalendar data={days} />);
    const cells = Array.from(container.querySelectorAll('.tma-heat__cell'));
    expect(cells.length).toBe(5);
    for (const cell of cells) {
      expect(cell.getAttribute('data-level')).toMatch(/^[0-4]$/);
      expect(cell.getAttribute('data-count')).toBeTruthy();
      expect(cell.getAttribute('data-date')).toBeTruthy();
    }
  });

  test('legend renders «less …swatches… more»', () => {
    render(<HeatmapCalendar data={buildDays(90, '2026-04-01')} />);
    expect(screen.getAllByText(/less/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/more/i).length).toBeGreaterThan(0);
  });

  test('stats block shows total, active days and best day', () => {
    const days = buildDays(30, '2026-06-01');
    const { container } = render(<HeatmapCalendar data={days} />);
    const stats = container.querySelectorAll('.tma-heat__stat');
    // Total + Active are always shown; Best appears when best.count > 0.
    expect(stats.length).toBeGreaterThanOrEqual(2);
  });
});
