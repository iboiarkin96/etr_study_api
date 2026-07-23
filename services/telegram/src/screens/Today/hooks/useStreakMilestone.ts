/**
 * useStreakMilestone — fire the celebration once per new milestone the
 * user has just crossed. Idempotent: a milestone that has already been
 * celebrated on this device stays silent.
 *
 * State model:
 *   * `MILESTONES` is a closed set — 7 / 30 / 100 / 365 days. Not
 *     multiples of 30; those come round too often to feel special.
 *   * `celebrated_streaks` in Telegram CloudStorage is the truth source
 *     (survives reinstalls, syncs across devices). Format: comma-separated
 *     list of `days` values, e.g. `"7,30"`.
 *   * The hook loads the seen-set once, subscribes to streak changes, and
 *     fires a single toast + haptic + observability event per NEW hit.
 *     Nothing about the orb's `data-state='celebrate'` visual lives here —
 *     that stays declarative in `StreakOrb.resolveState`.
 *
 * Wired at the same point where `useMeStats` resolves (Today screen),
 * downstream of `<AuthGate>` so `data.current_days` is a real number.
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { cloudGet, cloudSet } from '../../../shared/auth/cloud-storage';
import { haptic } from '../../../shared/haptics/haptics';
import { trackStreakMilestone } from '../../../shared/observability';
import { useToast } from '../../../shared/toast/toast';

const MILESTONES = [7, 30, 100, 365] as const;
type Milestone = (typeof MILESTONES)[number];

const STORE_KEY = 'celebrated_streaks';

function parseSeen(raw: string | null): Set<number> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n)),
  );
}

function serialise(seen: Set<number>): string {
  return Array.from(seen)
    .sort((a, b) => a - b)
    .join(',');
}

export function useStreakMilestone(currentDays: number | undefined): void {
  const { t } = useTranslation();
  const { toast } = useToast();
  /** The set of milestones this device has already congratulated the user
   * on. Loaded once from CloudStorage; mutated in place as new milestones
   * fire so a rapid double-render can't double-fire the same event. */
  const seenRef = useRef<Set<number> | null>(null);
  /** Debounce guard — a single celebration fire per hook mount lifetime.
   * Belt-and-braces on top of `seenRef`, so React StrictMode's double
   * effect invocation in dev doesn't produce two toasts. */
  const firedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void cloudGet(STORE_KEY).then((raw) => {
      if (cancelled) return;
      seenRef.current = parseSeen(raw);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (currentDays === undefined) return;
    if (seenRef.current === null) return; // CloudStorage still loading
    const hit = MILESTONES.find((m) => currentDays === m) as Milestone | undefined;
    if (hit === undefined) return;
    if (seenRef.current.has(hit)) return;
    if (firedRef.current.has(hit)) return;

    firedRef.current.add(hit);
    seenRef.current.add(hit);

    toast({
      tone: 'success',
      message: t(`today.streak.milestone.days_${hit}` as const),
    });
    haptic('notifySuccess');
    trackStreakMilestone({ days: hit });
    // Fire-and-forget persistence — a failure to write to CloudStorage
    // (offline, quota) is worth a follow-up milestone toast on the next
    // reopen rather than blocking this celebration.
    void cloudSet(STORE_KEY, serialise(seenRef.current));
  }, [currentDays, t, toast]);
}
