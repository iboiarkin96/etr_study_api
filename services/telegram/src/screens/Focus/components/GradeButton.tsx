/**
 * GradeButton — one of four buttons on the Focus grade strip.
 *
 * Encodes the (grade → tag → tone → hotkey) fourfold contract via the
 * imported `GRADES` array (see `./grade-spec.ts`) so screens using it
 * can't accidentally paint an Easy button with warn tint or bind grade
 * `hard` to key `1`. The primitive itself is pure UI — the parent wires
 * the mutation.
 *
 * Anatomy:
 *   .tma-focus__grade                    root button
 *   .tma-focus__grade[data-tone]         accent | warn | danger | success
 *   .tma-focus__grade-kbd (desktop only) mono digit for the hotkey
 */

import { forwardRef } from 'react';

import type { FocusGrade } from '../hooks/useFocusSession';
import type { GradeSpec } from './grade-spec';

type Props = {
  spec: GradeSpec;
  label: string;
  onPress: (grade: FocusGrade) => void;
  disabled?: boolean;
  showHotkey?: boolean;
};

export const GradeButton = forwardRef<HTMLButtonElement, Props>(function GradeButton(
  { spec, label, onPress, disabled = false, showHotkey = false },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className="tma-focus__grade"
      data-grade={spec.grade}
      data-tone={spec.tone}
      onClick={() => onPress(spec.grade)}
      disabled={disabled}
      aria-keyshortcuts={spec.hotkey}
    >
      <span className="tma-focus__grade-label">{label}</span>
      {showHotkey && <span className="tma-focus__grade-kbd">{spec.hotkey}</span>}
    </button>
  );
});
