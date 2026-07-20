/**
 * SearchProvider — mounts SearchOverlay once at the app root + exposes an
 * `open()` API via context. Wires the global Cmd+K / Ctrl+K keyboard
 * listener so any screen can trigger the palette without knowing about it.
 *
 * The `useSearch` consumer hook + `SearchContext` live in `search-context.ts`
 * so this file only exports components (Fast Refresh requirement).
 */

import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SearchOverlay } from './components/SearchOverlay';
import { SearchContext, type SearchApi } from './search-context';

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const api = useMemo<SearchApi>(
    () => ({
      open: () => setOpen(true),
      close: () => setOpen(false),
      toggle: () => setOpen((v) => !v),
    }),
    [],
  );

  // Global Cmd+K / Ctrl+K shortcut — a toggle so pressing the combo a second
  // time closes an already-open overlay. Skips prevented text-field focus
  // because the browser's own text-field IME may swallow the event first,
  // which is fine — the overlay is a convenience, not the only entry point.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return (
    <SearchContext.Provider value={api}>
      {children}
      <SearchOverlay open={open} onClose={close} />
    </SearchContext.Provider>
  );
}
