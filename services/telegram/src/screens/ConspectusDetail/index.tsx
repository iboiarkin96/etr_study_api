/**
 * Conspectus detail screen — read-only view of one ETR note (T-17 scope).
 *
 * Shape:
 *   * Header — back-link + title + slot + relative next-review.
 *   * Dense paragraph — the connective tissue rendered as a paragraph.
 *   * Bullets — key facts as `.tma-cell` rows in a `.tma-section__plate`.
 *   * Cue-sheet preview — raw JSON pretty-printed (rich rendering in T-18+).
 *
 * «Review now» opens Focus on this single conspectus via
 * `/focus?conspectus_uuid=<uuid>` (T-17c). AI micro-actions from the mock
 * (§ ed-inter «Explain differently», «Generate quiz») are out of scope
 * for T-17.
 */

import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { useTelegramBackButton } from '../../shared/chrome/useTelegramBackButton';
import { useTelegramMainButton } from '../../shared/chrome/useTelegramMainButton';
import { haptic } from '../../shared/haptics/haptics';
import { LangSwitch } from '../../shared/i18n/LangSwitch';
import { ErrorInline } from '../Today/components/ErrorInline';
import { useConspectus } from './hooks/useConspectus';

export function ConspectusDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { conspectus_uuid?: string };
  const uuid = params.conspectus_uuid ?? '';
  const query = useConspectus(uuid);

  // T-25d — native SDK chrome. BackButton in the header returns to Today;
  // MainButton at the bottom carries the same «Review now» primary action
  // as the on-canvas CTA, so on-device users get a persistent native
  // affordance that doesn't scroll away.
  useTelegramBackButton(() => void navigate({ to: '/' }));
  useTelegramMainButton(
    uuid
      ? {
          text: t('detail.reviewNow'),
          onClick: () => {
            haptic('impactLight');
            void navigate({ to: '/focus', search: { conspectus_uuid: uuid } });
          },
        }
      : null,
  );

  // Auth loading/error handled by <AuthGate>.

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
            justifyContent: 'space-between',
            gap: 'var(--tma-sp-3)',
            padding: '0 var(--tma-sp-4)',
          }}
        >
          <Link
            to="/"
            className="tma-btn tma-btn--ghost"
            style={{
              minHeight: 0,
              padding: '6px 10px',
              fontSize: 'var(--tma-fs-small)',
              textDecoration: 'none',
            }}
          >
            ← {t('detail.back')}
          </Link>
          <LangSwitch />
        </header>

        <>
            {query.isPending && <DetailSkeleton />}
            {query.isError && (
              <div style={{ margin: 'var(--tma-sp-4) var(--tma-sp-4)' }}>
                <ErrorInline label={t('detail.error')} onRetry={() => query.refetch()} />
              </div>
            )}
            {query.data && (
              <article style={{ padding: '0 var(--tma-sp-4)' }}>
                <h1
                  style={{
                    fontSize: 'var(--tma-fs-h2)',
                    fontWeight: 'var(--tma-fw-bold)',
                    letterSpacing: '-0.02em',
                    margin: 'var(--tma-sp-4) 0 var(--tma-sp-2)',
                    color: 'var(--tma-text-primary)',
                  }}
                >
                  {query.data.title ?? t('detail.untitled')}
                </h1>
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--tma-sp-2)',
                    alignItems: 'center',
                    marginBottom: 'var(--tma-sp-4)',
                    fontSize: 'var(--tma-fs-small)',
                    color: 'var(--tma-text-tertiary)',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: 24,
                      height: 24,
                      padding: '0 var(--tma-sp-2)',
                      borderRadius: 'var(--tma-rad-2)',
                      background: 'color-mix(in oklab, var(--tma-tone-accent) 12%, transparent)',
                      color: 'var(--tma-tone-accent)',
                      fontWeight: 'var(--tma-fw-semi)',
                      fontSize: 'var(--tma-fs-micro)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {query.data.slot}
                  </span>
                  <span>{t('detail.contentVersion', { v: query.data.content_version })}</span>
                </div>

                {query.data.dense_paragraph && (
                  <p
                    style={{
                      fontSize: 'var(--tma-fs-body)',
                      lineHeight: 'var(--tma-lh-normal)',
                      color: 'var(--tma-text-primary)',
                      margin: '0 0 var(--tma-sp-6)',
                    }}
                  >
                    {query.data.dense_paragraph}
                  </p>
                )}

                {query.data.bullets && query.data.bullets.length > 0 && (
                  <section className="tma-section" aria-labelledby="bullets-h">
                    <div className="tma-section__header" id="bullets-h">
                      {t('detail.bullets')}
                    </div>
                    <div className="tma-section__plate">
                      {query.data.bullets.map((bullet, i) => (
                        <div className="tma-cell" key={i} style={{ cursor: 'default' }}>
                          <div className="tma-cell__icon" data-tone="accent">
                            {i + 1}
                          </div>
                          <div className="tma-cell__main">
                            <div
                              className="tma-cell__title"
                              style={{ whiteSpace: 'normal', overflow: 'visible' }}
                            >
                              {bullet}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <div style={{ padding: '0 var(--tma-sp-4)', marginTop: 'var(--tma-sp-4)' }}>
                  <button
                    type="button"
                    className="tma-btn tma-btn--primary tma-btn--block"
                    onClick={() => {
                      haptic('impactLight');
                      void navigate({ to: '/focus', search: { conspectus_uuid: uuid } });
                    }}
                  >
                    {t('detail.reviewNow')}
                  </button>
                </div>
              </article>
            )}
        </>
      </div>
    </main>
  );
}

function DetailSkeleton() {
  return (
    <div style={{ padding: '0 var(--tma-sp-4)' }}>
      <div
        style={{
          height: 32,
          width: '70%',
          margin: 'var(--tma-sp-4) 0 var(--tma-sp-3)',
          borderRadius: 'var(--tma-rad-1)',
          background: 'var(--tma-surface-plate)',
          opacity: 0.6,
        }}
      />
      <div
        style={{
          height: 12,
          width: '35%',
          marginBottom: 'var(--tma-sp-6)',
          borderRadius: 'var(--tma-rad-1)',
          background: 'var(--tma-surface-plate)',
          opacity: 0.6,
        }}
      />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            height: 12,
            width: `${90 - i * 8}%`,
            marginBottom: 8,
            borderRadius: 'var(--tma-rad-1)',
            background: 'var(--tma-surface-plate)',
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}
