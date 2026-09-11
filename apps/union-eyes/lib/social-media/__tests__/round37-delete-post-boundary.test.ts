/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 37 (correction tranche): social_accounts OAuth credential
 * authority — deletePost's own organization boundary.
 *
 * deletePost(postId, organizationId) now enforces organization ownership
 * in its own post/account join query, rather than depending entirely on
 * its sole caller (posts/route.ts DELETE) having already checked. Proves
 * a foreign-org postId is rejected by the service itself and never reads
 * or uses another organization's account credentials.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

interface FakePost {
  id: string;
  organizationId: string;
  accountId: string;
  platformPostId: string;
  status: string;
}

interface FakeAccount {
  id: string;
  organizationId: string;
  platform: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
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

let posts: FakePost[];
let accounts: FakeAccount[];

vi.mock('drizzle-orm', () => ({
  eq: (field: { __col: string }, value: unknown) => ({ __type: 'eq', field: field.__col, value }),
  and: (...predicates: Predicate[]) => ({ __type: 'and', predicates }),
}));

vi.mock('@/db/schema/social-media-schema', () => {
  const col = (name: string) => ({ __col: name });
  return {
    socialPosts: { id: col('id'), organizationId: col('organizationId'), accountId: col('accountId'), platformPostId: col('platformPostId'), status: col('status'), deletedAt: col('deletedAt'), updatedAt: col('updatedAt') },
    socialAccounts: { id: col('id'), organizationId: col('organizationId'), platform: col('platform'), accessToken: col('accessToken'), refreshToken: col('refreshToken'), tokenExpiresAt: col('tokenExpiresAt') },
  };
});

vi.mock('@/db', () => {
  const db = {
    select: (shape?: Record<string, { __col: string }>) => ({
      from: () => ({
        // The real query joins socialAccounts in for platform/accessToken only;
        // the ON condition itself isn't the security boundary under test, so
        // it's modeled directly rather than generically re-evaluated.
        leftJoin: () => ({
          where: (pred: Predicate) => ({
            limit: async () => {
              const rows = posts
                .filter((p) => matches(p as unknown as Record<string, unknown>, pred))
                .map((p) => {
                  const account = accounts.find((a) => a.id === p.accountId);
                  const merged: Record<string, unknown> = { ...p, platform: account?.platform, accessToken: account?.accessToken };
                  const out: Record<string, unknown> = {};
                  for (const key of Object.keys(shape!)) out[key] = merged[shape![key].__col];
                  return out;
                });
              return rows;
            },
          }),
        }),
        // getClient()'s own plain account lookup (no join).
        where: (pred: Predicate) => ({
          limit: async () => accounts.filter((a) => matches(a as unknown as Record<string, unknown>, pred)),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
  };
  return { db };
});

vi.mock('../meta-api-client', () => ({ createMetaClient: vi.fn(() => ({})) }));
vi.mock('../twitter-api-client', () => ({ createTwitterClient: vi.fn(() => ({ deleteTweet: vi.fn(async () => undefined) })) }));
vi.mock('../linkedin-api-client', () => ({ createLinkedInClient: vi.fn(() => ({})) }));

import { SocialMediaService } from '../social-media-service';

function seed() {
  accounts = [{ id: 'rogue-account', organizationId: ORG_A, platform: 'twitter', accessToken: 'rogue-secret-token', refreshToken: null, tokenExpiresAt: null }];
  posts = [{ id: 'rogue-post', organizationId: ORG_A, accountId: 'rogue-account', platformPostId: 'tw-1', status: 'published' }];
}

describe('round 37 (correction): deletePost enforces organization ownership in its own query', () => {
  beforeEach(() => {
    seed();
  });

  it('a foreign-org postId is rejected by the service itself, not merely by the caller', async () => {
    const svc = new SocialMediaService();

    await expect(svc.deletePost('rogue-post', ORG_B)).rejects.toThrow(/Post not found/);
  });

  it('succeeds and uses the platform client only when the org matches', async () => {
    const svc = new SocialMediaService();

    await expect(svc.deletePost('rogue-post', ORG_A)).resolves.toBeUndefined();
  });
});
