/**
 * Unit tests for the toast primitive (T-26a). Covers push / render /
 * auto-dismiss / manual dismiss / MAX_STACK truncation / action wiring /
 * error surfaced when called outside provider.
 */

import { act, render, renderHook, screen } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { ToastProvider, Toaster, useToast, type ToastInput } from './toast';

function withProvider({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      {children}
      <Toaster />
    </ToastProvider>
  );
}

/** Test helper — pushes exactly one toast on mount. Kept out of any
 *  callsite render path (so calling `toast()` inside a body would tripwire
 *  React's «no state updates during render» rule). */
function OneShotToast(props: ToastInput) {
  const { toast } = useToast();
  useEffect(() => {
    toast(props);
    // Intentionally single-shot — props changing during a test would
    // re-push a duplicate and confuse the auto-dismiss timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toast primitive', () => {
  test('render + auto-dismiss on default 4 s timeout', async () => {
    render(withProvider({ children: <OneShotToast message="hello world" /> }));
    expect(screen.getByText('hello world')).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.queryByText('hello world')).toBeNull();
  });

  test('durationMs override honoured', async () => {
    render(
      withProvider({
        children: <OneShotToast message="fast toast" durationMs={1_000} />,
      }),
    );
    expect(screen.getByText('fast toast')).toBeDefined();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(screen.queryByText('fast toast')).toBeNull();
  });

  test('durationMs=0 keeps the toast open until manual dismiss', () => {
    render(
      withProvider({
        children: <OneShotToast message="sticky" durationMs={0} />,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.getByText('sticky')).toBeDefined();
  });

  test('action fires + dismisses', async () => {
    const onAction = vi.fn();
    render(
      withProvider({
        children: (
          <OneShotToast
            message="undo me"
            durationMs={0}
            action={{ label: 'Undo', onAction }}
          />
        ),
      }),
    );
    const btn = screen.getByRole('button', { name: 'Undo' });
    act(() => {
      btn.click();
    });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('undo me')).toBeNull();
  });

  test('MAX_STACK — 4th push drops the oldest', () => {
    const { result } = renderHook(() => useToast(), { wrapper: withProvider });
    act(() => {
      result.current.toast({ message: 'a', durationMs: 0 });
      result.current.toast({ message: 'b', durationMs: 0 });
      result.current.toast({ message: 'c', durationMs: 0 });
      result.current.toast({ message: 'd', durationMs: 0 });
    });
    expect(result.current.toasts.map((t) => t.message)).toEqual(['b', 'c', 'd']);
  });

  test('useToast() outside provider throws', () => {
    expect(() =>
      renderHook(() => useToast()),
    ).toThrow(/inside a <ToastProvider>/);
  });

  test('tone: error → role=status aria-live=assertive', () => {
    render(
      withProvider({
        children: <OneShotToast message="boom" tone="error" durationMs={0} />,
      }),
    );
    const status = screen.getByRole('status');
    expect(status.getAttribute('aria-live')).toBe('assertive');
  });
});
