/**
 * Signature streak orb (variant A · Amie DNA).
 *
 * Reads the `StreakStats` shape returned by `GET /api/v1/me/stats` directly —
 * `current_days`, `longest_days`, `goal_days` (snake_case matches the
 * OpenAPI schema so no adapter layer is needed).
 *
 * State machine (per screens.html § ed-states):
 *   * `celebrate` — a named milestone day (7 / 30 / 100 / 365 → single
 *                    pulse + ring halo. The auditory / haptic / toast
 *                    part of the celebration is fired once per new
 *                    milestone by `useStreakMilestone` in Today; this
 *                    state is only the visual on the orb itself.
 *   * `rested`    — zero due today → cool sage twin of the orb.
 *   * `warm`      — default habit state.
 */

import { useTranslation } from 'react-i18next';

import type { components } from '../../../shared/api/schema';

type StreakStats = components['schemas']['StreakStats'];

type Props = {
  data: StreakStats;
  /** Number of due cards today — drives the `rested` state at 0. */
  dueToday: number;
  size?: 'sm' | 'md' | 'lg';
};

/** Named milestones — mirrored in `useStreakMilestone.MILESTONES`.
 * When you add / remove one here, update the hook too so the visual
 * and the toast + haptic + event fire on the same days. */
const MILESTONE_DAYS = new Set([7, 30, 100, 365]);

function resolveState(data: StreakStats, dueToday: number): 'warm' | 'rested' | 'celebrate' {
  if (MILESTONE_DAYS.has(data.current_days)) return 'celebrate';
  if (dueToday === 0) return 'rested';
  return 'warm';
}

export function StreakOrb({ data, dueToday, size = 'lg' }: Props) {
  const { t } = useTranslation();
  const state = resolveState(data, dueToday);
  const sizeClass = size === 'sm' ? 'tma-orb--sm' : size === 'md' ? '' : 'tma-orb--lg';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: 'var(--tma-sp-6, 24px) 0 var(--tma-sp-4, 16px)',
      }}
    >
      {/* Tip lives on a wrapper — the orb owns its own ::before / ::after
       * pseudo-elements for the radial body and the celebration halo, so
       * `.tma-tip` can't sit directly on it or those visuals disappear.
       * `--right` puts the popover next to the orb instead of overlapping
       * the yesterday-digest card below it; `tabIndex={0}` makes the
       * wrapper focusable so a tap on mobile (no hover) reveals it too. */}
      <div
        className="tma-tip tma-tip--right"
        data-tip={t('today.streak.tip')}
        tabIndex={0}
        role="group"
        aria-label={t('today.streak.tip')}
      >
        <div
          className={`tma-orb ${sizeClass}`.trim()}
          data-state={state}
          role="img"
          aria-label={t('today.streak.aria', { count: data.current_days })}
        >
          <span className="tma-orb__sheen" aria-hidden="true" />
          <span className="tma-orb__glare" aria-hidden="true" />
          <span className="tma-orb__num" aria-hidden="true">
            {data.current_days}
          </span>
          <span className="tma-orb__cap">{t('today.streak.unit')}</span>
        </div>
      </div>
    </div>
  );
}
