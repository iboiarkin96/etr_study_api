/**
 * Bottom-sheet composer for a new miss entry.
 *
 * Slides up from below with a scrim over the screen; textarea auto-focus
 * on open; Escape or scrim tap closes without saving. Save disabled when
 * the trimmed text is empty. `saving` state locks the sheet open with a
 * spinner label — parent releases when the mutation settles.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  saving: boolean;
  errorText?: string | null;
  onClose: () => void;
  onSave: (message: string) => void;
};

export function MissSheet({ open, saving, errorText, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open && ref.current) {
      ref.current.focus();
    }
    if (!open) {
      setText('');
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, saving, onClose]);

  if (!open) return null;

  const trimmed = text.trim();
  const canSave = trimmed.length > 0 && !saving;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('errors.sheet.title')}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <button
        type="button"
        aria-label={t('errors.sheet.dismiss')}
        onClick={() => !saving && onClose()}
        style={{
          position: 'absolute',
          inset: 0,
          border: 'none',
          background: 'rgba(0,0,0,0.42)',
          cursor: 'pointer',
        }}
      />
      <div
        className="tma-sheet"
        style={{
          position: 'relative',
          background: 'var(--tma-surface-plate)',
          borderTopLeftRadius: 'var(--tma-rad-4)',
          borderTopRightRadius: 'var(--tma-rad-4)',
          padding: 'var(--tma-sp-4) var(--tma-sp-4) calc(var(--tma-safe-bottom, 0px) + var(--tma-sp-5))',
          boxShadow: 'var(--tma-elev-3)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 36,
            height: 4,
            background: 'var(--tma-border-regular)',
            borderRadius: 2,
            margin: '0 auto var(--tma-sp-3)',
          }}
        />
        <p
          style={{
            margin: 0,
            fontSize: 'var(--tma-fs-small)',
            color: 'var(--tma-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 'var(--tma-fw-semi)',
          }}
        >
          {t('errors.sheet.eyebrow')}
        </p>
        <h2
          style={{
            margin: 'var(--tma-sp-1) 0 var(--tma-sp-3)',
            fontSize: 'var(--tma-fs-h3)',
            fontWeight: 'var(--tma-fw-bold)',
            color: 'var(--tma-text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {t('errors.sheet.title')}
        </h2>
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('errors.sheet.placeholder')}
          rows={4}
          maxLength={2000}
          disabled={saving}
          style={{
            width: '100%',
            minHeight: 96,
            padding: 'var(--tma-sp-3)',
            fontSize: 'var(--tma-fs-body)',
            fontFamily: 'inherit',
            lineHeight: 1.4,
            color: 'var(--tma-text-primary)',
            background: 'var(--tma-surface-canvas)',
            border: '1px solid var(--tma-border-regular)',
            borderRadius: 'var(--tma-rad-2)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {errorText && (
          <p
            role="alert"
            style={{
              margin: 'var(--tma-sp-2) 0 0',
              fontSize: 'var(--tma-fs-small)',
              color: 'var(--tma-tone-danger)',
            }}
          >
            {errorText}
          </p>
        )}
        <div
          style={{
            display: 'flex',
            gap: 'var(--tma-sp-2)',
            marginTop: 'var(--tma-sp-4)',
          }}
        >
          <button
            type="button"
            className="tma-btn"
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1 }}
          >
            {t('errors.sheet.cancel')}
          </button>
          <button
            type="button"
            className="tma-btn tma-btn--primary"
            onClick={() => onSave(trimmed)}
            disabled={!canSave}
            style={{ flex: 2 }}
          >
            {saving ? t('errors.sheet.saving') : t('errors.sheet.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
