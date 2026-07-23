/**
 * Typed API client built on `openapi-fetch` + generated `schema.d.ts`.
 *
 * Handles three cross-cutting concerns for every call:
 *   1. `Authorization: Bearer <jwt>` — from the auth-token store (T-12).
 *   2. `Idempotency-Key` — one fresh UUIDv4 per mutation gesture; retained
 *      through retry so a lost 4G reply never doubles an action (ADR 0006).
 *   3. `X-Request-Id` — one UUID per gesture, echoed by the API on every
 *      response so the two observability stacks join (see explanation
 *      · observability-model).
 *
 * Path prefix is `VITE_API_BASE_URL` (defaults to `http://localhost:8000`).
 */

import createClient, { type Middleware } from 'openapi-fetch';

import type { paths } from './schema';

/** Read + write JWT. Provided lazily so the client is testable in isolation. */
export type JwtProvider = {
  read: () => string | null;
  onUnauthorized?: () => void;
};

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/** UUIDv4 without pulling `uuid` — the platform ships a real one. */
function uuidv4(): string {
  return crypto.randomUUID();
}

function buildBaseUrl(): string {
  // Empty string = relative URL — fetch resolves against the current origin,
  // which the Vite dev-server proxies to the local API. This is the default
  // for the on-device tunnel workflow (one tunnel, one origin, no CORS).
  // Only set VITE_API_BASE_URL when frontend and API live on different
  // origins (e.g. Cloudflare Pages front + separately-hosted API in prod).
  const explicit = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (!explicit) return '';
  return explicit.replace(/\/+$/, '');
}

export function createApiClient(jwt: JwtProvider) {
  const client = createClient<paths>({ baseUrl: buildBaseUrl() });

  const authHeader: Middleware = {
    onRequest({ request }) {
      const token = jwt.read();
      const headers = new Headers(request.headers);
      if (token) headers.set('Authorization', `Bearer ${token}`);
      headers.set('X-Request-Id', uuidv4());
      if (MUTATION_METHODS.has(request.method.toUpperCase())) {
        // Only set when the caller has not already provided one — retries
        // must reuse the previous key per ADR 0006.
        if (!headers.has('Idempotency-Key')) headers.set('Idempotency-Key', uuidv4());
      }
      return new Request(request, { headers });
    },
    onResponse({ response }) {
      if (response.status === 401) jwt.onUnauthorized?.();
      // Return `undefined` to signal «not modifying» — openapi-fetch throws
      // when a middleware returns the same Response instance.
      return undefined;
    },
  };

  client.use(authHeader);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;
