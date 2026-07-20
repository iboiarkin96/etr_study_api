/**
 * Pure client-side substring filter + highlight for the Search overlay.
 *
 * Extracted so the numeric contract (ranking + match-range computation)
 * can be unit-tested without pulling React and so the component file
 * exports only React (Fast Refresh requirement).
 *
 * Match model:
 *   - normalise both title and query with `.toLocaleLowerCase()` (so
 *     «CAP» matches «cap theorem»; Cyrillic locales survive too)
 *   - substring (`indexOf`) — no fuzzy, no Levenshtein. Fast, deterministic,
 *     and matches what the mock advertises («typing narrows results»)
 *   - rank: earlier match index first, then shorter title (specificity),
 *     then original order (stable)
 *
 * Perf: the overlay pre-lower-cases the whole title list once per data
 * snapshot and passes it via `lowercaseTitles`. If omitted, this function
 * falls back to per-row lowering — fine for tests and one-off callers,
 * wasteful for keystroke-driven UI.
 */

import type { ConspectusRow } from './hooks/useConspectusesList';

export type SearchHit = {
  row: ConspectusRow;
  /** 0-based index of the match start in the lower-cased title. */
  matchStart: number;
  /** Length of the query — used to compute the highlight range. */
  matchLength: number;
};

export function filterConspectuses(
  rows: readonly ConspectusRow[],
  query: string,
  lowercaseTitles?: readonly string[],
): SearchHit[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  const hits: SearchHit[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lower = lowercaseTitles?.[i] ?? (row.title ?? '').toLocaleLowerCase();
    const idx = lower.indexOf(q);
    if (idx === -1) continue;
    hits.push({ row, matchStart: idx, matchLength: q.length });
  }
  // Earlier match position wins; ties broken by shorter title (specificity).
  return hits.sort((a, b) => {
    if (a.matchStart !== b.matchStart) return a.matchStart - b.matchStart;
    const at = a.row.title ?? '';
    const bt = b.row.title ?? '';
    return at.length - bt.length;
  });
}

/** Split a hit's title into (before · match · after) so the component
 * can wrap the match in <mark> without dangerouslySetInnerHTML. */
export function splitAtMatch(hit: SearchHit): {
  before: string;
  match: string;
  after: string;
} {
  const title = hit.row.title ?? '';
  return {
    before: title.slice(0, hit.matchStart),
    match: title.slice(hit.matchStart, hit.matchStart + hit.matchLength),
    after: title.slice(hit.matchStart + hit.matchLength),
  };
}
