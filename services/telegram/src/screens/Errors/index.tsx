/**
 * Errors screen — the miss log, T-20.
 *
 * Append-only journal of retrieval misses — the ETR methodology's memory
 * of «where I fell down». Composition follows Screen 05 of ADR 0038:
 *
 *   - back-header (X to Today · title · «+» add button)
 *   - Assemble choreography:
 *       hero  = MissOrb (weekly count as the breathing element)
 *       order 1 = eyebrow + list title
 *       order 2 = MissLog rows (or empty card)
 *       order 3 = «Log a miss» primary CTA (D2)
 *   - MissSheet slides up over everything when the user adds a miss;
 *     mutation is optimistic (prepend + rollback on error).
 *
 * Idempotency-Key auto-injected by the client middleware — a lost 4G
 * reply on retry never creates a duplicate row (ADR 0006).
 */

import { useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ErrorsSearch } from '../../app/router';
import { useTelegramBackButton } from '../../shared/chrome/useTelegramBackButton';
import { haptic } from '../../shared/haptics/haptics';
import { Assemble } from '../Today/components/Assemble';
import { ErrorInline } from '../Today/components/ErrorInline';
import { MissLog } from './components/MissLog';
import { MissOrb } from './components/MissOrb';
import { MissSheet } from './components/MissSheet';
import { useCreateError } from './hooks/useCreateError';
import { useErrors } from './hooks/useErrors';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

type Prefill = { conspectus_uuid: string; title: string | null };

