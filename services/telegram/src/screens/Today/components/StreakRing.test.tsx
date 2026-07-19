/**
 * Rendering + a11y smoke test for `StreakRing`.
 *
 * Verifies the number is on screen, the aria label carries the streak count
 * for screen readers, and the accent arc's `stroke-dashoffset` moves toward
 * zero across a paint tick (the mount-time animation).
 */

import { act, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { initI18n } from '../../../shared/i18n';
import { StreakRing } from './StreakRing';

initI18n();

describe('<StreakRing>', () => {
  test('renders the current streak count and a matching aria label', () => {
    render(<StreakRing data={{ currentDays: 12, longestDays: 21, goalDays: 30 }} />);

    expect(screen.getByText('12')).toBeTruthy();
    const figure = screen.getByRole('figure');
    expect(figure.getAttribute('aria-label')).toMatch(/12/);
  });

  test('renders the goal caption', () => {
    render(<StreakRing data={{ currentDays: 5, longestDays: 5, goalDays: 30 }} />);
    // The caption interpolates «5 / 30 …» in either locale.
    expect(screen.getByText(/5.*30/)).toBeTruthy();
  });

  test('accent arc animates from 0 → target on mount', async () => {
    const { container } = render(
      <StreakRing data={{ currentDays: 30, longestDays: 30, goalDays: 30 }} />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(2);
    const accent = circles[1] as SVGCircleElement;
    // Force the queued rAF callback to fire so state settles synchronously.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    });
    const offset = Number(accent.getAttribute('stroke-dashoffset'));
    // Full goal → offset must have moved off the circumference toward 0.
    const dash = Number(accent.getAttribute('stroke-dasharray'));
    expect(offset).toBeLessThan(dash);
  });
});
