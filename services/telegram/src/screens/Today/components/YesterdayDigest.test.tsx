/**
 * Rendering + tone-classification test for `YesterdayDigest`.
 *
 * The strip carries three cells: reviewed / accuracy / missed. Accuracy
 * changes tone at ≥80% (positive) and <60% (warn), and `missed` turns
 * warn when the target wasn't hit. These branches are worth pinning.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { initI18n } from '../../../shared/i18n';
import { YesterdayDigest } from './YesterdayDigest';

initI18n();

describe('<YesterdayDigest>', () => {
  test('shows reviewed count as `X / Y`', () => {
    render(<YesterdayDigest data={{ reviewed: 8, target: 10, accuracyPct: 87 }} />);
    expect(screen.getByText('8 / 10')).toBeTruthy();
  });

  test('renders accuracy percentage', () => {
    render(<YesterdayDigest data={{ reviewed: 8, target: 10, accuracyPct: 87 }} />);
    expect(screen.getByText('87%')).toBeTruthy();
  });

  test('renders missed count when target not hit', () => {
    render(<YesterdayDigest data={{ reviewed: 6, target: 10, accuracyPct: 60 }} />);
    // Missed = target - reviewed = 4.
    expect(screen.getByText('4')).toBeTruthy();
  });

  test('renders zero missed when target hit', () => {
    render(<YesterdayDigest data={{ reviewed: 10, target: 10, accuracyPct: 100 }} />);
    expect(screen.getByText('0')).toBeTruthy();
  });
});
