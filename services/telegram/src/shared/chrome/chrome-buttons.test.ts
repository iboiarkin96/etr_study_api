/**
 * Unit tests for the three SDK-chrome hooks — BackButton, MainButton and
 * SettingsButton (T-25d). Verifies show/hide toggling by handler
 * presence, click routing through the ref (updates to the handler don't
 * churn the SDK subscription), and cleanup on unmount.
 */

import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { useTelegramBackButton } from './useTelegramBackButton';
import { useTelegramMainButton } from './useTelegramMainButton';
import { useTelegramSettingsButton } from './useTelegramSettingsButton';

type WindowWithTelegram = typeof window & {
  Telegram?: {
    WebApp?: {
      BackButton?: MockButton;
      MainButton?: MockMainButton;
      SettingsButton?: MockButton;
    };
  };
};

type MockButton = {
  show: ReturnType<typeof vi.fn>;
  hide: ReturnType<typeof vi.fn>;
  onClick: ReturnType<typeof vi.fn>;
  offClick: ReturnType<typeof vi.fn>;
  _fire: () => void;
};

type MockMainButton = MockButton & {
  setText: ReturnType<typeof vi.fn>;
};

function makeButton(): MockButton {
  let handler: (() => void) | null = null;
  return {
    show: vi.fn(),
    hide: vi.fn(),
    onClick: vi.fn((cb: () => void) => {
      handler = cb;
    }),
    offClick: vi.fn(() => {
      handler = null;
    }),
    _fire: () => handler?.(),
  };
}

function makeMainButton(): MockMainButton {
  return { ...makeButton(), setText: vi.fn() };
}

function stubSdk(back = makeButton(), main = makeMainButton(), settings = makeButton()) {
  (window as WindowWithTelegram).Telegram = {
    WebApp: { BackButton: back, MainButton: main, SettingsButton: settings },
  };
  return { back, main, settings };
}

afterEach(() => {
  delete (window as WindowWithTelegram).Telegram;
});

describe('useTelegramBackButton', () => {
  test('shows + wires onClick when handler provided; hides on unmount', () => {
    const { back } = stubSdk();
    const handler = vi.fn();
    const { unmount } = renderHook(({ h }: { h: (() => void) | null }) => useTelegramBackButton(h), {
      initialProps: { h: handler },
    });
    expect(back.show).toHaveBeenCalledTimes(1);
    expect(back.onClick).toHaveBeenCalledTimes(1);
    act(() => back._fire());
    expect(handler).toHaveBeenCalledTimes(1);
    unmount();
    expect(back.offClick).toHaveBeenCalledTimes(1);
    expect(back.hide).toHaveBeenCalledTimes(1);
  });

  test('null handler hides the button and does not wire a listener', () => {
    const { back } = stubSdk();
    renderHook(() => useTelegramBackButton(null));
    expect(back.show).not.toHaveBeenCalled();
    expect(back.onClick).not.toHaveBeenCalled();
    expect(back.hide).toHaveBeenCalledTimes(1);
  });

  test('updating handler identity does NOT churn the SDK subscription', () => {
    const { back } = stubSdk();
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ h }: { h: () => void }) => useTelegramBackButton(h), {
      initialProps: { h: first },
    });
    rerender({ h: second });
    expect(back.onClick).toHaveBeenCalledTimes(1); // stayed installed
    act(() => back._fire());
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  test('no-op when SDK is missing', () => {
    expect(() => renderHook(() => useTelegramBackButton(() => {}))).not.toThrow();
  });
});

describe('useTelegramMainButton', () => {
  test('setText + show + onClick, all three, when config provided', () => {
    const { main } = stubSdk();
    const onClick = vi.fn();
    renderHook(() => useTelegramMainButton({ text: 'Start Focus', onClick }));
    expect(main.setText).toHaveBeenCalledWith('Start Focus');
    expect(main.show).toHaveBeenCalledTimes(1);
    expect(main.onClick).toHaveBeenCalledTimes(1);
    act(() => main._fire());
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('text change re-runs setText but does not double-install click', () => {
    const { main } = stubSdk();
    const onClick = vi.fn();
    const { rerender } = renderHook(
      ({ t }: { t: string }) => useTelegramMainButton({ text: t, onClick }),
      { initialProps: { t: 'A' } },
    );
    expect(main.setText).toHaveBeenCalledWith('A');
    rerender({ t: 'B' });
    expect(main.setText).toHaveBeenLastCalledWith('B');
    // Effect re-runs on text change — but click subscription is reinstalled
    // (offClick + onClick) rather than accumulating.
    expect(main.offClick.mock.calls.length).toBe(main.onClick.mock.calls.length - 1);
  });

  test('null config hides the button', () => {
    const { main } = stubSdk();
    renderHook(() => useTelegramMainButton(null));
    expect(main.hide).toHaveBeenCalled();
    expect(main.setText).not.toHaveBeenCalled();
  });
});

describe('useTelegramSettingsButton', () => {
  test('shows + wires + hides on unmount', () => {
    const { settings } = stubSdk();
    const onOpen = vi.fn();
    const { unmount } = renderHook(() => useTelegramSettingsButton(onOpen));
    expect(settings.show).toHaveBeenCalledTimes(1);
    act(() => settings._fire());
    expect(onOpen).toHaveBeenCalledTimes(1);
    unmount();
    expect(settings.hide).toHaveBeenCalledTimes(1);
  });
});
