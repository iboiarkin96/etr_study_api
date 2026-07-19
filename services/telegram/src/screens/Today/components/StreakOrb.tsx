/**
 * Signature streak orb (variant A · Amie DNA).
 *
 * Renders the shipped `.tma-orb` primitive from `tma-kit.css` — a living
 * radial-gradient bubble with rotating iridescent sheen, double glare and
 * ember-tinted specular. All motion / colours are owned by the kit; this
 * file only decides which state to show and threads the streak number
 * through `.tma-orb__num`.
 *
 * State machine (per screens.html § ed-states):
 *   * `celebrate` — every 30-day milestone → single pulse + ring halo.
 *   * `rested`    — zero due today → cool sage twin of the orb.
 *   * `warm`      — default habit state.
 *
 * `tma-ticker--live` is left off for now; the number renders statically.
 * The ticker requires driving `--tick-target` through a CSS variable
 * countdown that the kit ships as a raw animation — swap in when we
 * wire the streak-changed event.
 */

import { useTranslation } from 'react-i18next';

import type { StreakStats } from '../hooks/useDailyStats';

type Props = {
  data: StreakStats;
  /** Number of due cards today — drives the `rested` state at 0. */
  dueToday: number;
  size?: 'sm' | 'md' | 'lg';
};

function resolveState(data: StreakStats, dueToday: number): 'warm' | 'rested' | 'celebrate' {
  if (data.currentDays > 0 && data.currentDays % 30 === 0) return 'celebrate';
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
        aria-label={t('today.streak.aria', { count: data.currentDays })}
      >
        <span className="tma-orb__sheen" aria-hidden="true" />
        <span className="tma-orb__glare" aria-hidden="true" />
        <span className="tma-orb__num" aria-hidden="true">
          {data.currentDays}
        </span>
        <span className="tma-orb__cap">{t('today.streak.unit')}</span>
      </div>
    </div>
  );
}
