/**
 * Unit tests for `useUpdateReminder`.
 *
 * Optimistic contract — the `['me.user', client]` cache slot flips before the
 * server answers, rolls back on error, and adopts the server row on success.
 * Wire shape: PATCH path params from telegramOwnerParams + a body carrying
 * exactly `{reminder_enabled, reminder_at}`.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import type { MeUser } from './useMeUser';
import { useUpdateReminder } from './useUpdateReminder';

type ApiFn = ReturnType<typeof vi.fn>;

const KEY = ['me.user', 'client-uuid-1'] as const;

function baseUser(overrides: Partial<MeUser> = {}): MeUser {
  return {
    client_uuid: 'client-uuid-1',
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    is_row_invalid: 0,
    invalidation_reason_uuid: null,
    system_user_id: '42',
    system_uuid: '00000000-0000-4000-8000-000000000001',
    username: null,
    full_name: 'Ada',
    timezone: 'UTC',
    reminder_enabled: 1,
    reminder_at: '09:00',
    ...overrides,
  } as MeUser;
}

function makeAuth(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
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
      GET: vi.fn(),
      POST: vi.fn(),
      PUT: vi.fn(),
      PATCH: vi.fn(async () => ({
        data: baseUser({ reminder_enabled: 0, reminder_at: '21:30' }),
        error: undefined,
      })),
      DELETE: vi.fn(),
    } as unknown as AuthContextValue['api'],
    ...overrides,
  };
}

function renderReminder(
  auth: AuthContextValue,
  qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  }),
) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(AuthContext.Provider, { value: auth }, children),
    );
  return { hook: renderHook(() => useUpdateReminder(), { wrapper }), qc };
}

describe('useUpdateReminder', () => {
  test('optimistically flips the cached user before the server answers', async () => {
    const auth = makeAuth();
    (auth.api.PATCH as ApiFn).mockImplementation(() => new Promise(() => {}));
    const { hook, qc } = renderReminder(auth);
    qc.setQueryData(KEY, baseUser());

    act(() => {
      hook.result.current.mutate({ reminder_enabled: 0, reminder_at: '21:30' });
    });

    await waitFor(() => {
      const cached = qc.getQueryData<MeUser>(KEY);
      expect(cached?.reminder_enabled).toBe(0);
      expect(cached?.reminder_at).toBe('21:30');
    });
  });

  test('rolls the cache back on API error', async () => {
    const auth = makeAuth();
    (auth.api.PATCH as ApiFn).mockResolvedValueOnce({
      data: undefined,
      error: { detail: { code: 'COMMON_500', message: 'db down' } },
    });
    const { hook, qc } = renderReminder(auth);
    qc.setQueryData(KEY, baseUser());

    act(() => {
      hook.result.current.mutate({ reminder_enabled: 0, reminder_at: '21:30' });
    });

    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    const cached = qc.getQueryData<MeUser>(KEY);
    expect(cached?.reminder_enabled).toBe(1);
    expect(cached?.reminder_at).toBe('09:00');
  });

  test('sends owner path params and exactly the reminder body', async () => {
    const auth = makeAuth();
    const { hook, qc } = renderReminder(auth);
    qc.setQueryData(KEY, baseUser());

    act(() => {
      hook.result.current.mutate({ reminder_enabled: 0, reminder_at: '07:15' });
    });

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));
    const call = (auth.api.PATCH as ApiFn).mock.calls[0];
    expect(call[0]).toBe('/api/v1/user/{system_uuid}/{system_user_id}');
    expect(call[1].params.path).toEqual({
      system_uuid: '00000000-0000-4000-8000-000000000001',
      system_user_id: '42',
    });
    expect(call[1].body).toEqual({ reminder_enabled: 0, reminder_at: '07:15' });
    // Server row replaces the optimistic guess wholesale.
    expect(qc.getQueryData<MeUser>(KEY)?.reminder_at).toBe('21:30');
  });
});
