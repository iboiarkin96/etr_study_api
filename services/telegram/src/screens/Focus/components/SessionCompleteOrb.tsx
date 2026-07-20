/**
 * SessionCompleteOrb — the ring-around-orb visual for Focus session end.
 *
 * Renders the streak-orb primitive wrapped in `.tma-orb-ring` so the
 * session's accuracy fills a conic arc around it. Ring ink + orb state
 * flip together per scenario so the outcome reads before the copy does:
 *
 *   celebrate — accuracy ≥ 80 % AND zero «Again» → sage full ring, orb
 *               pulses once (data-state='celebrate' reuses StreakOrb's
 *               milestone animation)
 *   solid     — otherwise if accuracy ≥ 50 %     → ember partial arc,
 *               orb rests warm
 *   rough     — accuracy < 50 % OR many «Again» → warn partial arc,
 *               orb rests warm (no dour tint; the ring carries the signal)
 *
 * «Accuracy» = (easy + good) / graded — the client's 4-grade counter
 * from SessionSummary.perGrade. Ratios stay client-side; nothing about
 * the outcome is persisted server-side yet.
 *
 * The scenario resolver lives in `./session-scenario.ts` so this file
 * exports only components (Fast Refresh requirement); consumers that
 * want to derive title/body copy from the scenario import it directly.
 */

import type { SessionSummary } from '../hooks/useFocusSession';
import { resolveScenario } from './session-scenario';

type Props = {
  summary: SessionSummary;
};

export function SessionCompleteOrb({ summary }: Props) {
  const scenario = resolveScenario(summary);
  const total = summary.graded;
  const correct = summary.perGrade.easy + summary.perGrade.good;
  const progress = total > 0 ? correct / total : 0;

  // `celebrate` scenario reuses the StreakOrb's milestone pulse animation
  // via data-state; the other scenarios stay in `warm` so only the ring
  // carries the outcome signal (avoids a dour orb after a rough session).
  const orbState = scenario === 'celebrate' ? 'celebrate' : 'warm';

  return (
    <div
      className="tma-focus__complete-visual"
      role="img"
      aria-label={ariaLabel(scenario, total, correct)}
    >
      <div
        className="tma-orb-ring"
        data-scenario={scenario}
        style={{ ['--ring-progress' as string]: progress }}
      >
        <div className="tma-orb" data-state={orbState}>
          <span className="tma-orb__sheen" aria-hidden="true" />
          <span className="tma-orb__glare" aria-hidden="true" />
          <span className="tma-orb__num">{total}</span>
          <span className="tma-orb__cap">graded</span>
        </div>
      </div>
    </div>
  );
}

function ariaLabel(scenario: ReturnType<typeof resolveScenario>, total: number, correct: number): string {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const base = `${correct} of ${total} graded easy or good (${pct}% accuracy)`;
  const suffix =
    scenario === 'celebrate' ? ' — clean sweep' :
    scenario === 'rough' ? ' — tricky session' : '';
  return base + suffix;
}
