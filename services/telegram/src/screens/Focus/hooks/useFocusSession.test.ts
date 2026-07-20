/**
 * Unit tests for `useFocusSession`.
 *
 * Verifies the state machine (phase transitions), the grade→tag mapping,
 * per-tag/per-grade summary accumulation, and cap enforcement.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import type { DueConspectus } from '../../Today/hooks/useConspectusesDue';
import {
  GRADE_TO_TAG,
  SESSION_CAP,
  useFocusSession,
} from './useFocusSession';

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
      GET: vi.fn(async () => ({ data: [], error: undefined })),
      POST: vi.fn(async () => ({ data: undefined, error: undefined })),
      PUT: vi.fn(),
      PATCH: vi.fn(),
      DELETE: vi.fn(),
    } as unknown as AuthContextValue['api'],
    ...overrides,
  };
}

function seed(auth: AuthContextValue, items: Partial<DueConspectus>[]) {
  (auth.api.GET as ApiFn).mockResolvedValue({ data: items, error: undefined });
}

function renderSession(auth: AuthContextValue) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: qc },
      createElement(AuthContext.Provider, { value: auth }, children),
    );
  return { hook: renderHook(() => useFocusSession(), { wrapper }), qc };
}

describe('useFocusSession · state machine', () => {
  test('phase = loading before any data lands', async () => {
    const auth = makeAuth();
    (auth.api.GET as ApiFn).mockImplementation(() => new Promise(() => {}));
    const { hook } = renderSession(auth);
    expect(hook.result.current.phase).toBe('loading');
  });

  test('phase = empty when the queue is empty', async () => {
    const auth = makeAuth();
    seed(auth, []);
    const { hook } = renderSession(auth);
    await waitFor(() => expect(hook.result.current.phase).toBe('empty'));
  });

  test('phase = prompt → revealed → grading → next → complete', async () => {
    const auth = makeAuth();
    seed(auth, [
      { conspectus_uuid: 'a', title: 'A', schedule_revision: 1 },
      { conspectus_uuid: 'b', title: 'B', schedule_revision: 1 },
    ]);
    (auth.api.POST as ApiFn).mockResolvedValue({
      data: { conspectus_uuid: 'a', next_review_at: '2026-07-25T10:00:00Z' },
      error: undefined,
    });

    const { hook } = renderSession(auth);
    await waitFor(() => expect(hook.result.current.phase).toBe('prompt'));
    expect(hook.result.current.current?.conspectus_uuid).toBe('a');
    expect(hook.result.current.total).toBe(2);

    act(() => hook.result.current.reveal());
    expect(hook.result.current.phase).toBe('revealed');

    act(() => hook.result.current.grade('good'));

    await waitFor(() => expect(hook.result.current.current?.conspectus_uuid).toBe('b'));
    expect(hook.result.current.phase).toBe('prompt'); // fresh card
    expect(hook.result.current.index).toBe(1);

    act(() => hook.result.current.reveal());
    act(() => hook.result.current.grade('easy'));

    await waitFor(() => expect(hook.result.current.phase).toBe('complete'));
    expect(hook.result.current.summary.graded).toBe(2);
  });
});

describe('useFocusSession · grade mapping', () => {
  test('again → forgot, hard → hard, good → hard, easy → easy', () => {
    expect(GRADE_TO_TAG.again).toBe('forgot');
    expect(GRADE_TO_TAG.hard).toBe('hard');
    expect(GRADE_TO_TAG.good).toBe('hard');
    expect(GRADE_TO_TAG.easy).toBe('easy');
  });

  test('summary accumulates per-grade AND per-tag (good and hard both land on tag=hard)', async () => {
    const auth = makeAuth();
    seed(auth, [
      { conspectus_uuid: 'a', title: 'A', schedule_revision: 1 },
      { conspectus_uuid: 'b', title: 'B', schedule_revision: 1 },
      { conspectus_uuid: 'c', title: 'C', schedule_revision: 1 },
    ]);
    (auth.api.POST as ApiFn).mockResolvedValue({
      data: { conspectus_uuid: 'x', next_review_at: '2026-07-25T10:00:00Z' },
      error: undefined,
    });

    const { hook } = renderSession(auth);
    await waitFor(() => expect(hook.result.current.phase).toBe('prompt'));

    for (const g of ['good', 'hard', 'easy'] as const) {
      act(() => hook.result.current.reveal());
      act(() => hook.result.current.grade(g));
      await waitFor(() =>
        expect(hook.result.current.summary.perGrade[g]).toBeGreaterThan(0),
      );
    }

    expect(hook.result.current.summary.perGrade.good).toBe(1);
    expect(hook.result.current.summary.perGrade.hard).toBe(1);
    expect(hook.result.current.summary.perGrade.easy).toBe(1);
    // good and hard both collapse to tag=hard → tag counter is 2, easy=1.
    expect(hook.result.current.summary.perTag.hard).toBe(2);
    expect(hook.result.current.summary.perTag.easy).toBe(1);
    expect(hook.result.current.summary.perTag.forgot).toBe(0);
  });
});

describe('useFocusSession · session cap', () => {
  test('queue is capped at SESSION_CAP (20)', async () => {
    const auth = makeAuth();
    seed(auth, Array.from({ length: 40 }, (_, i) => ({
      conspectus_uuid: `c-${i}`,
      title: `Card ${i}`,
      schedule_revision: 1,
    })));
    const { hook } = renderSession(auth);
    await waitFor(() => expect(hook.result.current.phase).toBe('prompt'));
    expect(hook.result.current.total).toBe(SESSION_CAP);
    expect(hook.result.current.queue.length).toBe(SESSION_CAP);
  });
});
