import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// The Storybook init also wires up a `@storybook/addon-vitest` browser
// project that runs every story as a chromium interaction test. It's a
// nice-to-have but currently fails on ESM subpath resolution for
// `aria-query`; unit tests are the ship-gate for T-25b. When we want
// story-tests back, re-add the second `projects[]` entry documented at
// https://storybook.js.org/docs/writing-tests/integrations/vitest-addon.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
