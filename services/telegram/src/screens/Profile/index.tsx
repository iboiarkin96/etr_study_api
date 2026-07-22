/**
 * Profile screen — the identity mirror, T-23.
 *
 * Variant A «Living streak» (Amie DNA, kit mock profile.html): the breathing
 * streak orb carries the identity; everything else sits quiet below.
 *
 *   - back-header (‹ to Today · title)
 *   - Assemble choreography:
 *       hero  = StreakOrb (reused from Today — same component, same cache)
 *       order 1 = identity head (full_name · longest streak)
 *       order 2 = AchievementChips (GET /me/achievements)
 *       order 3 = nudge plate row → NudgeSheet (optimistic PATCH /user)
 *       order 4 = «Open Today →» primary CTA (D2)
 *   - Esc → Today (the NudgeSheet captures Esc while open — same containment
 *     contract as MissSheet, so the binding below never fires under a modal).
 *
 * Deliberately absent (mirror, not a settings screen): no logout, no theme
 * picker, no account switching — Telegram owns all three.
 */

import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../app/use-auth';
import { Assemble } from '../Today/components/Assemble';
import { ErrorInline } from '../Today/components/ErrorInline';
import { StreakOrb } from '../Today/components/StreakOrb';
import { useTelegramBackButton } from '../../shared/chrome/useTelegramBackButton';
import { useConspectusesDue } from '../Today/hooks/useConspectusesDue';
import { useMeStats } from '../Today/hooks/useMeStats';
import { AchievementChips } from './components/AchievementChips';
import { NudgeSheet } from './components/NudgeSheet';
import { useMeAchievements } from './hooks/useMeAchievements';
import { useMeUser } from './hooks/useMeUser';
import { useUpdateReminder } from './hooks/useUpdateReminder';

export function Profile() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const stats = useMeStats();
  const achievements = useMeAchievements();
  const me = useMeUser();
  const due = useConspectusesDue();
  const reminder = useUpdateReminder();
  const [sheetOpen, setSheetOpen] = useState(false);

  // T-25d — native BackButton returns to Today.
  useTelegramBackButton(() => void navigate({ to: '/' }));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void navigate({ to: '/' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  // Auth loading/error handled by <AuthGate>.

  const nudgeOn = (me.data?.reminder_enabled ?? 1) === 1;
  const nudgeAt = me.data?.reminder_at ?? '09:00';

  const saveNudge = (draft: { enabled: boolean; time: string }) => {
    reminder.mutate(
      { reminder_enabled: draft.enabled ? 1 : 0, reminder_at: draft.time },
      { onSuccess: () => setSheetOpen(false) },
    );
  };

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
        <header className="tma-profile__header">
          <button
            type="button"
            onClick={() => void navigate({ to: '/' })}
            aria-label={t('profile.back')}
            className="tma-profile__back"
          >
            ‹
          </button>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 className="tma-profile__title">{t('profile.title')}</h1>
          </div>
        </header>

        <>
            {/* Orb — hero. Same component + cache as Today, so navigating
             * back and forth never re-fetches or re-animates from zero. */}
            {stats.isPending && <ProfileSkeleton />}
            {stats.isError && (
              <div style={{ padding: 'var(--tma-sp-4)' }}>
                <ErrorInline label={t('profile.error.profile')} onRetry={() => stats.refetch()} />
              </div>
            )}
            {stats.data && (
              <>
                <Assemble hero>
                  <StreakOrb data={stats.data.streak} dueToday={due.data?.length ?? 1} />
                </Assemble>

                <Assemble order={1}>
                  <div className="tma-profile__head">
                    <p className="tma-profile__eyebrow">
                      {auth.user?.full_name
                        ? `${auth.user.full_name} · ${t('profile.eyebrow')}`
                        : t('profile.eyebrow')}
                    </p>
                    <p className="tma-profile__longest">
                      {t('profile.longest', { count: stats.data.streak.longest_days })}
                    </p>
                  </div>
                </Assemble>
              </>
            )}

            {/* Achievements (slot 2). */}
            {achievements.isError && (
              <div style={{ padding: 'var(--tma-sp-3) var(--tma-sp-4) 0' }}>
                <ErrorInline
                  label={t('profile.error.achievements')}
                  onRetry={() => achievements.refetch()}
                />
              </div>
            )}
            {achievements.data && (
              <Assemble order={2}>
                <div style={{ padding: '0 var(--tma-sp-4)' }}>
                  <AchievementChips items={achievements.data.items} />
                </div>
              </Assemble>
            )}

            {/* Nudge plate (slot 3). */}
            {me.data && (
              <Assemble order={3}>
                <div style={{ padding: 'var(--tma-sp-4) var(--tma-sp-4) 0' }}>
                  <button
                    type="button"
                    className="tma-profile__nudge"
                    onClick={() => setSheetOpen(true)}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span className="tma-profile__nudge-title">{t('profile.nudge.title')}</span>
                      <span className="tma-profile__nudge-sub">
                        {nudgeAt} · {t('profile.nudge.sub')}
                      </span>
                    </span>
                    <span className="tma-profile__nudge-badge" data-on={nudgeOn ? 'true' : 'false'}>
                      {nudgeOn ? t('profile.nudge.on') : t('profile.nudge.off')}
                    </span>
                  </button>
                </div>
              </Assemble>
            )}

            {/* Primary CTA (slot 4, D2 — the one hero action). */}
            <Assemble order={4}>
              <div style={{ padding: 'var(--tma-sp-5) var(--tma-sp-4) 0' }}>
                <button
                  type="button"
                  className="tma-btn tma-btn--primary tma-btn--block"
                  onClick={() => void navigate({ to: '/' })}
                >
                  {t('profile.openToday')}
                </button>
              </div>
            </Assemble>
        </>
      </div>

      <NudgeSheet
        open={sheetOpen}
        saving={reminder.isPending}
        errorText={reminder.isError ? t('profile.error.save') : null}
        enabled={nudgeOn}
        time={nudgeAt}
        onClose={() => {
          if (!reminder.isPending) {
            setSheetOpen(false);
            reminder.reset();
          }
        }}
        onSave={saveNudge}
      />
    </main>
  );
}

function ProfileSkeleton() {
  return (
    <div className="tma-profile__skeleton" aria-label="Profile loading">
      <div className="tma-profile__skeleton-orb" />
      <div className="tma-profile__skeleton-line" />
      <div className="tma-profile__skeleton-chips" />
      <div className="tma-profile__skeleton-plate" />
    </div>
  );
}
