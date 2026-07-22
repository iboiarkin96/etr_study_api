/**
 * Onboarding screen — first-run flow, T-24.
 *
 * Screen 08 of ADR 0038, Amie signature («Living hello»): day-zero orb as
 * the hero (D1), one primary CTA («Start today →», D2), three E · T · R
 * moves as the editorial peek (D3), single ember accent (D4). The user
 * lands here on the first cold open and never again — Today's router gate
 * redirects here while `onboarding_done` is missing, and `markSeen()`
 * writes the flag + navigates to `/` in one commit.
 *
 * Deliberately absent — no illustration carousel, no name-your-goal form,
 * no 3-step wizard. The whole surface is one screen so «time to first
 * review» stays under 10 seconds. The «Skip» affordance is a quiet ghost:
 * available for the maintainer who reinstalls, invisible to the eye that
 * scans headline → CTA.
 */

import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { haptic } from '../../shared/haptics/haptics';
import { Assemble } from '../Today/components/Assemble';
import { EtrMoves } from './components/EtrMoves';
import { OnboardingHero } from './components/OnboardingHero';
import { useOnboardingSeen } from './hooks/useOnboardingSeen';

export function Onboarding() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { markSeen } = useOnboardingSeen();

  const finish = () => {
    haptic('impactLight');
    markSeen();
    void navigate({ to: '/' });
  };

  return (
    <main
      className="tma-scope"
      data-density="regular"
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        paddingTop: 'var(--tma-safe-top, 0)',
        paddingBottom: 'var(--tma-safe-bottom, 0)',
        background: 'var(--tma-surface-canvas)',
        color: 'var(--tma-text-primary)',
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: 'var(--tma-sp-4) 0 var(--tma-sp-12)',
        }}
      >
        <Assemble hero>
          <OnboardingHero />
        </Assemble>

        <Assemble order={1}>
          <div className="tma-onboarding__head">
            <p className="tma-onboarding__eyebrow">{t('onboarding.welcome')}</p>
            <h1 className="tma-onboarding__title">
              {t('onboarding.headline')}
              <br />
              {t('onboarding.headline2')}
            </h1>
            <p className="tma-onboarding__tagline">{t('onboarding.tagline')}</p>
          </div>
        </Assemble>

        <Assemble order={2}>
          <div className="tma-onboarding__body">
            <EtrMoves />
          </div>
        </Assemble>

        <Assemble order={3}>
          <div className="tma-onboarding__cta">
            <button
              type="button"
              className="tma-btn tma-btn--primary tma-btn--block"
              onClick={finish}
            >
              {t('onboarding.cta')}
            </button>
            <button type="button" className="tma-onboarding__skip" onClick={finish}>
              {t('onboarding.skip')}
            </button>
            <p className="tma-onboarding__foot">{t('onboarding.footNote')}</p>
          </div>
        </Assemble>
      </div>
    </main>
  );
}
