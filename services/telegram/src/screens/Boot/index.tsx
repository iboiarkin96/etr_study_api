/**
 * BootScreen — full-viewport splash rendered by <AuthGate> while the
 * cold-open `/api/v1/auth/telegram` handshake is in flight.
 *
 * Design matches the app's error state (see `Today/components/ErrorScreen`)
 * so success and failure share the same visual language: an ember dot on
 * an orbit ring over a soft radial glow. Where ErrorScreen freezes the
 * dot off-axis with a dashed ring («connection broken»), BootScreen
 * animates the dot around a continuous ring («connection warming up»).
 *
 * `role="status" aria-live="polite" aria-busy="true"` so AT users hear the
 * tagline on boot and silence on success. Motion respects
 * `prefers-reduced-motion` — the orbit collapses to a static frame.
 */

import { useTranslation } from 'react-i18next';

export function BootScreen() {
  const { t } = useTranslation();
  return (
    <main
      className="tma-scope tma-boot"
      data-density="regular"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="tma-boot__inner">
        <OrbitLoader />
        <h1 className="tma-boot__title">{t('boot.tagline')}</h1>
        <p className="tma-boot__hint">{t('boot.hint')}</p>
      </div>
    </main>
  );
}

/** Ember dot orbiting a continuous ring — same 120×120 canvas + radial
 *  glow ErrorScreen uses, so the two states read as siblings. The dot is
 *  drawn at 12 o'clock inside a group whose transform-origin sits at the
 *  ring's centre; CSS rotates the group to run the dot around the loop. */
function OrbitLoader() {
  return (
    <svg
      width="120"
      height="120"
      viewBox="0 0 120 120"
      role="img"
      aria-hidden="true"
      style={{ marginBottom: 'var(--tma-sp-2)' }}
    >
      <defs>
        <radialGradient id="boot-orb-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="var(--tma-ember-400)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--tma-ember-400)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Soft ember glow — same source as ErrorScreen's glow. */}
      <circle cx="60" cy="60" r="55" fill="url(#boot-orb-glow)" />

      {/* Continuous outer ring — the orbit the dot travels. */}
      <circle
        cx="60"
        cy="60"
        r="42"
        fill="none"
        stroke="var(--tma-border-bold)"
        strokeWidth="1.5"
        strokeOpacity="0.55"
      />

      {/* Rotating arm — dot at 12 o'clock + a short trailing arc that
       *  fades behind it, so the direction of travel reads at a glance. */}
      <g
        className="tma-boot__orbit-arm"
        style={{ transformOrigin: '60px 60px' }}
      >
        <circle
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke="var(--tma-ember-500)"
          strokeWidth="2"
          strokeOpacity="0.55"
          pathLength={100}
          strokeDasharray="16 84"
          strokeDashoffset={100 - 16}
          strokeLinecap="round"
        />
        {/* Ember dot */}
        <circle cx="60" cy="18" r="6" fill="var(--tma-ember-500)" />
        <circle
          cx="60"
          cy="18"
          r="10"
          fill="none"
          stroke="var(--tma-ember-500)"
          strokeWidth="1.5"
          strokeOpacity="0.4"
        />
      </g>
    </svg>
  );
}
