/**
 * The three-phase Encode composer — a 1:1 UI mapping of the ETR content
 * roles onto the `POST /api/v1/conspectuses` contract:
 *
 *   01 · Encode  → dense_paragraph (required, 1..4000)  + optional title
 *   02 · Trigger → cue_sheet.terms[] + cue_sheet.questions[] (both optional)
 *   03 · Recall  → bullets[]        (required, 1..20 × 1..500)
 *
 * The stateful shape (`EncodeDraft`) is owned by the parent screen so the
 * MainButton binding and Storybook fixtures can read the same source. The
 * composer only renders + emits changes.
 */

import { useTranslation } from 'react-i18next';

import { InlineList } from './InlineList';
import { TermChipInput } from './TermChipInput';

export const LIMITS = {
  title: 256,
  denseParagraph: 4000,
  bullet: 500,
  bullets: 20,
  questions: 20,
  terms: 20,
} as const;

export type EncodeDraft = {
  title: string;
  denseParagraph: string;
  terms: string[];
  questions: string[];
  bullets: string[];
};

export function emptyDraft(): EncodeDraft {
  return {
    title: '',
    denseParagraph: '',
    terms: [],
    questions: [],
    // Start with one empty bullet so the recall block reads as a promise,
    // not a bare «+ Add» button. Minimum enforced on submit, not on typing.
    bullets: [''],
  };
}

export type PhaseState = 'empty' | 'filled';

export function draftPhases(draft: EncodeDraft): [PhaseState, PhaseState, PhaseState] {
  const encode: PhaseState = draft.denseParagraph.trim().length > 0 ? 'filled' : 'empty';
  const trigger: PhaseState =
    draft.terms.length > 0 || draft.questions.some((q) => q.trim().length > 0)
      ? 'filled'
      : 'empty';
  const recall: PhaseState = draft.bullets.some((b) => b.trim().length > 0) ? 'filled' : 'empty';
  return [encode, trigger, recall];
}

/** All required fields present + within limits — MainButton unlock signal. */
export function isDraftSubmittable(draft: EncodeDraft): boolean {
  const dense = draft.denseParagraph.trim();
  if (dense.length === 0 || dense.length > LIMITS.denseParagraph) return false;
  const bullets = draft.bullets.map((b) => b.trim()).filter((b) => b.length > 0);
  if (bullets.length === 0 || bullets.length > LIMITS.bullets) return false;
  if (bullets.some((b) => b.length > LIMITS.bullet)) return false;
  if (draft.title.trim().length > LIMITS.title) return false;
  return true;
}

type Props = {
  draft: EncodeDraft;
  onChange: (next: EncodeDraft) => void;
  /** Whether to render inline validation errors under each phase. Set true
   *  once the user attempted Save; suppresses noise on a blank draft. */
  showErrors: boolean;
};

