/**
 * Storybook stories for the Profile screen (T-23).
 *
 * Variant A «Living streak» — StreakOrb hero + identity head + achievement
 * chips + nudge plate + «Open Today» CTA. Query cache is pre-seeded under
 * the production keys so real components render off fixtures without the
 * network; PATCH is stubbed so the NudgeSheet's save loop is playable live.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../app/auth-context';
import type { components } from '../../shared/api/schema';
import { Profile } from './index';

type MeUser = components['schemas']['UserCreateResponse'];
type Achievement = components['schemas']['Achievement'];

const CLIENT = 'client-uuid-1';

function ach(key: string, unlocked: boolean, progress: number, target: number): Achievement {
  return { key, unlocked, progress, target };
}

const MIXED_ACHIEVEMENTS: Achievement[] = [
  ach('first_review', true, 1, 1),
  ach('streak_7', true, 7, 7),
  ach('streak_30', false, 18, 30),
  ach('reviews_100', false, 86, 100),
  ach('notes_10', true, 10, 10),
  ach('noticer_10', false, 3, 10),
  ach('perfect_day', true, 1, 1),
  ach('comeback', false, 0, 1),
  ach('early_bird', true, 1, 1),
  ach('night_owl', false, 0, 1),
  ach('mastery_50', false, 23, 50),
  ach('reviews_500', false, 118, 500),
];

const LOCKED_ACHIEVEMENTS: Achievement[] = [
  ach('first_review', false, 0, 1),
  ach('streak_7', false, 0, 7),
  ach('streak_30', false, 0, 30),
  ach('reviews_100', false, 0, 100),
  ach('notes_10', false, 0, 10),
  ach('noticer_10', false, 0, 10),
  ach('perfect_day', false, 0, 1),
  ach('comeback', false, 0, 1),
  ach('early_bird', false, 0, 1),
  ach('night_owl', false, 0, 1),
  ach('mastery_50', false, 0, 50),
  ach('reviews_500', false, 0, 500),
];

function meUser(): MeUser {
  return {
    client_uuid: CLIENT,
    created_at: '2026-07-01T00:00:00Z',
    updated_at: '2026-07-01T00:00:00Z',
    is_row_invalid: 0,
    invalidation_reason_uuid: null,
    system_user_id: '42',
    system_uuid: '00000000-0000-4000-8000-000000000001',
    username: 'ada',
    full_name: 'Ivan',
    timezone: 'UTC',
    reminder_enabled: 1,
    reminder_at: '09:00',
  } as MeUser;
}

function makeAuth(): AuthContextValue {
  return {
    status: 'authenticated',
    jwt: 'story-jwt',
    user: {
      client_uuid: CLIENT,
      telegram_user_id: 42,
      full_name: 'Ivan',
    } as AuthContextValue['user'],
    error: null,
    retry: () => {},
    api: {
      GET: async () => ({ data: undefined, error: undefined }),
      POST: async () => ({ data: undefined, error: undefined }),
      PUT: async () => ({ data: undefined, error: undefined }),
      PATCH: async (_path: string, opts: { body?: { reminder_enabled?: number; reminder_at?: string } }) => ({
        data: {
          ...meUser(),
          reminder_enabled: opts.body?.reminder_enabled ?? 1,
          reminder_at: opts.body?.reminder_at ?? '09:00',
        },
        error: undefined,
      }),
      DELETE: async () => ({ data: undefined, error: undefined }),
    } as unknown as AuthContextValue['api'],
  };
}

type Fixture = {
  current: number;
  longest: number;
  achievements: Achievement[];
};

function Host({ fixture, children }: { fixture: Fixture; children?: ReactNode }) {
  const client = useMemo(() => {
    const c = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: Infinity,
          gcTime: Infinity,
          retry: false,
          refetchOnWindowFocus: false,
        },
        mutations: { retry: false },
      },
    });
    c.setQueryData(['me.stats', CLIENT], {
      streak: { current_days: fixture.current, longest_days: fixture.longest, goal_days: 30 },
      computed_at: '2026-07-19T09:00:00Z',
    });
    c.setQueryData(['me.achievements', CLIENT], {
      items: fixture.achievements,
      computed_at: '2026-07-19T09:00:00Z',
    });
    c.setQueryData(['me.user', CLIENT], meUser());
    c.setQueryData(['today.conspectuses.due', CLIENT], [{ conspectus_uuid: 'c-1', title: 'CAP' }]);
    return c;
  }, [fixture]);

  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={makeAuth()}>
        <Profile />
        {children}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Screens/Profile',
  component: Profile,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'The identity mirror (T-23, variant A «Living streak»). Streak orb hero, achievements computed server-side, daily-nudge editor with optimistic PATCH. No account UX by design — Telegram owns theming and identity.',
      },
    },
  },
} satisfies Meta<typeof Profile>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 14-day streak · record 18 · mixed badge wall · nudge on 09:00. */
export const Default: Story = {
  decorators: [
    () => (
      <Host fixture={{ current: 14, longest: 18, achievements: MIXED_ACHIEVEMENTS }} />
    ),
  ],
};

/** Fresh account — streak 0, every badge locked, nudge armed at 09:00. */
export const NewUser: Story = {
  decorators: [
    () => (
      <Host fixture={{ current: 0, longest: 0, achievements: LOCKED_ACHIEVEMENTS }} />
    ),
  ],
};
