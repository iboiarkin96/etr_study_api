/**
 * Append-only list of miss rows — `.tma-miss-log` + `.tma-miss-row`.
 *
 * Read-only (no swipe, no delete). The tone dot goes warmer as the
 * entry gets older: today = ember (default), yesterday = warn, 2+ days
 * ago = rested (sage). Time chip is a compact relative label
 * («09:12», «yest», «3d») — cheap enough to compute per-row on client.
 */

import { useTranslation } from 'react-i18next';

import type { LearningError } from '../hooks/useErrors';

type Props = {
  items: LearningError[];
};

type Tone = 'accent' | 'warn' | 'rested';

function relative(iso: string, now: number): { tone: Tone; time: string } {
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (diffMs < oneDayMs) {
    const d = new Date(then);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return { tone: 'accent', time: `${hh}:${mm}` };
  }
  if (diffMs < 2 * oneDayMs) {
    return { tone: 'warn', time: 'yest' };
  }
  const days = Math.floor(diffMs / oneDayMs);
  return { tone: 'rested', time: `${days}d` };
}

export function MissLog({ items }: Props) {
  const { t } = useTranslation();
  const now = Date.now();

  return (
    <div
      className="tma-miss-log"
      role="list"
      aria-label={t('errors.list.aria')}
    >
      {items.map((item) => {
        const { tone, time } = relative(item.created_at, now);
        return (
          <div
            key={item.error_uuid}
            className="tma-miss-row"
            data-tone={tone === 'accent' ? undefined : tone}
            role="listitem"
          >
            <span className="tma-miss-row__dot" aria-hidden="true" />
            <span className="tma-miss-row__text">{item.message}</span>
            <span className="tma-miss-row__time" aria-label={item.created_at}>
              {time}
            </span>
          </div>
        );
      })}
    </div>
  );
}
