import { describe, expect, it, vi } from 'vitest';
import { organizationMembers, communicationPreferences } from '@/db/schema';

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

const state = vi.hoisted(() => ({
  members: [] as Row[],
  preferences: [] as Row[],
  consents: [] as Row[],
}));

vi.mock('drizzle-orm', () => ({
  eq: (col: string, val: unknown): Predicate => (row) => row[col] === val,
  and: (...preds: Predicate[]): Predicate => (row) => preds.every((p) => p(row)),
  desc: (col: string) => ({ __desc: col }),
}));

vi.mock('@/db/schema', () => ({
  organizationMembers: { userId: 'userId', organizationId: 'organizationId', status: 'status', email: 'email', phone: 'phone' },
  communicationPreferences: {
    organizationId: 'organizationId', userId: 'userId', emailEnabled: 'emailEnabled', smsEnabled: 'smsEnabled',
    globallyUnsubscribed: 'globallyUnsubscribed', categories: 'categories',
  },
  consentRecords: { organizationId: 'organizationId', userId: 'userId', channel: 'channel', status: 'status', createdAt: 'createdAt' },
  campaigns: { channel: { enumValues: ['email', 'sms', 'push', 'multi_channel'] } },
  consentChannelEnum: { enumValues: ['email', 'sms', 'push', 'phone', 'mail'] },
}));

function fakeTx() {
  return {
    select: (projection: Record<string, string>) => ({
      from: (table: Row) => {
        const rows = table === (organizationMembers as unknown as Row) ? state.members
          : table === (communicationPreferences as unknown as Row) ? state.preferences
          : state.consents;
        const project = (row: Row) => Object.fromEntries(Object.keys(projection).map((key) => [key, row[projection[key]!]]));
        const chain = {
          where: (pred: Predicate) => {
            const matched = rows.filter(pred);
            const limited = {
              limit: (n: number) => Promise.resolve(matched.slice(0, n).map(project)),
              orderBy: () => limited,
            };
            return { ...limited, then: (resolve: (v: Row[]) => unknown) => resolve(matched.map(project)) };
          },
        };
        return chain;
      },
    }),
  };
}

describe('campaign-audience', () => {
  it('excludes a globally unsubscribed member even if the channel itself is enabled', async () => {
    state.members = [{ userId: 'u1', organizationId: 'org-1', status: 'active', email: 'a@x.com', phone: null }];
    state.preferences = [{ organizationId: 'org-1', userId: 'u1', emailEnabled: true, smsEnabled: false, globallyUnsubscribed: true, categories: { campaign: true } }];
    state.consents = [];
    const { evaluateRecipientEligibility } = await import('../campaign-audience');
    const reason = await evaluateRecipientEligibility(fakeTx() as never, 'org-1', 'u1', 'email');
    expect(reason).toBe('Globally unsubscribed');
  });

  it('excludes a member whose campaign category is disabled, even with the channel enabled', async () => {
    state.preferences = [{ organizationId: 'org-1', userId: 'u1', emailEnabled: true, smsEnabled: false, globallyUnsubscribed: false, categories: { campaign: false } }];
    state.consents = [];
    const { evaluateRecipientEligibility } = await import('../campaign-audience');
    const reason = await evaluateRecipientEligibility(fakeTx() as never, 'org-1', 'u1', 'email');
    expect(reason).toBe('Campaign category disabled in communication preferences');
  });

  it('excludes a member whose most recent consent record for the channel is revoked', async () => {
    state.preferences = [{ organizationId: 'org-1', userId: 'u1', emailEnabled: true, smsEnabled: false, globallyUnsubscribed: false, categories: { campaign: true } }];
    state.consents = [{ organizationId: 'org-1', userId: 'u1', channel: 'email', status: 'revoked', createdAt: '2026-01-01' }];
    const { evaluateRecipientEligibility } = await import('../campaign-audience');
    const reason = await evaluateRecipientEligibility(fakeTx() as never, 'org-1', 'u1', 'email');
    expect(reason).toBe('email consent denied, revoked or expired');
  });

  it('is eligible when preferences allow the channel+category and no consent record denies it', async () => {
    state.preferences = [{ organizationId: 'org-1', userId: 'u1', emailEnabled: true, smsEnabled: false, globallyUnsubscribed: false, categories: { campaign: true } }];
    state.consents = [{ organizationId: 'org-1', userId: 'u1', channel: 'email', status: 'granted', createdAt: '2026-01-01' }];
    const { evaluateRecipientEligibility } = await import('../campaign-audience');
    const reason = await evaluateRecipientEligibility(fakeTx() as never, 'org-1', 'u1', 'email');
    expect(reason).toBeNull();
  });

  it('defaults sms closed (CASL opt-in) and email open when no preferences row exists at all', async () => {
    state.preferences = [];
    state.consents = [];
    const { evaluateRecipientEligibility } = await import('../campaign-audience');
    expect(await evaluateRecipientEligibility(fakeTx() as never, 'org-1', 'u1', 'sms')).toBe('sms channel disabled in communication preferences');
    expect(await evaluateRecipientEligibility(fakeTx() as never, 'org-1', 'u1', 'email')).toBeNull();
  });

  it('excludes every candidate for a channel with no settled per-recipient delivery channel (push, multi_channel)', async () => {
    const { evaluateRecipientEligibility } = await import('../campaign-audience');
    expect(await evaluateRecipientEligibility(fakeTx() as never, 'org-1', 'u1', 'push')).toContain('no settled per-recipient delivery channel');
    expect(await evaluateRecipientEligibility(fakeTx() as never, 'org-1', 'u1', 'multi_channel')).toContain('no settled per-recipient delivery channel');
  });

  it('evaluateCampaignAudience resolves every active member and splits eligible from excluded', async () => {
    state.members = [
      { userId: 'u1', organizationId: 'org-1', status: 'active', email: 'a@x.com', phone: null },
      { userId: 'u2', organizationId: 'org-1', status: 'active', email: 'b@x.com', phone: null },
    ];
    state.preferences = [
      { organizationId: 'org-1', userId: 'u1', emailEnabled: true, smsEnabled: false, globallyUnsubscribed: false, categories: { campaign: true } },
      { organizationId: 'org-1', userId: 'u2', emailEnabled: true, smsEnabled: false, globallyUnsubscribed: true, categories: { campaign: true } },
    ];
    state.consents = [];
    const { evaluateCampaignAudience } = await import('../campaign-audience');
    const result = await evaluateCampaignAudience(fakeTx() as never, 'org-1', 'email');
    expect(result.totalCandidates).toBe(2);
    expect(result.eligible.map((c) => c.userId)).toEqual(['u1']);
    expect(result.excluded).toEqual([{ userId: 'u2', reason: 'Globally unsubscribed' }]);
  });
});
