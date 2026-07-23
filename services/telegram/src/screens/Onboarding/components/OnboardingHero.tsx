/**
 * OnboardingHero — first-run hero for the Onboarding screen (T-24).
 *
 * A day-zero variant of the signature orb: same `.tma-orb` primitive, same
 * warm ink, but the digit reads «0» with the «day one» cap — the emotional
 * carrier of the whole app introduces itself before the first review.
 *
 * Purely presentational. The screen owns Assemble slotting and CTAs.
 */

import { useTranslation } from 'react-i18next';

export function OnboardingHero() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: 'var(--tma-sp-8, 32px) 0 var(--tma-sp-5, 20px)',
      }}
    >
      <div
        className="tma-orb tma-orb--lg"
        data-state="warm"
        role="img"
        aria-label={t('onboarding.dayOne')}
      >
        <span className="tma-orb__sheen" aria-hidden="true" />
        <span className="tma-orb__glare" aria-hidden="true" />
        <span className="tma-orb__num" aria-hidden="true">
          0
        </span>
        <span className="tma-orb__cap">{t('onboarding.dayOne')}</span>
      </div>
    </div>
  );
}
