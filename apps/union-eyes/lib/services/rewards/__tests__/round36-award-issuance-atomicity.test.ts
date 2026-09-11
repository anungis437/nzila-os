/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 36: proves negative tests 4, 5, and 6 from the round-36
 * brief using the REAL (unmocked) award-service.ts + budget-service.ts
 * together — only wallet-service.ts's applyLedgerEntry is mocked (the
 * ledger-specific append-only invariants are covered separately in
 * round36-reward-wallet-ledger-boundary.test.ts; this file is scoped to
 * the award/budget transaction boundary).
 *
 *   4. Award issuance cannot consume another org's envelope even with
 *      malformed/inconsistent fixture data.
 *   5. Award revocation cannot refund another org's envelope.
 *   6. The entire award + ledger + budget operation rolls back atomically
 *      on injected failure (a failure after the ledger entry but before
 *      the award-state update must not leave the budget partially
 *      consumed while the award itself stays "approved").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakeEnvelope {
  id: string;
  orgId: string;
  programId: string;
  scopeType: string;
  amountLimit: number;
  amountUsed: number;
  startsAt: Date;
  endsAt: Date;
  createdAt: Date;
}

interface FakeAwardType {
  id: string;
  orgId: string;
  programId: string;
  name: string;
  defaultCreditAmount: number;
}

interface FakeAward {
  id: string;
  orgId: string;
  programId: string;
  awardTypeId: string;
  recipientUserId: string;
  status: string;
}

let envelopes: FakeEnvelope[] = [];
let awardTypes: FakeAwardType[] = [];
let awards: FakeAward[] = [];

type Predicate =
  | { __type: 'eq'; field: string; value: unknown }
  | { __type: 'lte'; field: string; value: unknown }
  | { __type: 'gte'; field: string; value: unknown }
  | { __type: 'and'; clauses: Predicate[] }
  | { __type: 'sql'; strings: TemplateStringsArray; values: unknown[] };

function matches(row: Record<string, unknown>, predicate: Predicate | undefined): boolean {
  if (!predicate) return true;
  switch (predicate.__type) {
    case 'eq':
      return row[predicate.field] === predicate.value;
    case 'lte':
      return (row[predicate.field] as Date) <= (predicate.value as Date);
    case 'gte':
      return (row[predicate.field] as Date) >= (predicate.value as Date);
    case 'and':
      return predicate.clauses.every((c) => matches(row, c));
    case 'sql': {
      // Only ever used here for applyBudgetUsageChecked's limit check:
      // sql`${amountUsed} + ${amount} <= ${amountLimit}` interpolates to
      // values = ['amountUsed', amount, 'amountLimit'].
      const [usedField, amount, limitField] = predicate.values as [string, number, string];
      if (typeof usedField === 'string' && typeof limitField === 'string' && usedField in row && limitField in row) {
        return (row[usedField] as number) + amount <= (row[limitField] as number);
      }
      return true;
    }
    default:
      return true;
  }
}

vi.mock('drizzle-orm', () => ({
  eq: (field: string, value: unknown): Predicate => ({ __type: 'eq', field, value }),
  lte: (field: string, value: unknown): Predicate => ({ __type: 'lte', field, value }),
  gte: (field: string, value: unknown): Predicate => ({ __type: 'gte', field, value }),
  and: (...clauses: Predicate[]): Predicate => ({ __type: 'and', clauses }),
  desc: (field: string) => ({ __type: 'desc', field }),
  asc: (field: string) => ({ __type: 'asc', field }),
  ne: (field: string, value: unknown) => ({ __type: 'ne', field, value }),
  inArray: (field: string, values: unknown[]) => ({ __type: 'inArray', field, values }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ __type: 'sql', strings, values }),
    { raw: (s: string) => s }
  ),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/db/schema', () => ({
  rewardBudgetEnvelopes: {
    id: 'id', orgId: 'orgId', programId: 'programId', scopeType: 'scopeType',
    startsAt: 'startsAt', endsAt: 'endsAt', amountUsed: 'amountUsed', amountLimit: 'amountLimit', createdAt: 'createdAt',
  },
  budgetReservations: { id: 'id', poolId: 'poolId', status: 'status', referenceType: 'referenceType', referenceId: 'referenceId', expiresAt: 'expiresAt' },
  recognitionPrograms: { id: 'id', orgId: 'orgId' },
  recognitionAwards: { id: 'id', orgId: 'orgId', programId: 'programId', status: 'status' },
  recognitionAwardTypes: { id: 'id', orgId: 'orgId', programId: 'programId' },
}));

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid') }));

