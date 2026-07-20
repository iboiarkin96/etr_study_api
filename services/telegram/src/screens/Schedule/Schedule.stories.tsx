/**
 * Storybook stories for the Schedule screen (T-19).
 *
 * Same auth+cache mocking pattern as Focus.stories.tsx: WithAuth decorator
 * wires QueryClient + AuthContext with stub API, per-story fixtures for
 * summary + history payloads.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ComponentType, ReactNode } from 'react';
import { useMemo } from 'react';

import { AuthContext, type AuthContextValue } from '../../app/auth-context';
import type { components } from '../../shared/api/schema';
import { Schedule } from './index';

type ScheduleSummary = components['schemas']['ScheduleSummaryResponse'];
type ScheduleHistory = components['schemas']['ScheduleHistoryResponse'];
type HistoryDay = components['schemas']['HistoryDay'];

function makeAuth(overrides: {
  summary?: ScheduleSummary;
  history?: ScheduleHistory;
} = {}): AuthContextValue {
  const summary = overrides.summary;
  const history = overrides.history;
  return {
    status: 'authenticated',
    jwt: 'stub',
    user: { client_uuid: 'client', telegram_user_id: 42 } as AuthContextValue['user'],
    error: null,
    retry: () => {},
    api: {
      GET: async (path: string) => {
        if (path.includes('summary')) return { data: summary, error: undefined };
        if (path.includes('history')) return { data: history, error: undefined };
        return { data: undefined, error: undefined };
      },
      POST: async () => ({ data: undefined, error: undefined }),
      PUT: async () => ({ data: undefined, error: undefined }),
      PATCH: async () => ({ data: undefined, error: undefined }),
      DELETE: async () => ({ data: undefined, error: undefined }),
    } as unknown as AuthContextValue['api'],
  };
}

function WithAuth({ auth, children }: { auth: AuthContextValue; children: ReactNode }) {
  const qc = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }),
    [],
  );
  return (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Screens/Schedule',
  component: Schedule,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Schedule screen (T-19). Look-ahead surface — summary strip + 90-day heat-map. Docs: reference/screens/schedule.html.',
      },
    },
  },
} satisfies Meta<typeof Schedule>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Generate N days of fake history ending yesterday, with a gentle upward drift. */
function fakeHistory(days: number): HistoryDay[] {
  const out: HistoryDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 10);
    // Rough curve: 0..12 with clumps
    const noise = ((i * 13) % 7) - 3;
    const base = Math.max(0, Math.round(2 + (days - i) / 12 + noise));
    const intensity = base === 0 ? 0 : base < 3 ? 1 : base < 6 ? 2 : base < 11 ? 3 : 4;
    out.push({ date: iso, count: base, intensity });
  }
  return out;
}

const POPULATED_SUMMARY: ScheduleSummary = {
  due_now: 4,
  due_next_24h: 12,
  total: 58,
  computed_at: new Date().toISOString(),
  by_slot: { A: 8, B: 22, C: 16, D: 12 } as ScheduleSummary['by_slot'],
};

export const Populated: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth
        auth={makeAuth({
          summary: POPULATED_SUMMARY,
          history: { days: fakeHistory(90), computed_at: new Date().toISOString() },
        })}
      >
        <Story />
      </WithAuth>
    ),
  ],
};

export const EmptyRhythm: Story = {
  decorators: [
    (Story: ComponentType) => (
      <WithAuth
        auth={makeAuth({
          summary: { due_now: 0, due_next_24h: 0, total: 0, computed_at: new Date().toISOString(), by_slot: { A: 0, B: 0, C: 0, D: 0 } as ScheduleSummary['by_slot'] },
          history: { days: fakeHistory(90).map((d) => ({ ...d, count: 0, intensity: 0 })), computed_at: new Date().toISOString() },
        })}
      >
        <Story />
      </WithAuth>
    ),
  ],
};
