/**
 * Unit tests for `useConspectus`.
 *
 * Mirrors the pattern of `useConspectusesDue.test.ts`: verify the query is
 * gated on both auth + a non-empty uuid, and that the path parameter +
 * composite-key query are threaded through to the typed API client.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';

import { AuthContext, type AuthContextValue } from '../../../app/auth-context';
import { TELEGRAM_SYSTEM_UUID } from '../../../shared/auth/identity';
import { useConspectus } from './useConspectus';

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

function renderConspectus(auth: AuthContextValue, uuid: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client },
      createElement(AuthContext.Provider, { value: auth }, children),
    );
  return renderHook(() => useConspectus(uuid), { wrapper });
}

describe('useConspectus', () => {
  test('stays idle when uuid is empty', async () => {
    const auth = makeAuth();
    const { result } = renderConspectus(auth, '');
    expect(result.current.fetchStatus).toBe('idle');
    expect(auth.api.GET).not.toHaveBeenCalled();
  });

  test('threads uuid + composite key through to the API client', async () => {
    const note = {
      conspectus_uuid: 'dev-seed-a1',
      title: 'X',
      cue_sheet: {},
      cue_sheet_schema_version: 1,
      dense_paragraph: 'body',
      bullets: [],
      content_version: 1,
      slot: 'A',
    };
    const auth = makeAuth();
    (auth.api.GET as ApiGet).mockResolvedValueOnce({ data: note, error: undefined });

    const { result } = renderConspectus(auth, 'dev-seed-a1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(auth.api.GET).toHaveBeenCalledWith(
      '/api/v1/conspectuses/{conspectus_uuid}',
      expect.objectContaining({
        params: {
          path: { conspectus_uuid: 'dev-seed-a1' },
          query: { system_user_id: '42', system_uuid: TELEGRAM_SYSTEM_UUID },
        },
      }),
    );
    expect(result.current.data).toEqual(note);
  });

  test('surfaces API errors as thrown query errors', async () => {
    const auth = makeAuth();
    (auth.api.GET as ApiGet).mockResolvedValueOnce({
      data: undefined,
      error: { detail: { code: 'CONS_404' } },
    });

    const { result } = renderConspectus(auth, 'missing');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(String(result.current.error)).toContain('conspectuses');
  });
});
