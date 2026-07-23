/**
 * AchievementChips — the Profile screen's badge row.
 *
 * One chip per achievement from `GET /api/v1/me/achievements`. Unlocked
 * chips carry their tone ink; locked chips sit dimmed in neutral ink with a
 * mono `progress/target` counter — the next milestone is always visible,
 * never a mystery. Binary badges (target = 1) hide the counter when locked:
 * «0/1» reads as noise, the dimmed label already says «not yet». Unlocked
 * first; server order within each group. Keys the client doesn't know are
 * skipped silently — the server set is additive-only.
 */

import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { Achievement } from '../hooks/useMeAchievements';

type Tone = 'accent' | 'warn' | 'success' | 'info' | 'cool';

const CHIP_TONE: Record<string, Tone> = {
  first_review: 'accent',
  streak_7: 'accent',
  streak_30: 'success',
  reviews_100: 'warn',
  notes_10: 'info',
  noticer_10: 'cool',
  perfect_day: 'warn',
  comeback: 'success',
  early_bird: 'accent',
  night_owl: 'info',
  mastery_50: 'cool',
  reviews_500: 'warn',
};

const svg = (path: ReactNode) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {path}
  </svg>
);

const CHIP_ICON: Record<string, ReactNode> = {
  first_review: svg(<path d="M12 2v6M12 16v6M2 12h6M16 12h6M5 5l4 4M15 15l4 4M19 5l-4 4M9 15l-4 4" />),
  streak_7: svg(<path d="M12 22c4 0 7-3 7-7 0-4-3-5-3-9-3 2-4 5-4 7-1-1-2-2-2-4-3 2-5 4-5 8 0 3 3 5 7 5z" />),
  streak_30: svg(<path d="M12 3l9 4v6c0 5-4 9-9 9s-9-4-9-9V7z" />),
  reviews_100: svg(<path d="M12 2 15 8l7 1-5 4 1 7-6-3-6 3 1-7-5-4 7-1z" />),
  notes_10: svg(
    <>
      <path d="M4 4h13a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" />
      <path d="M8 8h8M8 12h8" />
    </>,
  ),
  noticer_10: svg(
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  perfect_day: svg(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>,
  ),
  comeback: svg(<path d="M20 11a8 8 0 1 0-2.3 6.3M20 4v7h-7" />),
  early_bird: svg(
    <>
      <path d="M4 18h16M6 18a6 6 0 0 1 12 0" />
      <path d="M12 6V3M7.8 7.8 5.7 5.7M16.2 7.8l2.1-2.1" />
    </>,
  ),
  night_owl: svg(<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10z" />),
  mastery_50: svg(
    <>
      <path d="M6 3h12l4 6-10 12L2 9z" />
      <path d="M2 9h20M12 21 8 9l4-6 4 6z" />
    </>,
  ),
  reviews_500: svg(
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 6H4a3 3 0 0 0 3 5M17 6h3a3 3 0 0 1-3 5" />
    </>,
  ),
};

type Props = {
  items: readonly Achievement[];
};

export function AchievementChips({ items }: Props) {
  const { t } = useTranslation();
  // Additive contract: silently skip keys this build doesn't know.
  const known = items.filter((a) => a.key in CHIP_ICON);
  const ordered = [...known.filter((a) => a.unlocked), ...known.filter((a) => !a.unlocked)];

  return (
    <ul className="tma-profile__ach-row" aria-label={t('profile.ach.rowAria')}>
      {ordered.map((a) => {
        const showFraction = !a.unlocked && a.target > 1;
        return (
          <li
            key={a.key}
            className="tma-profile__ach-chip"
            data-tone={CHIP_TONE[a.key] ?? 'accent'}
            data-unlocked={a.unlocked ? 'true' : 'false'}
            aria-label={
              a.unlocked
                ? t(`profile.ach.${a.key}`)
                : showFraction
                  ? t('profile.ach.progressAria', {
                      label: t(`profile.ach.${a.key}`),
                      progress: a.progress,
                      target: a.target,
                    })
                  : t('profile.ach.lockedAria', { label: t(`profile.ach.${a.key}`) })
            }
          >
            <span className="tma-profile__ach-icon">{CHIP_ICON[a.key]}</span>
            <span className="tma-profile__ach-label">{t(`profile.ach.${a.key}`)}</span>
            {showFraction && (
              <span className="tma-profile__ach-progress" aria-hidden="true">
                {a.progress}/{a.target}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
