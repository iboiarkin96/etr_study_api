/**
 * NudgeSheet — bottom-sheet editor for the daily reminder.
 *
 * Same modal anatomy as MissSheet: scrim + slide-up `.tma-sheet` panel,
 * capture-phase Escape containment (Profile binds Esc → back-to-Today on the
 * same window), `saving` lock. Contents: an accessible switch + a native
 * time input + Cancel/Save. Draft state is local; the parent commits via
 * `useUpdateReminder` and closes on success.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  open: boolean;
  saving: boolean;
  errorText?: string | null;
  /** Current server state the draft starts from. */
  enabled: boolean;
  time: string;
  onClose: () => void;
  onSave: (draft: { enabled: boolean; time: string }) => void;
};

export function NudgeSheet({ open, saving, errorText, enabled, time, onClose, onSave }: Props) {
  const { t } = useTranslation();
  const [draftEnabled, setDraftEnabled] = useState(enabled);
  const [draftTime, setDraftTime] = useState(time);

  useEffect(() => {
    if (open) {
      setDraftEnabled(enabled);
      setDraftTime(time);
    }
  }, [open, enabled, time]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Capture-phase + stopPropagation — same containment contract as
      // MissSheet: while the sheet is modal, Escape must never reach the
      // screen-level «exit» binding underneath.
      e.stopPropagation();
      if (!saving) onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, saving, onClose]);

  if (!open) return null;

  const canSave = !saving && /^([01]\d|2[0-3]):[0-5]\d$/.test(draftTime);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.nudge.sheet.title')}
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
        aria-label={t('profile.nudge.sheet.dismiss')}
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
          {t('profile.nudge.sheet.eyebrow')}
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
          {t('profile.nudge.sheet.title')}
        </h2>

        <div className="tma-profile__nudge-controls">
          <button
            type="button"
            role="switch"
            aria-checked={draftEnabled}
            className="tma-profile__nudge-switch"
            data-on={draftEnabled ? 'true' : 'false'}
            disabled={saving}
            onClick={() => setDraftEnabled((v) => !v)}
          >
            <span className="tma-profile__nudge-switch-label">
              {t('profile.nudge.sheet.toggleLabel')}
            </span>
            <span className="tma-profile__nudge-switch-track" aria-hidden="true">
              <span className="tma-profile__nudge-switch-thumb" />
            </span>
          </button>

          <label className="tma-profile__nudge-time" data-disabled={!draftEnabled || saving ? 'true' : 'false'}>
            <span className="tma-profile__nudge-time-label">{t('profile.nudge.sheet.timeLabel')}</span>
            <input
              type="time"
              value={draftTime}
              disabled={saving || !draftEnabled}
              onChange={(e) => setDraftTime(e.target.value)}
            />
          </label>
        </div>

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

        <div style={{ display: 'flex', gap: 'var(--tma-sp-2)', marginTop: 'var(--tma-sp-4)' }}>
          <button
            type="button"
            className="tma-btn"
            onClick={onClose}
            disabled={saving}
            style={{ flex: 1 }}
          >
            {t('profile.nudge.sheet.cancel')}
          </button>
          <button
            type="button"
            className="tma-btn tma-btn--primary"
            onClick={() => onSave({ enabled: draftEnabled, time: draftTime })}
            disabled={!canSave}
            style={{ flex: 2 }}
          >
            {saving ? t('profile.nudge.sheet.saving') : t('profile.nudge.sheet.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
