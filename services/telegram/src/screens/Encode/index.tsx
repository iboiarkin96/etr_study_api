/**
 * Encode screen — the ETR conspectus authoring surface.
 *
 * Route: `/encode`. Opened from Today's «+» in the top-right (T-25d chrome
 * pattern). One screen, one job: turn a fresh thought into a stored
 * conspectus (`POST /api/v1/conspectuses`).
 *
 * Chrome:
 *   - Telegram BackButton → «/» (Today).
 *   - Telegram MainButton = «Save encode»; the SDK button sits at the
 *     bottom of the viewport at all times, equally reachable by either
 *     thumb — the reason we don't paint our own primary CTA in-page.
 *     Unmounts (hides) when the draft isn't submittable so a partial
 *     conspectus can't reach the server.
 *
 * Success path: haptic notifySuccess + toast + navigate back to «/». The
 * created row is invalidated on the Today due list + Search list caches
 * inside the mutation hook, so it lands in place on the next screen.
 */

import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsTelegramClient } from '../../shared/chrome/useIsTelegramClient';
import { useTelegramBackButton } from '../../shared/chrome/useTelegramBackButton';
import { useTelegramMainButton } from '../../shared/chrome/useTelegramMainButton';
import { haptic } from '../../shared/haptics/haptics';
import { useToast } from '../../shared/toast/toast';
import {
  EncodeComposer,
  emptyDraft,
  isDraftSubmittable,
  type EncodeDraft,
} from './components/EncodeComposer';
import { useCreateConspectus } from './hooks/useCreateConspectus';

export function Encode() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isTelegramClient = useIsTelegramClient();
  const { toast } = useToast();
  const create = useCreateConspectus();

  const [draft, setDraft] = useState<EncodeDraft>(emptyDraft);
  const [attempted, setAttempted] = useState(false);

  const goHome = () => void navigate({ to: '/' });
  useTelegramBackButton(goHome);

  const canSubmit = isDraftSubmittable(draft) && !create.isPending;

  const submit = () => {
    setAttempted(true);
    if (!isDraftSubmittable(draft)) {
      haptic('notifyError');
      return;
    }
    const cue_sheet: { terms?: string[]; questions?: string[] } = {};
    if (draft.terms.length > 0) cue_sheet.terms = draft.terms;
    const questions = draft.questions.map((q) => q.trim()).filter((q) => q.length > 0);
    if (questions.length > 0) cue_sheet.questions = questions;

    create.mutate(
      {
        title: draft.title.trim().length > 0 ? draft.title : null,
        dense_paragraph: draft.denseParagraph.trim(),
        bullets: draft.bullets.map((b) => b.trim()).filter((b) => b.length > 0),
        cue_sheet,
      },
      {
        onSuccess: () => {
          haptic('notifySuccess');
          toast({ tone: 'success', message: t('encode.toast.saved') });
          goHome();
        },
        onError: () => {
          haptic('notifyError');
          toast({ tone: 'error', message: t('encode.toast.saveFailed') });
        },
      },
    );
  };

  // Bind MainButton only when the draft is submittable — hides the
  // native button until the required fields are in.
  useTelegramMainButton(
    canSubmit
      ? { text: create.isPending ? t('encode.saving') : t('encode.save'), onClick: submit }
      : null,
  );

  return (
    <main
      className="tma-scope"
      data-density="regular"
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        paddingTop: 'var(--tma-safe-top, 0)',
        paddingBottom: 'var(--tma-safe-bottom, 0)',
        background: 'var(--tma-surface-canvas)',
        color: 'var(--tma-text-primary)',
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: 'var(--tma-sp-5) var(--tma-sp-4) 0',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 'var(--tma-sp-3)',
            marginBottom: 'var(--tma-sp-5)',
          }}
        >
          {!isTelegramClient && (
            <button
              type="button"
              onClick={goHome}
              aria-label={t('encode.back')}
              style={{
                appearance: 'none',
                border: 'none',
                background: 'transparent',
                color: 'var(--tma-text-tertiary)',
                fontSize: 'var(--tma-fs-lead)',
                padding: 'var(--tma-sp-2)',
                borderRadius: 'var(--tma-rad-2)',
                cursor: 'pointer',
                minWidth: 44,
                minHeight: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ‹
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--tma-font-mono)',
                fontSize: 'var(--tma-fs-micro)',
                fontWeight: 'var(--tma-fw-semi)',
                textTransform: 'uppercase',
                letterSpacing: 'var(--tma-tr-wide)',
                color: 'var(--tma-text-tertiary)',
              }}
            >
              {t('encode.eyebrow')}
            </p>
            <h1
              style={{
                margin: 'var(--tma-sp-1) 0 0',
                fontSize: 'var(--tma-fs-h2)',
                fontWeight: 'var(--tma-fw-bold)',
                color: 'var(--tma-text-primary)',
                letterSpacing: 'var(--tma-tr-tight)',
                lineHeight: 'var(--tma-lh-tight)',
              }}
            >
              {t('encode.title')}
            </h1>
            <p
              style={{
                margin: 'var(--tma-sp-2) 0 0',
                fontSize: 'var(--tma-fs-body)',
                color: 'var(--tma-text-secondary)',
                lineHeight: 'var(--tma-lh-normal)',
                maxWidth: 480,
              }}
            >
              {t('encode.subtitle')}
            </p>
          </div>
        </header>

        <EncodeComposer draft={draft} onChange={setDraft} showErrors={attempted} />

        {/* Fallback CTA — only for non-Telegram web previews (dev tunnels,
             Storybook), so the story is testable without the SDK. In the
             real app the Telegram MainButton is the only path to submit. */}
        {!isTelegramClient && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              padding: 'var(--tma-sp-4) 0 var(--tma-sp-6)',
              background:
                'linear-gradient(to bottom, transparent, var(--tma-surface-canvas) 40%)',
            }}
          >
            <button
              type="button"
              className="tma-btn tma-btn--primary tma-btn--block"
              onClick={submit}
              disabled={!canSubmit}
            >
              {create.isPending ? t('encode.saving') : t('encode.save')}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
