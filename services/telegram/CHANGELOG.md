# services/telegram — Changelog

Per-service changelog for the Telegram Mini App. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/); the root `CHANGELOG.md`
carries the cross-cutting headlines.

## 2026-07-15 — T-05 · service scaffold

- **Service created.** `services/telegram/` bootstrapped with Vite 6 +
  React 19 + TypeScript. Full W2 dependency set installed in one shot
  (TanStack Router + Query, Zustand, framer-motion, PostHog, i18next,
  `@telegram-apps/sdk-react`, `@telegram-apps/telegram-ui`) so later
  tasks (T-06 providers, T-07 API client, T-08 i18n + Storybook) don't
  each trigger their own install pass.
- **Layout deviates from the epic tree.** The plan tree describes an npm
  workspace root with a nested `web/` package (see
  [epic § Frontend structure][epic-tree]). Collapsed to a single flat
  package at `services/telegram/` — one `package.json`, one
  `node_modules`. A single-package workspace earns nothing but ceremony.
  Siblings (`ops/`, `e2e/`, `storybook/`) can land later without
  restructuring.
- **Makefile.** `dev` / `install` / `typecheck` / `lint` / `build` /
  `verify` targets; palette matches sibling service Makefiles. Root
  Makefile gains a `verify-telegram` delegate and a `dev-telegram`
  shortcut. Not yet wired into the top-level `verify` composite
  (deferred to T-24 alongside the Lighthouse budget).
- **`.gitignore`.** Root ignore gains `node_modules/`, `.vite/`,
  `.eslintcache`, `*.tsbuildinfo`. `dist/` was already present.

[epic-tree]: ../portal/internal/governance/backlog/telegram-mini-app-epic.html#tree-h
