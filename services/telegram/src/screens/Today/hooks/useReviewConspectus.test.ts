/**
 * Unit tests for `useReviewConspectus`.
 *
 * Pessimistic contract — the mutation keeps the row in the due-list cache
 * until the server accepts it, then removes the row and invalidates the
 * dependent surfaces. On error the row is left untouched (parent surfaces
 * the failure).
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import type { DueConspectus } from './useConspectusesDue';
import { useReviewConspectus } from './useReviewConspectus';

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
      POST: vi.fn(async () => ({ data: { conspectus_uuid: 'a' }, error: undefined })),
      PUT: vi.fn(),
      PATCH: vi.fn(),
      DELETE: vi.fn(),
    } as unknown as AuthContextValue['api'],
    ...overrides,
  };
}

function seedDueCache(qc: QueryClient, items: Partial<DueConspectus>[]) {
  qc.setQueryData(
    ['today.conspectuses.due', 'client-uuid-1'],
    items as DueConspectus[],
  );
}

function renderReview(auth: AuthContextValue, qc = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(AuthContext.Provider, { value: auth }, children),
    );
  return { hook: renderHook(() => useReviewConspectus(), { wrapper }), qc };
}

describe('useReviewConspectus', () => {
  test('keeps the row in the due-list cache while the mutation is in flight', async () => {
    const auth = makeAuth();
    (auth.api.POST as ApiFn).mockImplementation(
      () => new Promise(() => {}),
    );
    const { hook, qc } = renderReview(auth);
    seedDueCache(qc, [
      { conspectus_uuid: 'a', title: 'A' },
      { conspectus_uuid: 'b', title: 'B' },
    ]);

    act(() => {
      hook.result.current.mutate({ conspectus_uuid: 'a', tag: 'easy' });
    });

    // Give React a beat, then assert nothing was removed pre-response.
    await new Promise((r) => setTimeout(r, 10));
    const cache = qc.getQueryData<DueConspectus[]>([
      'today.conspectuses.due',
      'client-uuid-1',
    ]);
    expect(cache?.map((c) => c.conspectus_uuid)).toEqual(['a', 'b']);
  });

  test('leaves the due-list cache untouched on API error', async () => {
    const auth = makeAuth();
    (auth.api.POST as ApiFn).mockResolvedValueOnce({
      data: undefined,
      error: { detail: { code: 'COMMON_409', message: 'schedule revision conflict' } },
    });
    const { hook, qc } = renderReview(auth);
    seedDueCache(qc, [
      { conspectus_uuid: 'a', title: 'A' },
      { conspectus_uuid: 'b', title: 'B' },
    ]);

    act(() => {
      hook.result.current.mutate({ conspectus_uuid: 'a', tag: 'hard' });
    });

    await waitFor(() => expect(hook.result.current.isError).toBe(true));

    const cache = qc.getQueryData<DueConspectus[]>([
      'today.conspectuses.due',
      'client-uuid-1',
    ]);
    expect(cache?.map((c) => c.conspectus_uuid)).toEqual(['a', 'b']);
  });

  test('removes only the reviewed row on success and invalidates dependent queries with the full 3-tuple history key', async () => {
    const auth = makeAuth();
    (auth.api.POST as ApiFn).mockResolvedValueOnce({
      data: { conspectus_uuid: 'a' },
      error: undefined,
    });
    const { hook, qc } = renderReview(auth);
    seedDueCache(qc, [
      { conspectus_uuid: 'a', title: 'A' },
      { conspectus_uuid: 'b', title: 'B' },
    ]);
    const spy = vi.spyOn(qc, 'invalidateQueries');

    act(() => {
      hook.result.current.mutate({ conspectus_uuid: 'a', tag: 'easy' });
    });

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

    const cache = qc.getQueryData<DueConspectus[]>([
      'today.conspectuses.due',
      'client-uuid-1',
    ]);
    expect(cache?.map((c) => c.conspectus_uuid)).toEqual(['b']);

    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    // Full-tuple assertions — a regression that drops clientUuid would fail.
    expect(keys).toContainEqual(['today.schedule.summary', 'client-uuid-1']);
    expect(keys).toContainEqual(['me.stats', 'client-uuid-1']);
    expect(keys).toContainEqual(['schedule.history', 'client-uuid-1', 90]);
  });

  test('sends tag + composite owner params in the request body', async () => {
    const auth = makeAuth();
    (auth.api.POST as ApiFn).mockResolvedValueOnce({
      data: { conspectus_uuid: 'a' },
      error: undefined,
    });
    const { hook, qc } = renderReview(auth);
    seedDueCache(qc, [{ conspectus_uuid: 'a' }]);

    act(() => {
      hook.result.current.mutate({
        conspectus_uuid: 'a',
        tag: 'forgot',
        expected_schedule_revision: 7,
      });
    });

    await waitFor(() => expect(hook.result.current.isSuccess).toBe(true));

    expect(auth.api.POST).toHaveBeenCalledWith(
      '/api/v1/conspectuses/{conspectus_uuid}/actions/review',
      expect.objectContaining({
        params: { path: { conspectus_uuid: 'a' } },
        body: expect.objectContaining({
          tag: 'forgot',
          system_user_id: '42',
          expected_schedule_revision: 7,
        }),
      }),
    );
  });
});
