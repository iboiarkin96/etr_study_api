/**
 * Term chip input for `cue_sheet.terms[]`.
 *
 * Tokenised entry: text typed into the trailing entry field commits into
 * a chip on Enter or comma. Chips are removable via their «×» affordance
 * — right-edge placement keeps the tap target under the right thumb, the
 * dominant hand in most one-handed mobile use.
 */

import { useState, type KeyboardEvent } from 'react';

const TERM_MAX_LEN = 64;

type Props = {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  removeLabel: (value: string) => string;
};

export function TermChipInput({ values, onChange, placeholder, removeLabel }: Props) {
  const [entry, setEntry] = useState('');

  const commit = () => {
    const trimmed = entry.trim().slice(0, TERM_MAX_LEN);
    if (!trimmed) return;
    if (values.includes(trimmed)) {
      setEntry('');
      return;
    }
    onChange([...values, trimmed]);
    setEntry('');
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === 'Backspace' && entry.length === 0 && values.length > 0) {
      event.preventDefault();
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="tma-chip-input">
      {values.map((value, index) => (
        <span key={`${value}-${index}`} className="tma-chip">
          <span className="tma-chip__text">{value}</span>
          <button
            type="button"
            className="tma-chip__x"
            aria-label={removeLabel(value)}
            onClick={() => onChange(values.filter((_, i) => i !== index))}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        className="tma-chip-input__entry"
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        placeholder={values.length === 0 ? placeholder : ''}
        maxLength={TERM_MAX_LEN}
        aria-label={placeholder}
      />
    </div>
  );
}
