/**
 * Unit tests for `useConspectusesDue`.
 *
 * The hook itself is thin — it delegates to the typed API client, so we
 * verify the two things a screen actually depends on:
 *   1. it is disabled until auth reaches `authenticated` (no premature fetch);
 *   2. it forwards the composite `(system_user_id, system_uuid)` params
 *      built by `telegramOwnerParams`, and it surfaces the raw
 *      `ConspectusResponse[]` on success / raises on error.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import { TELEGRAM_SYSTEM_UUID } from '../../../shared/auth/identity';
import { useConspectusesDue } from './useConspectusesDue';

type ApiGet = ReturnType<typeof vi.fn>;

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const apiGet: ApiGet = vi.fn(async () => ({ data: [], error: undefined }));
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

function renderDue(auth: AuthContextValue) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(AuthContext.Provider, { value: auth }, children),
    );
  return renderHook(() => useConspectusesDue(), { wrapper });
}

describe('useConspectusesDue', () => {
  test('does not fire until auth is `authenticated`', async () => {
    const auth = makeAuth({ status: 'authenticating', user: null });
    const { result } = renderDue(auth);
    // fetchStatus stays `idle` for a disabled query — nothing on the wire.
    expect(result.current.fetchStatus).toBe('idle');
    expect(auth.api.GET).not.toHaveBeenCalled();
  });

  test('forwards telegramOwnerParams and returns the fetched array', async () => {
    const cards = [{ conspectus_uuid: 'dev-seed-a1', title: 'X' }];
    const auth = makeAuth();
    (auth.api.GET as ApiGet).mockResolvedValueOnce({ data: cards, error: undefined });

    const { result } = renderDue(auth);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(auth.api.GET).toHaveBeenCalledWith(
      '/api/v1/conspectuses/due',
      expect.objectContaining({
        params: {
          query: { system_user_id: '42', system_uuid: TELEGRAM_SYSTEM_UUID },
        },
      }),
    );
    expect(result.current.data).toEqual(cards);
  });

  test('surfaces API errors so screens can render the error state', async () => {
    const auth = makeAuth();
    (auth.api.GET as ApiGet).mockResolvedValueOnce({
      data: undefined,
      error: { detail: { code: 'COMMON_500', message: 'boom' } },
    });

    const { result } = renderDue(auth);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toContain('conspectuses/due failed');
  });
});
