/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 37: social_accounts OAuth credential authority.
 *
 * Empirically proves (not just by code inspection) that
 * SocialMediaService.refreshAccessToken/fetchAnalytics cannot read, use, or
 * mutate another organization's OAuth-connected account even when supplied
 * a syntactically valid accountId belonging to a different org — required
 * negative tests #1/#2/#4 (Org A cannot retrieve/use or refresh Org B's
 * account token through any account-ID service path; every token UPDATE
 * predicate carries trusted organization ownership).
 *
 * Uses a real predicate-evaluating fake db (eq/and are actually applied to
 * in-memory rows), not a pass-through mock, so the proof is that the
 * organizationId filter is load-bearing — not merely called.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeAccount {
  id: string;
  organizationId: string;
  platform: string;
  platformUserId: string;
  username: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  status: string;
}

type Predicate =
  | { __type: 'eq'; field: string; value: unknown }
  | { __type: 'and'; predicates: Predicate[] };

function matches(row: Record<string, unknown>, predicate: Predicate): boolean {
  switch (predicate.__type) {
    case 'eq':
      return row[predicate.field] === predicate.value;
    case 'and':
      return predicate.predicates.every((p) => matches(row, p));
    default:
      return true;
  }
}

const ORG_A = 'org-A';
const ORG_B = 'org-B';

let accounts: FakeAccount[];

vi.mock('drizzle-orm', () => ({
  eq: (field: { __col: string }, value: unknown) => ({ __type: 'eq', field: field.__col, value }),
  and: (...predicates: Predicate[]) => ({ __type: 'and', predicates }),
  inArray: (field: { __col: string }, values: unknown[]) => ({ __type: 'eq', field: field.__col, value: values }),
}));

vi.mock('@/db/schema/social-media-schema', () => {
  const col = (name: string) => ({ __col: name });
  return {
    socialAccounts: {
      id: col('id'),
      organizationId: col('organizationId'),
      platform: col('platform'),
      platformUserId: col('platformUserId'),
      accessToken: col('accessToken'),
      refreshToken: col('refreshToken'),
      tokenExpiresAt: col('tokenExpiresAt'),
      status: col('status'),
    },
    socialPosts: { accountId: col('accountId') },
    socialAnalytics: { accountId: col('accountId'), analyticsDate: col('analyticsDate') },
  };
});

vi.mock('@/db', () => {
  const db = {
    select: () => ({
      from: () => ({
        where: (pred: Predicate) => ({
          limit: async () => accounts.filter((a) => matches(a as unknown as Record<string, unknown>, pred)),
        }),
      }),
    }),
    update: (_table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async (pred: Predicate) => {
          const targets = accounts.filter((a) => matches(a as unknown as Record<string, unknown>, pred));
          for (const target of targets) Object.assign(target, patch);
          return targets;
        },
      }),
    }),
    insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => [] }) }) }),
  };
  return { db };
});

vi.mock('../meta-api-client', () => ({
  createMetaClient: vi.fn(() => ({
    getLongLivedToken: vi.fn(async () => ({ access_token: 'rotated-meta-token', expires_in: 3600 })),
  })),
}));
vi.mock('../twitter-api-client', () => ({
  createTwitterClient: vi.fn(() => ({})),
}));
vi.mock('../linkedin-api-client', () => ({
  createLinkedInClient: vi.fn(() => ({})),
}));

import { SocialMediaService } from '../social-media-service';

function seedAccounts() {
  accounts = [
    {
      id: 'rogue-account',
      organizationId: ORG_A,
      platform: 'facebook',
      platformUserId: 'fb-rogue',
      username: 'rogue',
      accessToken: 'rogue-access-token',
      refreshToken: null,
      tokenExpiresAt: null,
      status: 'active',
    },
    {
      id: 'legit-account',
      organizationId: ORG_B,
      platform: 'facebook',
      platformUserId: 'fb-legit',
      username: 'legit',
      accessToken: 'legit-access-token',
      refreshToken: null,
      tokenExpiresAt: null,
      status: 'active',
    },
  ];
}

describe('round 37: cross-org OAuth account boundary (negative tests 1, 2, 4)', () => {
  beforeEach(() => {
    seedAccounts();
  });

  it('negative test 1/4: refreshAccessToken cannot read/rotate another org\'s account token', async () => {
    const svc = new SocialMediaService();

    await expect(svc.refreshAccessToken('rogue-account', ORG_B)).rejects.toThrow(/Account not found/);

    // The rogue account (org A) must be completely untouched by an org-B call.
    const rogue = accounts.find((a) => a.id === 'rogue-account')!;
    expect(rogue.accessToken).toBe('rogue-access-token');
    expect(rogue.status).toBe('active');
  });

  it('negative test 1: refreshAccessToken succeeds only against the caller\'s own org account', async () => {
    const svc = new SocialMediaService();

    await svc.refreshAccessToken('legit-account', ORG_B);

    const legit = accounts.find((a) => a.id === 'legit-account')!;
    const rogue = accounts.find((a) => a.id === 'rogue-account')!;
    expect(legit.accessToken).toBe('rotated-meta-token');
    // Rogue (org A) stays untouched even though it exists in the same fake db.
    expect(rogue.accessToken).toBe('rogue-access-token');
  });

  it('negative test 2: fetchAnalytics cannot read another org\'s account token', async () => {
    const svc = new SocialMediaService();

    await expect(svc.fetchAnalytics(ORG_B, 'rogue-account', new Date('2026-01-01'), new Date('2026-01-31'))).rejects.toThrow(
      /Account not found/
    );
  });

  it('negative test 4: a failed cross-org refresh never reaches the error-path status mutation on the wrong org\'s row', async () => {
    const svc = new SocialMediaService();

    await expect(svc.refreshAccessToken('rogue-account', ORG_B)).rejects.toThrow();

    const rogue = accounts.find((a) => a.id === 'rogue-account')!;
    // Not merely "not refreshed" — never marked expired/error either.
    expect(rogue.status).toBe('active');
  });
});
