/**
 * Unit tests for `useScheduleSummary`.
 *
 * Mirrors the shape of `useConspectusesDue.test.ts` — the schedule summary
 * hook has the same gate (`enabled` on auth) and the same params (composite
 * `telegramOwnerParams`); the only new invariant is that the hook rejects
 * an empty body (`{data: undefined, error: undefined}`) rather than silently
 * returning `undefined` to the UI.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import { TELEGRAM_SYSTEM_UUID } from '../../../shared/auth/identity';
import { useScheduleSummary } from './useScheduleSummary';

type ApiGet = ReturnType<typeof vi.fn>;

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const apiGet: ApiGet = vi.fn(async () => ({ data: undefined, error: undefined }));
  return {
    status: 'authenticated',
    jwt: 'jwt',
    user: {
      client_uuid: 'client-uuid-1',
      telegram_user_id: 42,
    } as AuthContextValue['user'],
    error: null,
    retry: vi.fn(),
    api: {
      GET: apiGet,
      POST: vi.fn(),
      PUT: vi.fn(),
      PATCH: vi.fn(),
      DELETE: vi.fn(),
    } as unknown as AuthContextValue['api'],
    ...overrides,
  };
}

function renderSummary(auth: AuthContextValue) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(AuthContext.Provider, { value: auth }, children),
    );
  return renderHook(() => useScheduleSummary(), { wrapper });
}

describe('useScheduleSummary', () => {
  test('stays idle until auth is `authenticated`', async () => {
    const auth = makeAuth({ status: 'authenticating', user: null });
    const { result } = renderSummary(auth);
    expect(result.current.fetchStatus).toBe('idle');
    expect(auth.api.GET).not.toHaveBeenCalled();
  });

  test('forwards telegramOwnerParams and returns the summary body', async () => {
    const summary = {
      due_now: 2,
      due_next_24h: 4,
      total: 8,
      by_slot: { A: 2, B: 2, C: 2, D: 2 },
      computed_at: '2026-07-19T02:30:00Z',
    };
    const auth = makeAuth();
    (auth.api.GET as ApiGet).mockResolvedValueOnce({ data: summary, error: undefined });

    const { result } = renderSummary(auth);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(auth.api.GET).toHaveBeenCalledWith(
      '/api/v1/schedule/summary',
      expect.objectContaining({
        params: {
          query: { system_user_id: '42', system_uuid: TELEGRAM_SYSTEM_UUID },
        },
      }),
    );
    expect(result.current.data).toEqual(summary);
  });

  test('rejects when the server returns an empty body', async () => {
    const auth = makeAuth();
    // Both `data` and `error` are undefined — treated as a contract violation.
    (auth.api.GET as ApiGet).mockResolvedValueOnce({ data: undefined, error: undefined });

    const { result } = renderSummary(auth);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toContain('schedule/summary');
  });

  test('surfaces API errors as thrown query errors', async () => {
    const auth = makeAuth();
    (auth.api.GET as ApiGet).mockResolvedValueOnce({
      data: undefined,
      error: { detail: { code: 'COMMON_500', message: 'boom' } },
    });

    const { result } = renderSummary(auth);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toContain('schedule/summary failed');
  });
});
