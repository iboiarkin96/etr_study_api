/**
 * Miss orb — the D1 «breathing element» for the Errors screen.
 *
 * Same warm orb primitive as Today's StreakOrb; the number is the miss
 * count for the trailing seven days. State machine mirrors StreakOrb —
 * `rested` when count is 0 (sage twin), `warm` otherwise.
 */

import { useTranslation } from 'react-i18next';

type Props = {
  count: number;
};

export function MissOrb({ count }: Props) {
  const { t } = useTranslation();
  const state = count === 0 ? 'rested' : 'warm';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: 'var(--tma-sp-6, 24px) 0 var(--tma-sp-4, 16px)',
      }}
    >
      <div
        className="tma-tip tma-tip--below"
        data-tip={t('errors.orb.tip')}
      >
        <div
          className="tma-orb tma-orb--sm"
          data-state={state}
          role="img"
          aria-label={t('errors.orb.aria', { count })}
        >
          <span className="tma-orb__sheen" aria-hidden="true" />
          <span className="tma-orb__glare" aria-hidden="true" />
          <span className="tma-orb__num" aria-hidden="true">
            {count}
          </span>
          <span className="tma-orb__cap">{t('errors.orb.cap')}</span>
        </div>
      </div>
    </div>
  );
}
