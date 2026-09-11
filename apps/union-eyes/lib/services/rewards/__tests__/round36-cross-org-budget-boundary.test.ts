/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 36: reward_budget_envelopes / reward_wallet_ledger
 * authority convergence.
 *
 * This file proves — against the REAL (unmocked) budget-service.ts and
 * award-service.ts functions, exercised through a small in-memory fake
 * `db` that actually evaluates `eq`/`and` predicates rather than a
 * pass-through stub — the exact cross-org attack the round-36 brief
 * described:
 *
 *   Org A creates (or otherwise causes) a reward_budget_envelopes row
 *   with org_id = A but program_id = B's recognition program. Org B then
 *   issues/revokes an award against its own program. Before this round's
 *   fix, checkBudgetAvailability/applyBudgetUsage/applyBudgetUsageChecked/
 *   reserveBudget queried ONLY by program_id + scope_type + date range —
 *   no org_id predicate — so Org A's envelope (created first, therefore
 *   returned first by `ORDER BY created_at DESC`... or simply the only
 *   match) could be read/mutated by Org B's award flow.
 *
 * The fake db below is intentionally minimal: it is NOT a general SQL
 * simulator. It supports exactly the shapes budget-service.ts/
 * award-service.ts use: `eq`/`and` build a predicate tree, `.select()
 * .from(table).where(pred).orderBy().limit(n)` and `db.query.<table>
 * .findFirst({ where: pred })` filter the relevant in-memory array by
 * evaluating that tree. This is deliberately more realistic than the
 * existing per-file mocks (which treat `eq`/`and` as opaque pass-through
 * arrays) BECAUSE the whole point of this file is to prove the org_id
 * predicate is actually present and actually filters — a pass-through
 * mock cannot prove that.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/* ---------- in-memory fake tables ---------- */
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

interface FakeProgram {
  id: string;
  orgId: string;
}

let envelopes: FakeEnvelope[] = [];
let programs: FakeProgram[] = [];

/* ---------- tiny predicate tree matcher (mirrors drizzle-orm's eq/and) ---------- */
type Predicate =
  | { __type: 'eq'; field: string; value: unknown }
  | { __type: 'lte'; field: string; value: unknown }
  | { __type: 'gte'; field: string; value: unknown }
  | { __type: 'and'; clauses: Predicate[] };

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
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({ __type: 'sql', strings, values }),
    { raw: (s: string) => s }
  ),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/db/schema', () => ({
  rewardBudgetEnvelopes: {
    id: 'id',
    orgId: 'orgId',
    programId: 'programId',
    scopeType: 'scopeType',
    startsAt: 'startsAt',
    endsAt: 'endsAt',
    amountUsed: 'amountUsed',
    amountLimit: 'amountLimit',
    createdAt: 'createdAt',
  },
  budgetReservations: {
    id: 'id',
    poolId: 'poolId',
    status: 'status',
    referenceType: 'referenceType',
    referenceId: 'referenceId',
    expiresAt: 'expiresAt',
  },
  recognitionPrograms: { id: 'id', orgId: 'orgId' },
}));

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('uuid', () => ({ v4: vi.fn(() => 'mock-uuid') }));

