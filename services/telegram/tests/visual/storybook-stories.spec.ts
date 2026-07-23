/**
 * Visual regression — one screenshot per (story × theme).
 *
 * Story list is enumerated from `storybook-static/index.json` (produced
 * by `npm run build-storybook`), so a new `*.stories.tsx` file is
 * automatically covered on the next run. Theme comes from the current
 * Playwright project (`dark` | `light`) and is pushed to Storybook via
 * URL-globals so the same toolbar switch that runs in dev drives the
 * screenshot.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { test, expect } from '@playwright/test';

type StoryEntry = {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs';
  tags?: string[];
};

const here = dirname(fileURLToPath(import.meta.url));
const indexPath = join(here, '..', '..', 'storybook-static', 'index.json');

const rawIndex = JSON.parse(readFileSync(indexPath, 'utf8')) as {
  entries: Record<string, StoryEntry>;
};

const stories = Object.values(rawIndex.entries).filter(
  (entry) => entry.type === 'story',
);

if (stories.length === 0) {
  throw new Error(
    `No stories found in ${indexPath}. Run \`npm run build-storybook\` first.`,
  );
}

for (const story of stories) {
  test(`${story.title} — ${story.name}`, async ({ page }, testInfo) => {
    const theme = testInfo.project.name; // 'dark' | 'light'
    await page.goto(
      `/iframe.html?id=${story.id}&globals=theme:${theme}&viewMode=story`,
    );

    // Storybook's preview root gets its content injected after mount. Wait
    // for a first paint plus fonts + one animation frame so screenshots are
    // deterministic across warm/cold caches.
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => {
      const el = document.getElementById('storybook-root');
      return el !== null && el.childElementCount > 0;
    });
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => r(null))),
    );

    await expect(page).toHaveScreenshot(`${story.id}.png`, {
      fullPage: true,
    });
  });
}
