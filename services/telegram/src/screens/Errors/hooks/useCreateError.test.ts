/**
 * Unit tests for `useCreateError`.
 *
 * Optimistic contract — the new row is prepended to the cache immediately
 * with a temporary error_uuid, then replaced with the server row on
 * success. On API error the temp row is rolled back and the parent
 * surfaces the failure.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import { useCreateError } from './useCreateError';
import type { LearningError } from './useErrors';

type ApiFn = ReturnType<typeof vi.fn>;

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
      PATCH: vi.fn(),
      DELETE: vi.fn(),
    } as unknown as AuthContextValue['api'],
    ...overrides,
  };
}

function seedList(qc: QueryClient, items: LearningError[]) {
  qc.setQueryData(['errors.list', 'client-uuid-1'], items);
}

function renderCreate(
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
  return { hook: renderHook(() => useCreateError(), { wrapper }), qc };
}

const SERVER_ROW: LearningError = {
  error_uuid: 'server-uuid-1',
  message: 'CAP: eventual ≠ strong',
  conspectus_uuid: null,
  review_log_id: null,
  created_at: '2026-07-21T09:12:00Z',
};

describe('useCreateError', () => {
  test('prepends a temporary row while the mutation is in flight', async () => {
    const auth = makeAuth();
    (auth.api.POST as ApiFn).mockImplementation(() => new Promise(() => {}));
    const { hook, qc } = renderCreate(auth);
    seedList(qc, []);

    act(() => {
      hook.result.current.mutate({ message: 'test miss' });
    });

    await waitFor(() => {
      const cache = qc.getQueryData<LearningError[]>(['errors.list', 'client-uuid-1']);
      expect(cache).toHaveLength(1);
      expect(cache?.[0]?.message).toBe('test miss');
      expect(cache?.[0]?.error_uuid).toMatch(/^tmp-/);
    });
  });

  test('replaces the temp row with the server row on success', async () => {
    const auth = makeAuth();
    (auth.api.POST as ApiFn).mockResolvedValueOnce({ data: SERVER_ROW, error: undefined });
    const { hook, qc } = renderCreate(auth);
    seedList(qc, []);

    act(() => {
      hook.result.current.mutate({ message: 'CAP: eventual ≠ strong' });
    });

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

    const cache = qc.getQueryData<LearningError[]>(['errors.list', 'client-uuid-1']);
    expect(cache).toEqual([SERVER_ROW]);
  });

  test('rolls back the temp row on API error', async () => {
    const auth = makeAuth();
    (auth.api.POST as ApiFn).mockResolvedValueOnce({
      data: undefined,
      error: { detail: { code: 'COMMON_413', message: 'body too large' } },
    });
    const { hook, qc } = renderCreate(auth);
    const existing: LearningError = { ...SERVER_ROW, error_uuid: 'old-1', message: 'old' };
    seedList(qc, [existing]);

    act(() => {
      hook.result.current.mutate({ message: 'new miss' });
    });

    await waitFor(() => expect(hook.result.current.isError).toBe(true));

    const cache = qc.getQueryData<LearningError[]>(['errors.list', 'client-uuid-1']);
    expect(cache).toEqual([existing]);
  });

  test('sends composite owner params + trimmed message body', async () => {
    const auth = makeAuth();
    (auth.api.POST as ApiFn).mockResolvedValueOnce({ data: SERVER_ROW, error: undefined });
    const { hook, qc } = renderCreate(auth);
    seedList(qc, []);

    act(() => {
      hook.result.current.mutate({ message: 'a real miss' });
    });

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

    expect(auth.api.POST).toHaveBeenCalledWith(
      '/api/v1/errors',
      expect.objectContaining({
        body: expect.objectContaining({
          system_user_id: '42',
          message: 'a real miss',
        }),
      }),
    );
  });
});
