/**
 * SearchOverlay — the Cmd+K spotlight modal.
 *
 * Full-viewport fixed overlay + centred command box. Client-side substring
 * filter over the cached conspectus list (`useConspectusesList` fires once
 * per session and caches indefinitely). Keyboard-first:
 *
 *   ↑ / ↓ / Ctrl+P / Ctrl+N (Ctrl+J for down) → move highlight
 *   Enter                                     → navigate to /conspectus/$uuid
 *   Esc / backdrop click                      → close
 *
 * Ctrl+K is deliberately NOT bound inside the overlay — the global
 * SearchProvider owns it as an open/close toggle, so re-using it here
 * would fight the provider (open→close on first stroke).
 *
 * Autofocuses the input on mount so the user can type immediately; on close,
 * focus is returned to whichever element opened the overlay (a11y contract).
 * Renders to `document.body` via a portal so the overlay isn't clipped by a
 * parent `overflow: hidden` on the surface that opened it.
 */

import { useNavigate } from '@tanstack/react-router';
import type { KeyboardEvent, MouseEvent } from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { useConspectusesList } from '../hooks/useConspectusesList';
import { filterConspectuses, splitAtMatch } from '../search-filter';

const SLOT_TONE: Record<string, 'accent' | 'success' | 'info' | 'warn'> = {
  A: 'accent',
  B: 'info',
  C: 'success',
  D: 'warn',
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export function SearchOverlay({ open, onClose }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const list = useConspectusesList();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);
  /** Backdrop-close latch — see handleBackdropMouseDown/Up below. Declared
   * at the top so hooks run in the same order every render (rules-of-hooks;
   * the component early-returns null when `open` is false). */
  const backdropMouseDownRef = useRef(false);
  /** Element that had focus when the overlay opened — restored on close so
   * keyboard users don't lose their place. WAI-ARIA modal-dialog contract. */
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  /** «Mouse-moved-since-last-render» gate. When arrow-key nav triggers
   * `scrollIntoView`, the list shifts under a stationary pointer and
   * mouseenter fires spuriously on the item newly under it — hijacking the
   * keyboard cursor. This ref flips to false on every arrow keydown and
   * flips back on the next real pointermove. Classic cmdk fix. */
  const pointerMovedRef = useRef(true);

  // Wrap in useMemo so a new [] on each render doesn't invalidate the
  // downstream lowercase-index and hits memos every stroke.
  const rows = useMemo(() => list.data?.items ?? [], [list.data]);
  const hasMore = list.data?.hasMore ?? false;
  /** Pre-lowercase titles once per data snapshot. Filter runs on every
   * keystroke, so this saves N string allocations per stroke — for a
   * 500-row library that's the difference between 500 throwaway strings
   * per stroke vs zero. */
  const lowercaseIndex = useMemo(
    () => rows.map((r) => (r.title ?? '').toLocaleLowerCase()),
    [rows],
  );

  const hits = useMemo(
    () => filterConspectuses(rows, query, lowercaseIndex),
    [rows, query, lowercaseIndex],
  );
  /** Clamp at read time — avoids a stale-cursor render + effect round-trip
   * when the result set shrinks under the pointer. */
  const activeCursor = hits.length === 0 ? 0 : Math.min(cursor, hits.length - 1);
  /** Loading only when the query is actually in flight. Bare `list.isPending`
   * is `true` while `enabled: false` (auth loading) — showing «Loading
   * library…» forever with no way to recover. */
  const isFetching = list.fetchStatus === 'fetching';

  // Reset state each time the overlay opens; snapshot focus, then move it in.
  // Also retries the library fetch if the previous attempt errored — the
  // query has `staleTime: Infinity` and a stable queryKey, so without an
  // explicit refetch here a one-off network failure would cache forever
  // and no amount of Cmd+K would recover.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    itemRefs.current = [];
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;
    if (list.isError) void list.refetch();
    // rAF — wait for the portal to mount before focusing.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      cancelAnimationFrame(id);
      // Restore focus to whatever opened the overlay (search icon, hotkey
      // origin, etc.). Skipped if it was garbage-collected / detached.
      const target = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (target && document.contains(target)) target.focus();
    };
  }, [open, list]);

  // Scroll the highlighted item into view when arrow-nav moves off-screen.
  // Uses an itemRefs array — cheaper than a `querySelector` on every stroke
  // and safer against dynamic re-numbering.
  useEffect(() => {
    if (!open) return;
    itemRefs.current[activeCursor]?.scrollIntoView({ block: 'nearest' });
  }, [activeCursor, open]);

  if (!open) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    // IME composition guard — Japanese/Chinese/Korean users press Enter to
    // confirm a composed character. `keyCode === 229` is the legacy signal;
    // `isComposing` is the modern one.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    // Arrow / Ctrl-J,N/P vim-ish nav — Ctrl-K deliberately absent (global
    // SearchProvider owns it as open/close toggle). Guarded on empty
    // results so cursor never goes to -1.
    if (e.key === 'ArrowDown' || (e.ctrlKey && (e.key === 'j' || e.key === 'n'))) {
      e.preventDefault();
      if (hits.length === 0) return;
      pointerMovedRef.current = false;
      setCursor((c) => Math.min(hits.length - 1, c + 1));
      return;
    }
    if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault();
      if (hits.length === 0) return;
      pointerMovedRef.current = false;
      setCursor((c) => Math.max(0, c - 1));
      return;
    }
    if (e.key === 'Enter') {
      const hit = hits[activeCursor];
      if (!hit) return;
      e.preventDefault();
      onClose();
      void navigate({
        to: '/conspectus/$conspectus_uuid',
        params: { conspectus_uuid: hit.row.conspectus_uuid },
      });
    }
  };

  /** Backdrop-close: only fire if the user pressed AND released the mouse on
   * the backdrop. Otherwise a text-selection drag that ends over the
   * backdrop would close the overlay and lose the user's query. Uses the
   * `backdropMouseDownRef` hoisted at the top of the component. */
  const handleBackdropMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    backdropMouseDownRef.current = e.target === e.currentTarget;
  };
  const handleBackdropMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (backdropMouseDownRef.current && e.target === e.currentTarget) {
      onClose();
    }
    backdropMouseDownRef.current = false;
  };

  const activeOptionId =
    hits.length > 0 ? `${listId}-opt-${activeCursor}` : undefined;

  // Screen-reader status: announce «N results» / «no matches» / «loading» /
  // «error» when the input state changes. Polite so it doesn't interrupt
  // typing. Error takes priority over every other case so SR users don't
  // miss the state where nothing will ever land.
  const statusMessage = (() => {
    if (list.isError) return t('search.error');
    if (isFetching) return t('search.loading');
    if (list.isSuccess && query.length === 0) return t('search.hint');
    if (list.isSuccess && query.length > 0 && hits.length === 0) {
      return t('search.empty', { query });
    }
    if (list.isSuccess && hits.length > 0) {
      return t('search.matchesGroup', { count: hits.length });
    }
    return '';
  })();

  const overlay = (
    // `tma-scope` is REQUIRED — the overlay is portaled to <body>, outside
    // the app's scope wrapper, so without it every --tma-* token resolves
    // to initial (background transparent, text canvastext). The screenshot
    // «black-on-black with only the input row visible» was exactly that.
    <div
      className="tma-scope tma-cmdk"
      role="dialog"
      aria-modal="true"
      aria-label={t('search.overlayLabel')}
      onMouseDown={handleBackdropMouseDown}
      onMouseUp={handleBackdropMouseUp}
      onKeyDown={handleKeyDown}
      onPointerMove={() => {
        pointerMovedRef.current = true;
      }}
    >
      <div className="tma-cmdk__box" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()}>
        <div className="tma-cmdk__inputrow">
          {/* Quiet lead-icon — deliberately NOT `.tma-cmdk__item-icon` because
              that class carries the slot-tinted-square treatment meant for
              result rows. In the input row the icon is a visual cue, not a
              slot indicator. */}
          <span className="tma-cmdk__lead-icon" aria-hidden="true">⌕</span>
          <input
            ref={inputRef}
            className="tma-cmdk__input"
            type="search"
            placeholder={t('search.placeholder')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            aria-label={t('search.inputLabel')}
            aria-autocomplete="list"
            aria-controls={hits.length > 0 ? listId : undefined}
            aria-activedescendant={activeOptionId}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="tma-cmdk__kbd">Esc</span>
        </div>

        {/* Live region — screen readers announce match count / empty / loading
            changes without stealing focus. `aria-atomic` re-reads the whole
            phrase on every update. */}
        <div className="tma-visually-hidden" role="status" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </div>

        {/* Exhaustive state rendering — the body ALWAYS shows one branch
            below the input row. An earlier version had only 4 conditions
            (loading / hint / empty / list); on `list.isError` (server 422
            from an over-cap limit) all four were false and the overlay
            looked frozen. Order matters: error trumps loading trumps hint. */}
        {list.isError && (
          // role=alert (assertive live region) — the error is the state
          // most likely to be missed if only politely announced. The
          // outer role=status region also carries the same text, but
          // AT engines de-duplicate live-region announcements by text.
          <div className="tma-cmdk__empty" data-tone="danger" role="alert">
            <span>{t('search.error')}</span>
            <button
              type="button"
              className="tma-cmdk__retry"
              onClick={() => void list.refetch()}
              disabled={isFetching}
            >
              {isFetching ? t('search.loading') : t('search.retry')}
            </button>
          </div>
        )}

        {!list.isError && isFetching && (
          <div className="tma-cmdk__empty">{t('search.loading')}</div>
        )}

        {!list.isError && !isFetching && !list.isSuccess && (
          <div className="tma-cmdk__empty">{t('search.awaiting')}</div>
        )}

        {!list.isError && !isFetching && list.isSuccess && query.length === 0 && (
          <div className="tma-cmdk__empty">{t('search.hint')}</div>
        )}

        {!list.isError && !isFetching && list.isSuccess && query.length > 0 && hits.length === 0 && (
          <div className="tma-cmdk__empty">
            {t('search.empty', { query })}
          </div>
        )}

        {!list.isError && !isFetching && list.isSuccess && hasMore && (
          <div className="tma-cmdk__note" role="note">
            {t('search.truncated', { count: rows.length })}
          </div>
        )}

        {!list.isError && !isFetching && list.isSuccess && hits.length > 0 && (
          <ul
            id={listId}
            ref={listRef}
            className="tma-cmdk__list"
            role="listbox"
            aria-label={t('search.resultsLabel', { count: hits.length })}
          >
            <li className="tma-cmdk__group-title" role="presentation">
              {t('search.matchesGroup', { count: hits.length })}
            </li>
            {hits.map((hit, i) => {
              const parts = splitAtMatch(hit);
              const tone = SLOT_TONE[hit.row.slot] ?? 'accent';
              const isCursor = i === activeCursor;
              return (
                <li
                  key={hit.row.conspectus_uuid}
                  id={`${listId}-opt-${i}`}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  className="tma-cmdk__item"
                  role="option"
                  aria-selected={isCursor}
                  onMouseEnter={() => {
                    // Only accept mouseenter as cursor-move if the pointer
                    // actually moved since the last keyboard nav — prevents
                    // scrollIntoView from spuriously jumping the highlight.
                    if (pointerMovedRef.current) setCursor(i);
                  }}
                  onClick={() => {
                    onClose();
                    void navigate({
                      to: '/conspectus/$conspectus_uuid',
                      params: { conspectus_uuid: hit.row.conspectus_uuid },
                    });
                  }}
                >
                  <span className="tma-cmdk__item-icon" data-tone={tone}>
                    {hit.row.slot}
                  </span>
                  <span className="tma-cmdk__item-title">
                    {parts.before}
                    <mark>{parts.match}</mark>
                    {parts.after}
                  </span>
                  <span className="tma-cmdk__item-sub">{t('search.slotLabel', { slot: hit.row.slot })}</span>
                  {isCursor && <span className="tma-cmdk__kbd">↵</span>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}
