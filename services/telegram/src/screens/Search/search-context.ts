/**
 * Search context split out from SearchProvider.tsx so the provider file only
 * exports components — required for Fast Refresh (`react-refresh/only-export-components`).
 */

import { createContext, useContext } from 'react';

export type SearchApi = {
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const SearchContext = createContext<SearchApi | null>(null);

export function useSearch(): SearchApi {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used inside <SearchProvider>');
  return ctx;
}
