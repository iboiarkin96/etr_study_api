/**
 * Signature streak orb (variant A · Amie DNA).
 *
 * Reads the `StreakStats` shape returned by `GET /api/v1/me/stats` directly —
 * `current_days`, `longest_days`, `goal_days` (snake_case matches the
 * OpenAPI schema so no adapter layer is needed).
 *
 * State machine (per screens.html § ed-states):
 *   * `celebrate` — every 30-day milestone → single pulse + ring halo.
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

function resolveState(data: StreakStats, dueToday: number): 'warm' | 'rested' | 'celebrate' {
  if (data.current_days > 0 && data.current_days % 30 === 0) return 'celebrate';
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
      <div
        className={`tma-orb ${sizeClass}`.trim()}
        data-state={state}
        role="img"
        aria-label={t('today.streak.aria', { count: data.current_days })}
        title={t('today.streak.tip')}
      >
        <span className="tma-orb__sheen" aria-hidden="true" />
        <span className="tma-orb__glare" aria-hidden="true" />
        <span className="tma-orb__num" aria-hidden="true">
          {data.current_days}
        </span>
        <span className="tma-orb__cap">{t('today.streak.unit')}</span>
      </div>
    </div>
  );
}
