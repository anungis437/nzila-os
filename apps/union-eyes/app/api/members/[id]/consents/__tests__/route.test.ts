/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 47: user_consents subject-authority fix.
 *
 * Empirically proves (via a real predicate-evaluating fake db) that
 * app/api/members/[id]/consents/route.ts's GET/PATCH are scoped to BOTH the
 * organization AND the record's own subject (userId) — org scoping alone
 * previously let any org member read, and any steward mutate, any other
 * member's consent record.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

interface FakeConsent {
  id: string;
  userId: string;
  organizationId: string;
  consentType: string;
  status: string;
  legalBasis: string;
  processingPurpose: string;
  consentVersion: string;
  consentText: string;
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
  }
}

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const USER_A1 = 'user-A1';
const USER_A2 = 'user-A2';
const USER_B1 = 'user-B1';
const CONSENT_A1_ID = 'consent-a1';

let consents: FakeConsent[];

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<object>();
  return { ...actual, getCurrentUser: m.getCurrentUser };
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (field: unknown, value: unknown) => ({
      __type: 'eq',
      field: (field as { name: string }).name,
      value,
    }),
    and: (...predicates: Predicate[]) => ({ __type: 'and', predicates }),
  };
});

vi.mock('@/db/schema', () => ({
  userConsents: {
    id: { name: 'id' },
    userId: { name: 'userId' },
    organizationId: { name: 'organizationId' },
    consentType: { name: 'consentType' },
    status: { name: 'status' },
  },
}));

vi.mock('@/db/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (predicate: Predicate) => consents.filter((c) => matches(c as unknown as Record<string, unknown>, predicate)),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: (predicate: Predicate) => ({
          returning: () => {
            const matched = consents.filter((c) => matches(c as unknown as Record<string, unknown>, predicate));
            for (const row of matched) Object.assign(row, values);
            return matched;
          },
        }),
      }),
    }),
  },
}));

import { GET, PATCH } from '../route';

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest('https://example.test/api/members/x/consents', {
    method: body ? 'PATCH' : 'GET',
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function asUser(userId: string, organizationId: string) {
  m.getCurrentUser.mockResolvedValue({
    id: userId,
    organizationId,
    role: 'member',
    email: null,
    name: null,
    firstName: null,
    lastName: null,
    imageUrl: null,
    legacyTenantId: null,
    metadata: {},
  });
}

describe('members/[id]/consents subject-authority', () => {
  beforeEach(() => {
    consents = [
      {
        id: CONSENT_A1_ID,
        userId: USER_A1,
        organizationId: ORG_A,
        consentType: 'marketing',
        status: 'granted',
        legalBasis: 'consent',
        processingPurpose: 'marketing',
        consentVersion: 'v1',
        consentText: 'I agree',
      },
    ];
  });

  it('A1 can read their own consent record', async () => {
    asUser(USER_A1, ORG_A);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: CONSENT_A1_ID }) });
    expect(res.status).toBe(200);
  });

  it('A2 (same org, different user) cannot read A1s consent record', async () => {
    asUser(USER_A2, ORG_A);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: CONSENT_A1_ID }) });
    expect(res.status).toBe(404);
  });

  it('B1 (different org) cannot read A1s consent record', async () => {
    asUser(USER_B1, ORG_B);
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: CONSENT_A1_ID }) });
    expect(res.status).toBe(404);
  });

  it('A1 can withdraw their own consent via PATCH', async () => {
    asUser(USER_A1, ORG_A);
    const res = await PATCH(makeRequest({ status: 'withdrawn' }), {
      params: Promise.resolve({ id: CONSENT_A1_ID }),
    });
    expect(res.status).toBe(200);
    expect(consents[0].status).toBe('withdrawn');
  });

  it('A2 (same org, different user) cannot mutate A1s consent record', async () => {
    asUser(USER_A2, ORG_A);
    const res = await PATCH(makeRequest({ status: 'withdrawn' }), {
      params: Promise.resolve({ id: CONSENT_A1_ID }),
    });
    expect(res.status).toBe(404);
    expect(consents[0].status).toBe('granted');
  });

  it('B1 (different org) cannot mutate A1s consent record', async () => {
    asUser(USER_B1, ORG_B);
    const res = await PATCH(makeRequest({ status: 'withdrawn' }), {
      params: Promise.resolve({ id: CONSENT_A1_ID }),
    });
    expect(res.status).toBe(404);
    expect(consents[0].status).toBe('granted');
  });

  it('PATCH cannot rewrite consent facts even for the owning subject (blockedPatchFields)', async () => {
    asUser(USER_A1, ORG_A);
    await PATCH(
      makeRequest({ status: 'withdrawn', legalBasis: 'attacker-controlled', consentText: 'rewritten' }),
      { params: Promise.resolve({ id: CONSENT_A1_ID }) },
    );
    expect(consents[0].legalBasis).toBe('consent');
    expect(consents[0].consentText).toBe('I agree');
  });
});