export function Errors() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // strict:false — reads the current match's search params without pinning the
  // route id, so the screen also renders inside Storybook's in-memory router
  // (stories mount on '/'; `from: '/errors'` throws there). The app router
  // still validates the params via validateSearch on /errors.
  const search = useSearch({ strict: false }) as ErrorsSearch;
  const list = useErrors();
  const create = useCreateError();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prefill, setPrefill] = useState<Prefill | null>(null);

  // T-25d — native BackButton returns to Today.
  useTelegramBackButton(() => void navigate({ to: '/' }));

  /** Consume `?prefill_from=session&conspectus_uuid=…` exactly once per mount:
   * open the sheet, store the linked conspectus for the POST body, then strip
   * the params so a page-refresh doesn't re-open the sheet on the same row. */
  const consumedRef = useRef(false);
  useEffect(() => {
    if (consumedRef.current) return;
    if (search.prefill_from !== 'session' || !search.conspectus_uuid) return;
    consumedRef.current = true;
    setPrefill({
      conspectus_uuid: search.conspectus_uuid,
      title: search.conspectus_title ?? null,
    });
    setSheetOpen(true);
    void navigate({ to: '/errors', search: {}, replace: true });
  }, [search.prefill_from, search.conspectus_uuid, search.conspectus_title, navigate]);

  const weeklyCount = useMemo(() => {
    if (!list.data) return 0;
    const cutoff = Date.now() - WEEK_MS;
    return list.data.filter((r) => new Date(r.created_at).getTime() >= cutoff).length;
  }, [list.data]);

  // Auth loading/error handled by <AuthGate>.

  const submit = (message: string) => {
    create.mutate(
      { message, conspectus_uuid: prefill?.conspectus_uuid ?? null },
      {
        onSuccess: () => {
          haptic('notifySuccess');
          setSheetOpen(false);
          setPrefill(null);
        },
        onError: () => {
          haptic('notifyError');
        },
      },
    );
  };

  const openBlankSheet = () => {
    haptic('impactLight');
    setPrefill(null);
    setSheetOpen(true);
  };

  const hasItems = (list.data?.length ?? 0) > 0;

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
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--tma-sp-5) 0 var(--tma-sp-12)' }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--tma-sp-3)',
            padding: '0 var(--tma-sp-4)',
          }}
        >
          <button
            type="button"
            onClick={() => void navigate({ to: '/' })}
            aria-label={t('errors.back')}
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
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1
              style={{
                fontSize: 'var(--tma-fs-h3)',
                fontWeight: 'var(--tma-fw-bold)',
                margin: 0,
                color: 'var(--tma-text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              {t('errors.title')}
            </h1>
            <p
              style={{
                margin: 'var(--tma-sp-1) 0 0',
                fontSize: 'var(--tma-fs-small)',
                color: 'var(--tma-text-tertiary)',
              }}
            >
              {t('errors.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={openBlankSheet}
            aria-label={t('errors.add')}
            style={{
              appearance: 'none',
              border: 'none',
              background: 'transparent',
              color: 'var(--tma-tone-accent)',
              fontSize: 24,
              lineHeight: 1,
              padding: 'var(--tma-sp-2)',
              borderRadius: 'var(--tma-rad-2)',
              cursor: 'pointer',
              minWidth: 44,
              minHeight: 44,
              fontWeight: 'var(--tma-fw-semi)',
            }}
          >
            ＋
          </button>
        </header>

        <>
            {/* Orb — hero (fade + scale into place). */}
            <Assemble hero>
              <MissOrb count={weeklyCount} />
            </Assemble>

            {/* Eyebrow + list header (slot 1). */}
            {list.data && (
              <Assemble order={1}>
                <div
                  style={{
                    padding: '0 var(--tma-sp-4)',
                    textAlign: 'center',
                    marginBottom: 'var(--tma-sp-3)',
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      color: 'var(--tma-text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                      fontWeight: 'var(--tma-fw-semi)',
                    }}
                  >
                    {t('errors.eyebrow')}
                  </p>
                  <p
                    style={{
                      margin: 'var(--tma-sp-1) 0 0',
                      fontSize: 'var(--tma-fs-body)',
                      color: 'var(--tma-text-primary)',
                      fontWeight: 'var(--tma-fw-semi)',
                    }}
                  >
                    {hasItems
                      ? t('errors.listTitle', { count: weeklyCount })
                      : t('errors.empty.title')}
                  </p>
                </div>
              </Assemble>
            )}

            {list.isPending && <MissLogSkeleton />}
            {list.isError && (
              <div style={{ padding: 'var(--tma-sp-4)' }}>
                <ErrorInline label={t('errors.error.load')} onRetry={() => list.refetch()} />
              </div>
            )}

            {/* Rows or empty card (slot 2). */}
            {list.data && (
              <Assemble order={2}>
                <div style={{ padding: '0 var(--tma-sp-4)' }}>
                  {hasItems ? (
                    <MissLog items={list.data} />
                  ) : (
                    <div
                      style={{
                        padding: 'var(--tma-sp-5)',
                        borderRadius: 'var(--tma-rad-3)',
                        background: 'var(--tma-surface-plate)',
                        boxShadow: 'var(--tma-elev-1)',
                        textAlign: 'center',
                      }}
                    >
                      <p
                        style={{
                          margin: 0,
                          fontSize: 'var(--tma-fs-small)',
                          color: 'var(--tma-text-tertiary)',
                          lineHeight: 1.5,
                        }}
                      >
                        {t('errors.empty.body')}
                      </p>
                    </div>
                  )}
                </div>
              </Assemble>
            )}

            {/* Primary CTA (slot 3, D2 — the one hero action). */}
            {list.data && (
              <Assemble order={3}>
                <div style={{ padding: 'var(--tma-sp-5) var(--tma-sp-4) 0' }}>
                  <button
                    type="button"
                    className="tma-btn tma-btn--primary tma-btn--block"
                    onClick={openBlankSheet}
                  >
                    {t('errors.cta')} →
                  </button>
                </div>
              </Assemble>
            )}
        </>
      </div>

      <MissSheet
        open={sheetOpen}
        saving={create.isPending}
        errorText={create.isError ? t('errors.error.save') : null}
        contextLabel={
          prefill
            ? prefill.title
              ? t('errors.sheet.contextTitle', { title: prefill.title })
              : t('errors.sheet.contextGeneric')
            : null
        }
        onClose={() => {
          if (!create.isPending) {
            setSheetOpen(false);
            setPrefill(null);
            create.reset();
          }
        }}
        onSave={submit}
      />
    </main>
  );
}

function MissLogSkeleton() {
  const row = (i: number) => (
    <div
      key={i}
      style={{
        height: 40,
        borderRadius: 'var(--tma-rad-2)',
        background: 'var(--tma-surface-plate)',
        opacity: 0.6,
      }}
    />
  );
  return (
    <div
      style={{
        margin: 'var(--tma-sp-4) var(--tma-sp-4) 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--tma-sp-2)',
      }}
      aria-label="Miss log loading"
    >
      {row(0)}
      {row(1)}
      {row(2)}
    </div>
  );
}
