/**
 * Canonical GradeSpec — pulled out of `GradeButton.tsx` so Fast Refresh
 * treats the component file as pure-component, and so tests / docs can
 * import the (grade → label → tone → hotkey) contract without pulling
 * React into the graph.
 */

import type { HapticTone } from '../../../shared/haptics/haptics';
import type { FocusGrade } from '../hooks/useFocusSession';

export type GradeSpec = {
  grade: FocusGrade;
  labelKey: `focus.grade.${FocusGrade}`;
  tone: 'danger' | 'warn' | 'accent' | 'success';
  hotkey: '1' | '2' | '3' | '4';
  /** Haptic tone fired on press — heaviest for Again (miss acknowledgement),
   * softest for Good/Easy. Keyboard shortcuts route through the same map so
   * a Space-Reveal + 1-Grade chord feels identical to a tap. */
  haptic: HapticTone;
};

/** Canonical order — worst → best. Matches the mock, the keyboard
 * hotkeys, and the server-tag ladder. */
export const GRADES: readonly GradeSpec[] = [
  { grade: 'again', labelKey: 'focus.grade.again', tone: 'danger', hotkey: '1', haptic: 'impactHeavy' },
  { grade: 'hard', labelKey: 'focus.grade.hard', tone: 'warn', hotkey: '2', haptic: 'impactMedium' },
  { grade: 'good', labelKey: 'focus.grade.good', tone: 'accent', hotkey: '3', haptic: 'impactLight' },
  { grade: 'easy', labelKey: 'focus.grade.easy', tone: 'success', hotkey: '4', haptic: 'impactLight' },
];
