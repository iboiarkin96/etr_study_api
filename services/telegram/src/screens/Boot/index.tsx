/**
 * Boot screen — full-viewport splash rendered by <AuthGate> during the
 * cold-open auth handshake. Warm ember orb over the canvas surface,
 * short reassuring tagline, optional secondary hint. Fades in with a
 * 200 ms delay (CSS animation) so a fast handshake never flashes it.
 *
 * `role="status" aria-live="polite"` so AT users hear «Warming up your
 * day» when the app boots and «…» disappears silently on success.
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
        <div className="tma-boot__orb" aria-hidden="true" />
        <p className="tma-boot__tagline">{t('boot.tagline')}</p>
        <p className="tma-boot__hint">{t('boot.hint')}</p>
      </div>
    </main>
  );
}
