/**
 * Playwright config — visual regression against the static Storybook build.
 *
 *   • `webServer` boots a zero-dep Node script that serves
 *     `storybook-static/` on :6006. Playwright waits until the port is
 *     reachable before running any test.
 *   • Two projects — `dark` and `light` — screenshot each story twice.
 *     Storybook's URL-globals (`?globals=theme:dark`) drive the toolbar
 *     switch we wired in `.storybook/preview.tsx`.
 *   • Viewport locked to a TMA-realistic 390×844 (iPhone 14). If you
 *     add desktop-only components later, add a third project.
 *   • Baselines live under `tests/visual/__screenshots__/` and are
 *     tracked in git. CI runs without `--update-snapshots`, so any
 *     pixel drift fails the build.
 */

import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://127.0.0.1:6006',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    trace: 'on-first-retry',
  },
  expect: {
    // 1 % pixel budget absorbs sub-pixel antialiasing / font hinting drift
    // between local (macOS) and CI (Linux). Tighten if a run ever passes
    // that shouldn't.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
      caret: 'hide',
    },
  },
  projects: [
    {
      name: 'dark',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
    {
      name: 'light',
      testMatch: /visual\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], colorScheme: 'light' },
    },
    {
      name: 'a11y',
      testMatch: /a11y\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], colorScheme: 'dark' },
    },
  ],
  webServer: {
    command: 'node scripts/serve-storybook-static.mjs',
    url: 'http://127.0.0.1:6006/iframe.html',
    reuseExistingServer: !CI,
    timeout: 30_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
