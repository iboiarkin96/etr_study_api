/**
 * Inline editable list — one row per string, «+ Add …» ghost button, right-
 * edge remove. Shared between bullets (`kind='bullet'`) and cue-sheet
 * questions (`kind='question'`). Auto-grows each row's textarea to fit its
 * content so long bullets don't jump the layout.
 *
 * Right-side placement of the remove affordance is deliberate — the row's
 * text field is the wide left-and-center target for the thumb, while the
 * destructive action sits at the edge where an accidental swipe won't
 * fire it (WCAG 2.5.3 target sizing + thumb-zone ergonomics).
 */

import { useEffect, useRef, type ChangeEvent } from 'react';

const MAX_LEN = 500;

type Props = {
  values: string[];
  onChange: (next: string[]) => void;
  kind: 'bullet' | 'question';
  addLabel: string;
  removeLabel: string;
  placeholder: string;
  maxItems: number;
  minItems?: number;
};

export function InlineList({
  values,
  onChange,
  kind,
  addLabel,
  removeLabel,
  placeholder,
  maxItems,
  minItems = 0,
}: Props) {
  const canAdd = values.length < maxItems;

  const setAt = (index: number, next: string) => {
    onChange(values.map((v, i) => (i === index ? next : v)));
  };

  const remove = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };

  const add = () => {
    if (!canAdd) return;
    onChange([...values, '']);
  };

  return (
    <div className="tma-composer__list">
      {values.map((value, index) => (
        <Row
          key={index}
          kind={kind}
          value={value}
          onChange={(next) => setAt(index, next)}
          onRemove={values.length > minItems ? () => remove(index) : null}
          removeLabel={removeLabel}
          placeholder={placeholder}
          autoFocus={index === values.length - 1 && value === ''}
        />
      ))}
      <button
        type="button"
        className="tma-composer__add"
        onClick={add}
        disabled={!canAdd}
        aria-label={addLabel}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span>{addLabel}</span>
      </button>
    </div>
  );
}

type RowProps = {
  kind: 'bullet' | 'question';
  value: string;
  onChange: (next: string) => void;
  onRemove: (() => void) | null;
  removeLabel: string;
  placeholder: string;
  autoFocus: boolean;
};

function Row({ kind, value, onChange, onRemove, removeLabel, placeholder, autoFocus }: RowProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
    }
  }, [autoFocus]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const onInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="tma-bullet-row" data-kind={kind}>
      <span className="tma-bullet-row__dot" aria-hidden="true" />
      <textarea
        ref={ref}
        className="tma-bullet-row__field"
        value={value}
        onChange={onInput}
        placeholder={placeholder}
        maxLength={MAX_LEN}
        rows={1}
      />
      {onRemove && (
        <div className="tma-bullet-row__actions">
          <button
            type="button"
            className="tma-bullet-row__x"
            onClick={onRemove}
            aria-label={removeLabel}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path
                d="M3 3l8 8M11 3l-8 8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