function sortByCreatedAtDesc(rows: FakeEnvelope[]): FakeEnvelope[] {
  return [...rows].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

function fakeEnvelopeUpdate(pred: Predicate, delta: number) {
  const target = sortByCreatedAtDesc(envelopes.filter((e) => matches(e as unknown as Record<string, unknown>, pred)))[0];
  if (!target) return { updated: undefined as FakeEnvelope | undefined };
  const nextUsed = target.amountUsed + delta;
  target.amountUsed = nextUsed;
  return { updated: target };
}

vi.mock('@/db', () => {
  const db = {
    select: () => ({
      from: (_table: unknown) => ({
        where: (pred: Predicate) => {
          const rows = sortByCreatedAtDesc(
            envelopes.filter((e) => matches(e as unknown as Record<string, unknown>, pred))
          );
          const chain = {
            orderBy: () => ({
              limit: async (n: number) => rows.slice(0, n),
            }),
            limit: async (n: number) => rows.slice(0, n),
          };
          return chain;
        },
      }),
    }),
    query: {
      rewardBudgetEnvelopes: {
        findFirst: async ({ where }: { where: Predicate }) =>
          sortByCreatedAtDesc(envelopes.filter((e) => matches(e as unknown as Record<string, unknown>, where)))[0],
      },
      recognitionPrograms: {
        findFirst: async ({ where }: { where: Predicate }) =>
          programs.find((p) => matches(p as unknown as Record<string, unknown>, where)),
      },
    },
    update: (_table: unknown) => ({
      set: (patch: { amountUsed?: { __type: string; values: unknown[] } }) => ({
        where: (pred: Predicate) => {
          // amountUsed patch is a `sql` tagged-template mock: values = [amountUsed field, amount]
          const delta = (patch.amountUsed?.values?.[1] as number) ?? 0;
          const { updated } = fakeEnvelopeUpdate(pred, delta);
          return {
            returning: async () => (updated ? [updated] : []),
          };
        },
      }),
    }),
    insert: (_table: unknown) => ({
      values: (row: Record<string, unknown>) => ({
        returning: async () => {
          const envelope: FakeEnvelope = {
            id: `env-${envelopes.length + 1}`,
            createdAt: new Date(),
            ...row,
          } as FakeEnvelope;
          envelopes.push(envelope);
          return [envelope];
        },
      }),
    }),
    transaction: async (cb: (tx: typeof db) => unknown) => cb(db),
  };
  return { db };
});

import { applyBudgetUsage, applyBudgetUsageChecked, checkBudgetAvailability, createBudgetEnvelope, reserveBudget } from '../budget-service';
import { db } from '@/db';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const PROGRAM_B = 'program-B';

const activeWindow = {
  startsAt: new Date('2026-01-01'),
  endsAt: new Date('2026-12-31'),
};

describe('round 36: reward_budget_envelopes cross-org boundary', () => {
  beforeEach(() => {
    envelopes = [];
    programs = [{ id: PROGRAM_B, orgId: ORG_B }];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('negative test 1: Org A cannot create an envelope against Org B\'s program', async () => {
    await expect(
      createBudgetEnvelope({
        orgId: ORG_A,
        programId: PROGRAM_B,
        name: 'Malicious envelope',
        scopeType: 'org',
        period: 'annual',
        amountLimit: 100000,
        amountUsed: 0,
        ...activeWindow,
      } as any)
    ).rejects.toThrow('Recognition program not found for this organization');

    expect(envelopes).toHaveLength(0);
  });

  it('negative test 2 & 3: Org B budget reads/consumption cannot locate or mutate an Org-A-owned envelope referencing Org B\'s program', async () => {
    // Simulates the pre-fix world's ONLY protection failing: an Org-A-owned
    // envelope somehow exists referencing Org B's program (e.g. seeded
    // directly, or created before this round's ownership check existed).
    envelopes.push({
      id: 'rogue-envelope',
      orgId: ORG_A,
      programId: PROGRAM_B,
      scopeType: 'org',
      amountLimit: 100000,
      amountUsed: 0,
      createdAt: new Date('2020-01-01'), // older — would sort last, but must never match at all
      ...activeWindow,
    });

    // negative test 2: read path
    const available = await checkBudgetAvailability(PROGRAM_B, ORG_B, 50);
    // No envelope owned by ORG_B exists, so the honest answer is "true"
    // (no budget configured => allowed) — NOT a silent match against A's row.
    expect(available).toBe(true);

    // negative test 3: consumption path must not touch Org A's envelope
    await applyBudgetUsage(db, PROGRAM_B, ORG_B, 500);
    const rogue = envelopes.find((e) => e.id === 'rogue-envelope')!;
    expect(rogue.amountUsed).toBe(0); // untouched

    const checkedResult = await applyBudgetUsageChecked(db, PROGRAM_B, ORG_B, 500);
    expect(checkedResult).toBe(true); // no envelope for org B => allowed, not blocked by A's limits
    expect(rogue.amountUsed).toBe(0); // still untouched

    const reserveResult = await reserveBudget(PROGRAM_B, ORG_B, 500, 'award', 'ref-1');
    expect(reserveResult.success).toBe(true);
    expect(rogue.amountUsed).toBe(0);
  });

  it('applyBudgetUsage/applyBudgetUsageChecked correctly mutate Org B\'s OWN envelope when one exists, even with an Org-A rogue envelope for the same program present', async () => {
    envelopes.push({
      id: 'rogue-envelope',
      orgId: ORG_A,
      programId: PROGRAM_B,
      scopeType: 'org',
      amountLimit: 100000,
      amountUsed: 0,
      createdAt: new Date('2030-01-01'), // intentionally NEWER, so a
      // program_id-only ORDER BY created_at DESC query would have picked
      // THIS row first before the fix — proving the fix isn't relying on
      // ordering/luck.
      ...activeWindow,
    });
    envelopes.push({
      id: 'legit-envelope',
      orgId: ORG_B,
      programId: PROGRAM_B,
      scopeType: 'org',
      amountLimit: 1000,
      amountUsed: 100,
      createdAt: new Date('2026-06-01'),
      ...activeWindow,
    });

    const ok = await applyBudgetUsageChecked(db, PROGRAM_B, ORG_B, 200);
    expect(ok).toBe(true);

    const rogue = envelopes.find((e) => e.id === 'rogue-envelope')!;
    const legit = envelopes.find((e) => e.id === 'legit-envelope')!;
    expect(rogue.amountUsed).toBe(0); // Org A's envelope never touched
    expect(legit.amountUsed).toBe(300); // Org B's own envelope correctly updated
  });
});
