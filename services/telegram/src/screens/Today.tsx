/**
 * Placeholder Today — proves the auth bootstrap round-trips end-to-end
 * (T-12). Fires `GET /api/v1/schedule/summary` once the auth handshake
 * lands; renders the auth status so a broken bootstrap shows up
 * immediately instead of hanging silently. The real UI arrives in
 * T-14 / T-15.
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../app/use-auth';
import { telegramOwnerParams } from '../shared/auth/identity';

export function Today() {
  const auth = useAuth();

  const summary = useQuery({
    enabled: auth.status === 'authenticated' && !!auth.user,
    queryKey: ['schedule.summary', auth.user?.client_uuid],
    queryFn: async () => {
      const { data, error } = await auth.api.GET('/api/v1/schedule/summary', {
        params: { query: telegramOwnerParams(auth.user!.telegram_user_id) },
      });
      if (error) throw new Error(`schedule/summary failed: ${JSON.stringify(error)}`);
      return data;
    },
  });

  return (
    <main
      style={{
        minHeight: 'var(--tma-viewport-h, 100dvh)',
        paddingTop: 'var(--tma-safe-top, 0)',
        paddingBottom: 'var(--tma-safe-bottom, 0)',
        background: 'var(--tg-bg-color, #0f0f10)',
        color: 'var(--tg-text-color, #f5f5f7)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 320, padding: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 .5rem' }}>study_app</h1>
        <p
          style={{
            opacity: 0.6,
            margin: 0,
            fontSize: '0.9rem',
            color: 'var(--tg-hint-color, #707579)',
          }}
        >
          Привет 👋 Скоро тут будет твой день.
        </p>
        <DebugStrip auth={auth} summary={summary} />
      </div>
    </main>
  );
}

function DebugStrip({
  auth,
  summary,
}: {
  auth: ReturnType<typeof useAuth>;
  summary: ReturnType<typeof useQuery>;
}) {
  const line = (label: string, value: string): string => `${label}: ${value}`;

  const rows: string[] = [];
  rows.push(line('auth', auth.status));
  if (auth.status === 'authenticated' && auth.user) {
    rows.push(line('user', auth.user.full_name || auth.user.client_uuid.slice(0, 8)));
  }
  if (auth.error) rows.push(line('auth.error', auth.error.message));

  if (auth.status === 'authenticated') {
    if (summary.isPending) rows.push('schedule/summary: loading…');
    else if (summary.isError) rows.push(line('schedule/summary.error', String(summary.error)));
    else rows.push(line('schedule/summary', 'ok'));
  }

  return (
    <pre
      style={{
        marginTop: '2rem',
        padding: '0.75rem 1rem',
        borderRadius: 8,
        background: 'var(--tg-secondary-bg-color, #232e3c)',
        color: 'var(--tg-hint-color, #708499)',
        fontSize: '0.75rem',
        textAlign: 'left',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {rows.join('\n')}
    </pre>
  );
}
