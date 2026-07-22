import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io'],
    // Turn off Vite's built-in error overlay so uncaught render errors
    // reach our <AppErrorBoundary> fallback instead of getting painted
    // over by Vite's dev-time red banner. Doesn't affect prod (Vite
    // build has no overlay to begin with); on-device Mini App users
    // never saw the overlay either, but a developer testing locally
    // was — this file surfaces the boundary UI to that developer too.
    hmr: {
      overlay: false,
    },
    // Force no-cache on the HTML shell so Telegram WebKit (iOS + Android)
    // doesn't serve a stale index.html without our telegram-web-app.js
    // script tag after we redeploy. Assets are already fingerprinted; only
    // the HTML entry needs this. Symptom of the cache bug: /debug/haptics
    // reports `window.Telegram: MISSING` and `initData: missing` inside a
    // real Mini App because the old bundle boots our mock env before the
    // SDK gets a chance to inject.
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
    },
    // Proxy /api/* to the local FastAPI so the frontend can use ONE tunnel
    // and hit the API through the same origin. Without this, publishing the
    // Mini App via a Cloudflare quick tunnel requires a SECOND tunnel just
    // for the API — and every restart hands out a fresh URL, so a stale
    // VITE_API_BASE_URL in .env.local silently breaks the auth handshake
    // with a network error the user reads as «Authorization failed». With
    // this proxy the client calls `/api/v1/...` as a relative URL and Vite
    // forwards to the local API.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  // `vite preview` serves the production bundle from dist/. Mirror the
  // dev-server proxy here so an on-device test of the prod build still
  // reaches the local API. Without this, the preview server would 404
  // every /api/* call and AuthGate would render its own auth-error
  // fallback before Today ever gets a chance to render (masking any
  // boundary regression behind an unrelated «Something went wrong» copy).
  preview: {
    port: 4173,
    host: '127.0.0.1',
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
