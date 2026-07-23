# services/telegram — Telegram Mini App

React + TypeScript client for the Study App daily loop, launched from
Telegram as a WebApp.

Companion to the [Telegram Mini App epic][epic] and the
[TMA design section][kit] in the portal UI Kit. Backend contract is the
existing `/api/v1` surface — this service ships no server code (bot handlers
live in `services/api/app/bot/`, added in W5 · T-22).

Scope in one paragraph: personal-mode client for the maintainer only.
Auth is the existing `X-API-Key` header (see [ADR 0038][adr]). No token
exchange, no `initData → JWT` — that lands in P2 when the audience opens.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Build | Vite 6 | Fast dev server, mature. |
| UI | React 19 + TypeScript | Latest stable; TS-first ecosystem. |
| Router | `@tanstack/react-router` | Type-safe routing + built-in View Transitions. |
| Data | `@tanstack/react-query` | Server-state cache used by every screen. |
| State (UI) | `zustand` | Tiny, no boilerplate. |
| SDK | `@telegram-apps/sdk-react` | Telegram theme, viewport, haptics, back-button. |
| UI kit | `@telegram-apps/telegram-ui` | iOS/Material auto-switch on platform. |
| Motion | `framer-motion` | Springs, shared-element transitions. |
| i18n | `i18next` + `react-i18next` | `ru` + `en` at MVP. |
| Analytics | `posthog-js` (opt-in) | Event spec in the epic (§ W4). |

## Layout

```
services/telegram/
├── README.md
├── CHANGELOG.md
├── Makefile              # dev / build / typecheck / lint / verify
├── package.json          # single package — no npm workspaces
├── tsconfig.json
├── tsconfig.node.json    # types for vite.config.ts
├── vite.config.ts
├── eslint.config.js
├── index.html
└── src/
    ├── main.tsx          # SDK bootstrap → mount App
    ├── App.tsx           # placeholder until T-06 wires providers
    └── vite-env.d.ts
```

The [epic tree][epic-tree] describes a `web/` subdirectory with an npm
workspace root — collapsed to a flat layout during T-05 because a single
package doesn't earn workspace ceremony. Sibling directories (`ops/`,
`e2e/`, `storybook/`) can land later without restructuring.

## Development

```bash
make -C services/telegram install    # npm ci — install dependencies
make -C services/telegram dev        # Vite dev server on http://localhost:5173
make -C services/telegram typecheck  # tsc --noEmit
make -C services/telegram lint       # eslint .
make -C services/telegram verify     # typecheck + lint + build
```

The dev loop is a **plain browser tab** — auth is the `X-API-Key` header,
so no signed `initData` is required. The `mockTelegramEnv()` shim exists
purely so the SDK boots (theme, viewport). On-device testing over
Cloudflare Tunnel arrives in W5.

`VITE_API_KEY` (base URL is inferred from the running API) is read by the
generated API client added in T-07; a placeholder is fine until then.

[epic]: ../portal/internal/governance/backlog/telegram-mini-app-epic.html
[epic-tree]: ../portal/internal/governance/backlog/telegram-mini-app-epic.html#tree-h
[kit]: ../portal/internal/ui-kit/pages/telegram-mini-app/index.html
[adr]: ../portal/internal/governance/adr/0038-personal-mode-auth-x-api-key.html
