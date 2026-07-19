/**
 * Accessibility gate — axe-core over every Storybook story.
 *
 * Enumerates stories from `storybook-static/index.json` (same discovery
 * as the visual-regression suite) and runs an axe scan scoped to the
 * story root against the WCAG 2.1 A + AA rule tags. Violations fail the
 * suite with a readable list of offending nodes.
 *
 * Runs once per story in the dark theme only — colour-contrast tokens
 * are theme-mirrored, and the light theme re-runs the same DOM, so a
 * second sweep doubles the runtime without widening coverage. Revisit
 * if light-theme-specific overrides appear.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';

type StoryEntry = {
  id: string;
  title: string;
  name: string;
  type: 'story' | 'docs';
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
  test(`a11y · ${story.title} — ${story.name}`, async ({ page }) => {
    await page.goto(
      `/iframe.html?id=${story.id}&globals=theme:dark&viewMode=story`,
    );
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => {
      const el = document.getElementById('storybook-root');
      return el !== null && el.childElementCount > 0;
    });

    const results = await new AxeBuilder({ page })
      .include('#storybook-root')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const readable = results.violations.map((v) => ({
      rule: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 120)),
    }));

    expect(readable, JSON.stringify(readable, null, 2)).toEqual([]);
  });
}
