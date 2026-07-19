/**
 * Rendering + state-machine test for `StreakOrb`.
 *
 * The orb is a design primitive owned by `tma-kit.css`; our job is:
 *   1. Emit the right structure (`.tma-orb` root + sheen + glare + num + cap).
 *   2. Compute the correct `data-state` transitions from streak / dueToday.
 * The kit handles all the motion, colour and glare.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { initI18n } from '../../../shared/i18n';
import { StreakOrb } from './StreakOrb';

initI18n();

function state(container: HTMLElement): string | null {
  return container.querySelector('.tma-orb')?.getAttribute('data-state') ?? null;
}

describe('<StreakOrb>', () => {
  test('renders the kit primitive with all four child slots', () => {
    const { container } = render(
      <StreakOrb
        data={{ currentDays: 12, longestDays: 21, goalDays: 30 }}
        dueToday={4}
      />,
    );
    expect(container.querySelector('.tma-orb')).toBeTruthy();
    expect(container.querySelector('.tma-orb__sheen')).toBeTruthy();
    expect(container.querySelector('.tma-orb__glare')).toBeTruthy();
    expect(container.querySelector('.tma-orb__num')).toBeTruthy();
    expect(container.querySelector('.tma-orb__cap')).toBeTruthy();
  });

  test('renders the current streak number', () => {
    render(
      <StreakOrb
        data={{ currentDays: 12, longestDays: 21, goalDays: 30 }}
        dueToday={4}
      />,
    );
    expect(screen.getByText('12')).toBeTruthy();
  });

  test('carries an aria label with the streak count', () => {
    const { container } = render(
      <StreakOrb
        data={{ currentDays: 12, longestDays: 21, goalDays: 30 }}
        dueToday={4}
      />,
    );
    const orb = container.querySelector('.tma-orb');
    expect(orb?.getAttribute('aria-label')).toMatch(/12/);
  });

  test('default state is warm', () => {
    const { container } = render(
      <StreakOrb
        data={{ currentDays: 7, longestDays: 21, goalDays: 30 }}
        dueToday={4}
      />,
    );
    expect(state(container)).toBe('warm');
  });

  test('state = rested when nothing is due', () => {
    const { container } = render(
      <StreakOrb
        data={{ currentDays: 7, longestDays: 21, goalDays: 30 }}
        dueToday={0}
      />,
    );
    expect(state(container)).toBe('rested');
  });

  test('state = celebrate on every 30-day milestone', () => {
    const { container } = render(
      <StreakOrb
        data={{ currentDays: 30, longestDays: 30, goalDays: 30 }}
        dueToday={4}
      />,
    );
    expect(state(container)).toBe('celebrate');
  });
});
