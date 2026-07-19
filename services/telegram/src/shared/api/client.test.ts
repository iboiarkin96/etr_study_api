/**
 * Unit tests for the API client interceptor.
 *
 * Every protected call must carry `Authorization: Bearer <jwt>` and
 * `X-Request-Id`; mutations additionally carry `Idempotency-Key`. The API
 * middleware and the observability model depend on these headers being
 * present unconditionally.
 */

import { afterEach, describe, expect, test, vi } from 'vitest';

import { createApiClient } from './client';

type MockFetch = ReturnType<typeof vi.fn>;

function makeOkFetch(): MockFetch {
  return vi.fn(async () =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '{}',
      headers: new Headers(),
      clone() {
        return this;
      },
    } as Response),
  );
}

afterEach(() => vi.restoreAllMocks());

describe('createApiClient', () => {
  test('adds Authorization + X-Request-Id on GET when a JWT is available', async () => {
    const fetchMock = makeOkFetch();
    vi.stubGlobal('fetch', fetchMock);
    const api = createApiClient({ read: () => 'stub-jwt' });

    // Path is a string that exists in the schema but the shape here doesn't
    // matter — the test only cares about what headers went out.
    await api.GET('/live', {});

    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(req.headers.get('Authorization')).toBe('Bearer stub-jwt');
    expect(req.headers.get('X-Request-Id')).toMatch(/[0-9a-f-]{5,}/);
    expect(req.headers.get('Idempotency-Key')).toBeNull();
  });

  test('adds Idempotency-Key on POST', async () => {
    const fetchMock = makeOkFetch();
    vi.stubGlobal('fetch', fetchMock);
    const api = createApiClient({ read: () => 'stub-jwt' });

    await api.POST('/api/v1/auth/telegram', {
      body: { init_data: 'stub' },
    });

    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(req.method).toBe('POST');
    expect(req.headers.get('Idempotency-Key')).toMatch(/[0-9a-f-]{5,}/);
    expect(req.headers.get('Authorization')).toBe('Bearer stub-jwt');
  });

  test('skips Authorization when no JWT is available', async () => {
    const fetchMock = makeOkFetch();
    vi.stubGlobal('fetch', fetchMock);
    const api = createApiClient({ read: () => null });

    await api.GET('/live', {});

    const req = fetchMock.mock.calls[0]![0] as Request;
    expect(req.headers.get('Authorization')).toBeNull();
  });

  test('invokes onUnauthorized on 401', async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({}),
        text: async () => '{}',
        headers: new Headers(),
        clone() {
          return this;
        },
      } as Response),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onUnauthorized = vi.fn();
    const api = createApiClient({ read: () => 'stale', onUnauthorized });

    await api.GET('/api/v1/schedule/summary', {
      params: {
        query: {
          system_user_id: '42',
          system_uuid: '00000000-0000-4000-8000-000000000001',
        },
      },
    });

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
