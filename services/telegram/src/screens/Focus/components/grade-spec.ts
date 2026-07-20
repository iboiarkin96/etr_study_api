/**
 * Canonical GradeSpec — pulled out of `GradeButton.tsx` so Fast Refresh
 * treats the component file as pure-component, and so tests / docs can
 * import the (grade → label → tone → hotkey) contract without pulling
 * React into the graph.
 */

import type { FocusGrade } from '../hooks/useFocusSession';

export type GradeSpec = {
  grade: FocusGrade;
  labelKey: `focus.grade.${FocusGrade}`;
  tone: 'danger' | 'warn' | 'accent' | 'success';
  hotkey: '1' | '2' | '3' | '4';
};

/** Canonical order — worst → best. Matches the mock, the keyboard
 * hotkeys, and the server-tag ladder. */
export const GRADES: readonly GradeSpec[] = [
  { grade: 'again', labelKey: 'focus.grade.again', tone: 'danger', hotkey: '1' },
  { grade: 'hard', labelKey: 'focus.grade.hard', tone: 'warn', hotkey: '2' },
  { grade: 'good', labelKey: 'focus.grade.good', tone: 'accent', hotkey: '3' },
  { grade: 'easy', labelKey: 'focus.grade.easy', tone: 'success', hotkey: '4' },
];
