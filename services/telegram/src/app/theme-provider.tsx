/**
 * ThemeProvider — maps `window.Telegram.WebApp.themeParams` onto CSS custom
 * properties on <html>, so screen styles can read colors as `var(--tg-...)`
 * without touching JS.
 *
 * Live-reactive: subscribes to Telegram's `themeChanged` event so a real
 * user's Telegram-side theme switch flips the app immediately.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react';

type ThemeParams = Record<string, string>;

/** CSS custom property name for a themeParams key (e.g. `bg_color` → `--tg-bg-color`). */
function cssVarName(key: string): string {
  return `--tg-${key.replaceAll('_', '-')}`;
}

/** Read the current themeParams block, defensively. */
function readThemeParams(): ThemeParams {
  const wa = window.Telegram?.WebApp;
  if (!wa) return {};
  return { ...wa.themeParams } as ThemeParams;
}

/** Read the current colour scheme (light / dark). */
function readColorScheme(): 'light' | 'dark' {
  const wa = window.Telegram?.WebApp;
  return wa?.colorScheme ?? 'light';
}

/** Write every themeParams entry into an inline style block on <html>. */
function applyThemeToRoot(params: ThemeParams, scheme: 'light' | 'dark'): void {
  const root = document.documentElement;
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') root.style.setProperty(cssVarName(key), value);
  }
  root.dataset.tgTheme = scheme;
}

type Props = { children: ReactNode };

export function ThemeProvider({ children }: Props) {
  const initial = useMemo(
    () => ({ params: readThemeParams(), scheme: readColorScheme() }),
    [],
  );
  const [snapshot, setSnapshot] = useState(initial);

  useEffect(() => {
    // Push the initial theme once React is mounted, before first paint.
    applyThemeToRoot(snapshot.params, snapshot.scheme);
  }, [snapshot]);

  useEffect(() => {
    const wa = window.Telegram?.WebApp;
    if (!wa) return;

    const handler = (): void => {
      setSnapshot({ params: readThemeParams(), scheme: readColorScheme() });
    };
    wa.onEvent('themeChanged', handler);
    return () => wa.offEvent('themeChanged', handler);
  }, []);

  return <>{children}</>;
}
