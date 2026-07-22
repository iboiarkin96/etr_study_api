/**
 * EtrMoves — the editorial peek (D3) on the Onboarding screen.
 *
 * Three rows, each one E · T · R move in one line + one prose gloss. No
 * card chrome — plain typography carries the meaning so nothing competes
 * with the day-zero orb for attention.
 */

import { useTranslation } from 'react-i18next';

export function EtrMoves() {
  const { t } = useTranslation();
  const moves = [
    { key: 'extract', body: t('onboarding.moves.extractBody') },
    { key: 'transform', body: t('onboarding.moves.transformBody') },
    { key: 'retrieve', body: t('onboarding.moves.retrieveBody') },
  ] as const;

  return (
    <ol className="tma-onboarding__moves" aria-label={t('onboarding.tagline')}>
      {moves.map((m, i) => (
        <li key={m.key} className="tma-onboarding__move">
          <span className="tma-onboarding__move-index" aria-hidden="true">
            {i + 1}
          </span>
          <div className="tma-onboarding__move-body">
            <div className="tma-onboarding__move-title">
              {t(`onboarding.moves.${m.key}`)}
            </div>
            <div className="tma-onboarding__move-copy">{m.body}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
