/**
 * Unit tests for the haptic vocabulary — verify every tone maps to the
 * right Telegram SDK call, and that a missing / throwing SDK is silent.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';

import { haptic } from './haptics';

type WindowWithTelegram = typeof window & {
  Telegram?: {
    WebApp?: {
      HapticFeedback?: {
        impactOccurred?: (style: 'light' | 'medium' | 'heavy') => void;
        notificationOccurred?: (type: 'success' | 'warning' | 'error') => void;
        selectionChanged?: () => void;
      };
    };
  };
};

function stubSdk() {
  const impactOccurred = vi.fn();
  const notificationOccurred = vi.fn();
  const selectionChanged = vi.fn();
  (window as WindowWithTelegram).Telegram = {
    WebApp: { HapticFeedback: { impactOccurred, notificationOccurred, selectionChanged } },
  };
  return { impactOccurred, notificationOccurred, selectionChanged };
}

afterEach(() => {
  delete (window as WindowWithTelegram).Telegram;
});

describe('haptic()', () => {
  test('selection → selectionChanged()', () => {
    const sdk = stubSdk();
    haptic('selection');
    expect(sdk.selectionChanged).toHaveBeenCalledTimes(1);
    expect(sdk.impactOccurred).not.toHaveBeenCalled();
    expect(sdk.notificationOccurred).not.toHaveBeenCalled();
  });

  test.each([
    ['impactLight', 'light'],
    ['impactMedium', 'medium'],
    ['impactHeavy', 'heavy'],
  ] as const)('%s → impactOccurred(%s)', (tone, style) => {
    const sdk = stubSdk();
    haptic(tone);
    expect(sdk.impactOccurred).toHaveBeenCalledWith(style);
  });

  test.each([
    ['notifySuccess', 'success'],
    ['notifyWarning', 'warning'],
    ['notifyError', 'error'],
  ] as const)('%s → notificationOccurred(%s)', (tone, type) => {
    const sdk = stubSdk();
    haptic(tone);
    expect(sdk.notificationOccurred).toHaveBeenCalledWith(type);
  });

  test('no SDK present → no-op, no throw', () => {
    expect(() => haptic('impactMedium')).not.toThrow();
  });

  test('SDK method throws → swallowed', () => {
    (window as WindowWithTelegram).Telegram = {
      WebApp: {
        HapticFeedback: {
          impactOccurred: () => {
            throw new Error('WebView bug');
          },
          notificationOccurred: () => {},
          selectionChanged: () => {},
        },
      },
    };
    expect(() => haptic('impactMedium')).not.toThrow();
  });
});