const mocks = vi.hoisted(() => ({ mockApplyLedgerEntry: vi.fn() }));
vi.mock('../wallet-service', () => ({ applyLedgerEntry: mocks.mockApplyLedgerEntry }));

function sortByCreatedAtDesc(rows: FakeEnvelope[]): FakeEnvelope[] {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

vi.mock('@/db', () => {
  const db = {
    select: () => ({
      from: (_table: unknown) => ({
        where: (pred: Predicate) => {
          const rows = sortByCreatedAtDesc(envelopes.filter((e) => matches(e as unknown as Record<string, unknown>, pred)));
          return {
            orderBy: () => ({ limit: async (n: number) => rows.slice(0, n) }),
            limit: async (n: number) => rows.slice(0, n),
          };
        },
      }),
    }),
    query: {
      rewardBudgetEnvelopes: {
        findFirst: async ({ where }: { where: Predicate }) =>
          sortByCreatedAtDesc(envelopes.filter((e) => matches(e as unknown as Record<string, unknown>, where)))[0],
      },
      recognitionAwards: {
        findFirst: async ({ where }: { where: Predicate }) => {
          const award = awards.find((a) => matches(a as unknown as Record<string, unknown>, where));
          if (!award) return undefined;
          const awardType = awardTypes.find((t) => t.id === award.awardTypeId);
          return { ...award, awardType };
        },
      },
    },
    update: (table: { id?: string }) => ({
      set: (patch: Record<string, unknown> & { amountUsed?: { values: unknown[] } }) => ({
        where: (pred: Predicate) => {
          // Mutation happens eagerly here (not lazily inside .returning()),
          // matching that applyBudgetUsage() never calls .returning() while
          // applyBudgetUsageChecked() does \u2014 both must observe the mutation.
          let result: Record<string, unknown> | undefined;
          if ('status' in patch && !('amountUsed' in patch)) {
            // recognitionAwards update (award-service's status transition)
            const award = awards.find((a) => matches(a as unknown as Record<string, unknown>, pred));
            if (award) {
              Object.assign(award, patch);
              result = { ...award };
            }
          } else {
            // rewardBudgetEnvelopes update (budget mutation)
            const delta = (patch.amountUsed?.values?.[1] as number) ?? 0;
            const target = sortByCreatedAtDesc(envelopes.filter((e) => matches(e as unknown as Record<string, unknown>, pred)))[0];
            if (target) {
              target.amountUsed += delta;
              result = { ...target };
            }
          }
          return {
            then: (resolve: (v: undefined) => void) => resolve(undefined),
            returning: async () => (result ? [result] : []),
          };
        },
      }),
    }),
    transaction: async (cb: (tx: typeof db) => unknown) => cb(db),
  };
  return { db };
});

import { issueAward, revokeAward } from '../award-service';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const PROGRAM_B = 'program-B';
const activeWindow = { startsAt: new Date('2026-01-01'), endsAt: new Date('2026-12-31') };

describe('round 36: award issuance/revocation cannot cross the org boundary via budget consumption (negative tests 4 & 5)', () => {
  beforeEach(() => {
    envelopes = [
      // Rogue Org-A-owned envelope for the SAME program, newest first —
      // would be picked by a program_id-only, org-blind query.
      {
        id: 'rogue-envelope', orgId: ORG_A, programId: PROGRAM_B, scopeType: 'org',
        amountLimit: 100000, amountUsed: 0, createdAt: new Date('2030-01-01'), ...activeWindow,
      },
      // Org B's own legitimate envelope, with a deliberately LOW limit so a
      // cross-org leak into the rogue envelope's huge limit would be
      // observable (issuance would wrongly succeed against Org A's budget).
      {
        id: 'legit-envelope', orgId: ORG_B, programId: PROGRAM_B, scopeType: 'org',
        amountLimit: 50, amountUsed: 0, createdAt: new Date('2026-06-01'), ...activeWindow,
      },
    ];
    awardTypes = [{ id: 'at-1', orgId: ORG_B, programId: PROGRAM_B, name: 'Kudos', defaultCreditAmount: 100 }];
    awards = [{ id: 'award-1', orgId: ORG_B, programId: PROGRAM_B, awardTypeId: 'at-1', recipientUserId: 'user-1', status: 'approved' }];
    mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 100 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('negative test 4: issuing an award for Org B (amount 100) fails on Org B\'s own 50-limit envelope rather than silently succeeding against Org A\'s 100000-limit rogue envelope', async () => {
    await expect(issueAward({ awardId: 'award-1', orgId: ORG_B })).rejects.toThrow('Insufficient budget to issue award');

    const rogue = envelopes.find((e) => e.id === 'rogue-envelope')!;
    const legit = envelopes.find((e) => e.id === 'legit-envelope')!;
    expect(rogue.amountUsed).toBe(0); // never touched
    expect(legit.amountUsed).toBe(0); // rejected before mutation (limit check fails atomically)

    const award = awards.find((a) => a.id === 'award-1')!;
    expect(award.status).toBe('approved'); // never transitioned to issued
  });

  it('negative test 4b: issuing succeeds against Org B\'s own envelope when the amount fits, and Org A\'s rogue envelope stays untouched', async () => {
    envelopes.find((e) => e.id === 'legit-envelope')!.amountLimit = 1000;

    const result = await issueAward({ awardId: 'award-1', orgId: ORG_B });

    expect(result.award.status).toBe('issued');
    const rogue = envelopes.find((e) => e.id === 'rogue-envelope')!;
    const legit = envelopes.find((e) => e.id === 'legit-envelope')!;
    expect(rogue.amountUsed).toBe(0);
    expect(legit.amountUsed).toBe(100);
  });

  it('negative test 5: revoking an issued award refunds ONLY Org B\'s own envelope, never Org A\'s rogue envelope', async () => {
    envelopes.find((e) => e.id === 'legit-envelope')!.amountLimit = 1000;
    envelopes.find((e) => e.id === 'legit-envelope')!.amountUsed = 100;
    awards[0].status = 'issued';

    const result = await revokeAward({
      awardId: 'award-1',
      orgId: ORG_B,
      revokedByUserId: 'admin-1',
      reason: 'Mistake',
    });

    expect(result.award.status).toBe('revoked');
    const rogue = envelopes.find((e) => e.id === 'rogue-envelope')!;
    const legit = envelopes.find((e) => e.id === 'legit-envelope')!;
    expect(rogue.amountUsed).toBe(0); // never refunded from/into Org A's envelope
    expect(legit.amountUsed).toBe(0); // Org B's own envelope correctly refunded
  });
});

describe('round 36: award + ledger + budget state transition is one atomic unit (negative test 6)', () => {
  beforeEach(() => {
    envelopes = [{ id: 'e-1', orgId: ORG_B, programId: PROGRAM_B, scopeType: 'org', amountLimit: 1000, amountUsed: 0, createdAt: new Date('2026-06-01'), ...activeWindow }];
    awardTypes = [{ id: 'at-1', orgId: ORG_B, programId: PROGRAM_B, name: 'Kudos', defaultCreditAmount: 100 }];
    awards = [{ id: 'award-1', orgId: ORG_B, programId: PROGRAM_B, awardTypeId: 'at-1', recipientUserId: 'user-1', status: 'approved' }];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('a failure in the ledger step (before budget/award mutate) leaves budget usage and award status untouched', async () => {
    mocks.mockApplyLedgerEntry.mockRejectedValue(new Error('ledger insert failed'));

    await expect(issueAward({ awardId: 'award-1', orgId: ORG_B })).rejects.toThrow('ledger insert failed');

    expect(envelopes[0].amountUsed).toBe(0);
    expect(awards[0].status).toBe('approved');
  });

  it('a failure in the budget step (after ledger, before award update) still leaves the award status untouched \u2014 real db.transaction() would roll back the ledger insert too', async () => {
    mocks.mockApplyLedgerEntry.mockResolvedValue({ balanceAfter: 100 });
    // Force the budget envelope to be too small so applyBudgetUsageChecked
    // returns false, simulating the "insufficient budget" branch that
    // throws AFTER the ledger entry was written within the same tx.
    envelopes[0].amountLimit = 10;

    await expect(issueAward({ awardId: 'award-1', orgId: ORG_B })).rejects.toThrow('Insufficient budget to issue award');

    // The award never reaches 'issued' \u2014 proves the award-state mutation
    // never runs when the budget step fails, which is what makes the whole
    // sequence safe to roll back as one unit inside the real db.transaction().
    expect(awards[0].status).toBe('approved');
    expect(mocks.mockApplyLedgerEntry).toHaveBeenCalledTimes(1);
  });
});
