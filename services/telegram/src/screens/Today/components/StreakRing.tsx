/**
 * Streak «ProgressRing» — a circular progress indicator wrapped around the
 * current streak count, scaled against a goal (default 30 days).
 *
 * Data source: `useDailyStats().streak` — currently mocked; swaps onto
 * `GET /api/v1/me/stats` (new) once the endpoint lands.
 *
 * Visual: two overlaid SVG circles — a soft track and an accent-coloured
 * arc whose `stroke-dashoffset` is set from the ratio `current / goal`.
 * The arc animates from 0 on mount via a plain CSS transition on
 * `stroke-dashoffset`, so no external animation library is needed.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { StreakStats } from '../hooks/useDailyStats';

type Props = { data: StreakStats; size?: number };

export function StreakRing({ data, size = 132 }: Props) {
  const { t } = useTranslation();
  const strokeWidth = size / 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const goal = Math.max(data.goalDays, 1);
  const ratio = Math.min(data.currentDays / goal, 1);

  // Animate from 0 → target on first mount.
  const [displayRatio, setDisplayRatio] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setDisplayRatio(ratio));
    rafRef.current = raf;
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [ratio]);

  const offset = circumference * (1 - displayRatio);

  return (
    <div
      role="figure"
      aria-label={t('today.streak.aria', { count: data.currentDays })}
      style={{
        display: 'flex',
        justifyContent: 'center',
        margin: '1rem 0 1.25rem',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--tg-secondary-bg-color, #232e3c)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--tg-button-color, #3390ec)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transformOrigin: '50% 50%',
              transform: 'rotate(-90deg)',
              transition: 'stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: size / 3.5,
              fontWeight: 700,
              color: 'var(--tg-text-color, #f5f5f7)',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {data.currentDays}
          </div>
          <div
            style={{
              fontSize: '0.65rem',
              color: 'var(--tg-hint-color, #708499)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginTop: 4,
            }}
          >
            {t('today.streak.unit')}
          </div>
          <div
            style={{
              fontSize: '0.6rem',
              color: 'var(--tg-hint-color, #708499)',
              marginTop: 2,
            }}
          >
            {t('today.streak.goal', { current: data.currentDays, goal: data.goalDays })}
          </div>
        </div>
      </div>
    </div>
  );
}
