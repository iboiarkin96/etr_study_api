/**
 * Ambient module declarations for the Storybook config surface.
 *
 * `.storybook/preview.tsx` pulls production CSS via bare side-effect
 * `import '…/styles/…css'` — the app-side tsconfig is scoped to `src`
 * only, so declarations for these side-effect modules live here.
 * Kept minimal (declared as `unknown` so no import can accidentally
 * grow a typed default), and only files loaded by `.storybook/` need
 * this — the app never side-effect-imports CSS.
 */

declare module '*.css';
