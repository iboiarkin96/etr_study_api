/**
 * Rendering + tone-classification test for `YesterdayDigest`.
 *
 * The strip is now a single `.tma-digest` row (icon + main text). The icon
 * carries a `data-tone` attribute that flips at ≥80% (success) and <60%
 * (danger); the summary text interpolates reviewed / target / accuracy /
 * missed. Verifying attribute + presence gives us the meaningful
 * invariants without pinning exact copy.
 */

import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { initI18n } from '../../../shared/i18n';
import { YesterdayDigest } from './YesterdayDigest';

initI18n();

function iconTone(container: HTMLElement): string | null {
  const icon = container.querySelector('.tma-digest__icon');
  return icon?.getAttribute('data-tone') ?? null;
}

describe('<YesterdayDigest>', () => {
  test('renders the digest structure', () => {
    const { container } = render(
      <YesterdayDigest data={{ reviewed: 8, target: 10, accuracy_pct: 87, missed: 2 }} />,
    );
    expect(container.querySelector('.tma-digest')).toBeTruthy();
    expect(container.querySelector('.tma-digest__icon')).toBeTruthy();
    expect(container.querySelector('.tma-digest__title')).toBeTruthy();
    expect(container.querySelector('.tma-digest__sub')).toBeTruthy();
  });

  test('summary carries the interpolated numbers', () => {
    const { container } = render(
      <YesterdayDigest data={{ reviewed: 8, target: 10, accuracy_pct: 87, missed: 2 }} />,
    );
    const sub = container.querySelector('.tma-digest__sub')?.textContent ?? '';
    expect(sub).toMatch(/8/);
    expect(sub).toMatch(/10/);
    expect(sub).toMatch(/87/);
    expect(sub).toMatch(/2/); // missed = 10 - 8
  });

  test('icon tone flips to success at high accuracy', () => {
    const { container } = render(
      <YesterdayDigest data={{ reviewed: 9, target: 10, accuracy_pct: 95, missed: 1 }} />,
    );
    expect(iconTone(container)).toBe('success');
  });

  test('icon tone falls to warn between 60% and 80%', () => {
    const { container } = render(
      <YesterdayDigest data={{ reviewed: 7, target: 10, accuracy_pct: 70, missed: 3 }} />,
    );
    expect(iconTone(container)).toBe('warn');
  });

  test('icon tone falls to danger below 60%', () => {
    const { container } = render(
      <YesterdayDigest data={{ reviewed: 4, target: 10, accuracy_pct: 40, missed: 6 }} />,
    );
    expect(iconTone(container)).toBe('danger');
  });
});
