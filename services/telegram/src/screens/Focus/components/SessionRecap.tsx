/**
 * SessionRecap — end-of-session debrief ledger on the Focus complete state.
 *
 * Lists every card the user marked Again/Hard this round; each row carries
 * the ink of the grade button that produced it and opens the MissSheet
 * composer pre-linked to that conspectus — the note is saved without
 * leaving Focus. A saved row cools to success («Noted») and locks.
 *
 * Renders nothing when the session had no misses — silence, like MissPeek.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MissSheet } from '../../Errors/components/MissSheet';
import { useCreateError } from '../../Errors/hooks/useCreateError';
import type { SessionMiss } from '../hooks/useFocusSession';

type Props = {
  misses: readonly SessionMiss[];
};

export function SessionRecap({ misses }: Props) {
  const { t } = useTranslation();
  const create = useCreateError();
  const [active, setActive] = useState<SessionMiss | null>(null);
  const [logged, setLogged] = useState<ReadonlySet<string>>(() => new Set());

  if (misses.length === 0) return null;

  const save = (message: string) => {
    if (!active) return;
    create.mutate(
      { message, conspectus_uuid: active.conspectus_uuid },
      {
        onSuccess: () => {
          setLogged((prev) => new Set(prev).add(active.conspectus_uuid));
          setActive(null);
        },
      },
    );
  };

  return (
    <>
      <section
        className="tma-focus__recap"
        aria-label={t('focus.recap.aria', { count: misses.length })}
      >
        <p className="tma-focus__recap-eyebrow">
          <span>{t('focus.recap.eyebrow')}</span>
          <span>{String(misses.length).padStart(2, '0')}</span>
        </p>
        <ul className="tma-focus__recap-list">
          {misses.map((m) => {
            const isLogged = logged.has(m.conspectus_uuid);
            return (
              <li key={m.conspectus_uuid}>
                <button
                  type="button"
                  className="tma-focus__recap-row"
                  data-grade={m.grade}
                  data-logged={isLogged ? 'true' : 'false'}
                  disabled={isLogged}
                  onClick={() => setActive(m)}
                >
                  <span className="tma-focus__recap-dot" aria-hidden="true" />
                  <span className="tma-focus__recap-grade">
                    {t(`focus.grade.${m.grade}`)}
                  </span>
                  <span className="tma-focus__recap-title">
                    {m.title ?? t('detail.untitled')}
                  </span>
                  <span className="tma-focus__recap-tail">
                    {isLogged ? t('focus.recap.noted') : t('focus.recap.addNote')}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <MissSheet
        open={active !== null}
        saving={create.isPending}
        errorText={create.isError ? t('errors.error.save') : null}
        contextLabel={
          active
            ? active.title
              ? t('focus.recap.contextTitle', { title: active.title })
              : t('focus.recap.contextGeneric')
            : null
        }
        onClose={() => {
          if (!create.isPending) {
            setActive(null);
            create.reset();
          }
        }}
        onSave={save}
      />
    </>
  );
}