export function EncodeComposer({ draft, onChange, showErrors }: Props) {
  const { t } = useTranslation();
  const phases = draftPhases(draft);
  const complete = phases.every((p) => p === 'filled');

  const patch = (partial: Partial<EncodeDraft>) => onChange({ ...draft, ...partial });

  const denseLen = draft.denseParagraph.length;
  const denseState =
    denseLen > LIMITS.denseParagraph
      ? 'over'
      : denseLen > LIMITS.denseParagraph * 0.9
        ? 'warn'
        : undefined;

  const bulletsNonEmpty = draft.bullets.filter((b) => b.trim().length > 0);

  return (
    <div className="tma-composer">
      {/* Progress ribbon — three ETR dots. */}
      <div
        className="tma-composer__ribbon"
        data-state={complete ? 'complete' : 'partial'}
        role="progressbar"
        aria-valuenow={phases.filter((p) => p === 'filled').length}
        aria-valuemin={0}
        aria-valuemax={3}
        aria-label={t('encode.ribbon.aria')}
      >
        <span className="tma-composer__ribbon-dots">
          {phases.map((state, i) => (
            <span key={i} className="tma-composer__dot" data-state={state} />
          ))}
        </span>
        <span className="tma-composer__ribbon-label">
          {complete ? t('encode.ribbon.ready') : t('encode.ribbon.label')}
        </span>
      </div>

      {/* ─── 01 · Encode ────────────────────────────────────────────── */}
      <section className="tma-composer__phase" aria-labelledby="encode-phase-1">
        <div className="tma-composer__phase-head">
          <p className="tma-composer__eyebrow" id="encode-phase-1">
            <span className="tma-composer__eyebrow-num">01</span> · {t('encode.phases.encode.eyebrow')}
          </p>
          <TitleChip
            value={draft.title}
            onChange={(next) => patch({ title: next })}
            placeholder={t('encode.titleField.placeholder')}
            ariaLabel={t('encode.titleField.aria')}
          />
        </div>
        <p className="tma-composer__prompt">
          {t('encode.phases.encode.prompt')}
          <span className="tma-composer__req">{t('encode.required')}</span>
        </p>
        <p className="tma-composer__hint">{t('encode.phases.encode.hint')}</p>
        <div className="tma-textarea__row">
          <textarea
            className="tma-textarea"
            value={draft.denseParagraph}
            onChange={(e) => patch({ denseParagraph: e.target.value })}
            placeholder={t('encode.phases.encode.placeholder')}
            maxLength={LIMITS.denseParagraph}
            rows={5}
            data-invalid={
              showErrors && draft.denseParagraph.trim().length === 0 ? 'true' : undefined
            }
            aria-label={t('encode.phases.encode.eyebrow')}
          />
          <span className="tma-textarea__counter" data-state={denseState}>
            {denseLen} / {LIMITS.denseParagraph}
          </span>
        </div>
        {showErrors && draft.denseParagraph.trim().length === 0 && (
          <p className="tma-composer__error" role="alert">
            {t('encode.errors.denseRequired')}
          </p>
        )}
      </section>

      {/* ─── 02 · Trigger ───────────────────────────────────────────── */}
      <section className="tma-composer__phase" aria-labelledby="encode-phase-2">
        <div className="tma-composer__phase-head">
          <p className="tma-composer__eyebrow" id="encode-phase-2">
            <span className="tma-composer__eyebrow-num">02</span> · {t('encode.phases.trigger.eyebrow')}
          </p>
          <span className="tma-composer__opt">{t('encode.optional')}</span>
        </div>
        <p className="tma-composer__prompt">{t('encode.phases.trigger.terms.prompt')}</p>
        <TermChipInput
          values={draft.terms}
          onChange={(next) => patch({ terms: next.slice(0, LIMITS.terms) })}
          placeholder={t('encode.phases.trigger.terms.placeholder')}
          removeLabel={(v) => t('encode.phases.trigger.terms.remove', { term: v })}
        />
        <p className="tma-composer__hint">{t('encode.phases.trigger.terms.hint')}</p>

        <p
          className="tma-composer__prompt"
          style={{ marginTop: 'var(--tma-sp-3)' }}
        >
          {t('encode.phases.trigger.questions.prompt')}
        </p>
        <InlineList
          values={draft.questions}
          kind="question"
          onChange={(next) => patch({ questions: next })}
          addLabel={t('encode.phases.trigger.questions.add')}
          removeLabel={t('encode.phases.trigger.questions.remove')}
          placeholder={t('encode.phases.trigger.questions.placeholder')}
          maxItems={LIMITS.questions}
        />
      </section>

      {/* ─── 03 · Recall ────────────────────────────────────────────── */}
      <section className="tma-composer__phase" aria-labelledby="encode-phase-3">
        <div className="tma-composer__phase-head">
          <p className="tma-composer__eyebrow" id="encode-phase-3">
            <span className="tma-composer__eyebrow-num">03</span> · {t('encode.phases.recall.eyebrow')}
          </p>
          <span className="tma-composer__req">{t('encode.required')}</span>
        </div>
        <p className="tma-composer__prompt">{t('encode.phases.recall.prompt')}</p>
        <p className="tma-composer__hint">{t('encode.phases.recall.hint')}</p>
        <InlineList
          values={draft.bullets}
          kind="bullet"
          onChange={(next) => patch({ bullets: next })}
          addLabel={t('encode.phases.recall.add')}
          removeLabel={t('encode.phases.recall.remove')}
          placeholder={t('encode.phases.recall.placeholder')}
          maxItems={LIMITS.bullets}
          minItems={1}
        />
        {showErrors && bulletsNonEmpty.length === 0 && (
          <p className="tma-composer__error" role="alert">
            {t('encode.errors.bulletsRequired')}
          </p>
        )}
      </section>
    </div>
  );
}

type TitleChipProps = {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
};

function TitleChip({ value, onChange, placeholder, ariaLabel }: TitleChipProps) {
  const filled = value.trim().length > 0;
  return (
    <label className="tma-title-chip" data-state={filled ? 'filled' : 'empty'}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M2 3h8M2 6h8M2 9h5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="text"
        className="tma-title-chip__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={LIMITS.title}
        aria-label={ariaLabel}
      />
    </label>
  );
}
