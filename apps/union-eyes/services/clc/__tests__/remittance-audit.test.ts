import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'leftJoin', 'innerJoin', 'set', 'values', 'returning', 'insert', 'update', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  return { queue, db, sendEmail: vi.fn(async () => undefined) };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/services/email', () => ({ sendEmail: h.sendEmail }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
}));

import {
  submitForApproval,
  approveRemittance,
  rejectRemittance,
  getApprovalWorkflowState,
  getApprovalHistory,
  runComplianceChecks,
} from '../remittance-audit';

const push = (...items: unknown[]) => h.queue.push(...items);

const future = new Date(Date.now() + 86400000).toISOString();
const validRem = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  organizationId: 'o1',
  approvalStatus: 'draft',
  totalMembers: 90,
  perCapitaRate: 5,
  totalAmount: '450',
  dueDate: future,
  paidDate: null,
  remittanceMonth: 3,
  ...over,
});
const notifyRow = () => [{ remittance: validRem(), organization: { name: 'Local 1' } }];

beforeEach(() => {
  h.queue.length = 0;
  h.sendEmail.mockClear();
});

describe('submitForApproval', () => {
  it('fails when the remittance does not exist', async () => {
    push([]);
    const r = await submitForApproval('r1', 'u1');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Remittance not found');
  });

  it('fails when not in draft status', async () => {
    push([validRem({ approvalStatus: 'pending_local' })]);
    const r = await submitForApproval('r1', 'u1');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Remittance already submitted');
  });

  it('fails when compliance checks fail', async () => {
    push([validRem({ totalMembers: 0 })]);
    const r = await submitForApproval('r1', 'u1');
    expect(r.success).toBe(false);
    expect(r.message).toBe('Compliance checks failed');
  });

  it('submits successfully and notifies the first level', async () => {
    push([validRem()], [], [], notifyRow());
    const r = await submitForApproval('r1', 'u1');
    expect(r.success).toBe(true);
    expect(r.nextLevel).toBe('local');
    expect(r.status).toBe('pending_local');
  });

  it('returns an error result when a db call throws', async () => {
    push(new Error('boom'));
    const r = await submitForApproval('r1', 'u1');
    expect(r.success).toBe(false);
    expect(r.message).toBe('boom');
  });
});

describe('approveRemittance', () => {
  it('fails when not found', async () => {
    push([]);
    const r = await approveRemittance('r1', 'u1', 'local');
    expect(r.message).toBe('Remittance not found');
  });

  it('fails when remittance is not at the given level', async () => {
    push([validRem({ approvalStatus: 'pending_regional' })]);
    const r = await approveRemittance('r1', 'u1', 'local');
    expect(r.message).toBe('Remittance not at this approval level');
  });

  it('fails when the user lacks approval authority', async () => {
    push([validRem({ approvalStatus: 'pending_local' })], []); // membership lookup empty
    const r = await approveRemittance('r1', 'u1', 'local');
    expect(r.message).toBe('User does not have approval authority');
  });

  it('approves and advances to the next level', async () => {
    push(
      [validRem({ approvalStatus: 'pending_local' })],
      [{ role: 'local_admin' }], // authority
      [], // update
      [], // log insert
      notifyRow(), // notify next approvers
    );
    const r = await approveRemittance('r1', 'u1', 'local', 'looks good');
    expect(r.success).toBe(true);
    expect(r.nextLevel).toBe('regional');
    expect(r.status).toBe('pending_regional');
  });

  it('completes final approval at the last level', async () => {
    push(
      [validRem({ approvalStatus: 'pending_clc' })],
      [{ role: 'clc_admin' }],
      [], // update
      [], // log insert
    );
    const r = await approveRemittance('r1', 'u1', 'clc');
    expect(r.success).toBe(true);
    expect(r.nextLevel).toBeNull();
    expect(r.status).toBe('approved');
  });
});

describe('rejectRemittance', () => {
  it('fails when not found', async () => {
    push([]);
    const r = await rejectRemittance('r1', 'u1', 'local', 'bad numbers');
    expect(r.message).toBe('Remittance not found');
  });

  it('fails when not at the given level', async () => {
    push([validRem({ approvalStatus: 'approved' })]);
    const r = await rejectRemittance('r1', 'u1', 'local', 'bad');
    expect(r.message).toBe('Remittance not at this approval level');
  });

  it('fails when the user lacks authority', async () => {
    push([validRem({ approvalStatus: 'pending_local' })], []);
    const r = await rejectRemittance('r1', 'u1', 'local', 'bad');
    expect(r.message).toBe('User does not have approval authority');
  });

  it('rejects successfully', async () => {
    push(
      [validRem({ approvalStatus: 'pending_local' })],
      [{ role: 'local_admin' }],
      [], // update
      [], // log insert
    );
    const r = await rejectRemittance('r1', 'u1', 'local', 'member count off', 'fix it');
    expect(r.success).toBe(true);
    expect(r.status).toBe('rejected');
    expect(r.message).toContain('member count off');
  });
});

describe('getApprovalWorkflowState', () => {
  it('returns null when the remittance is missing', async () => {
    push([]);
    expect(await getApprovalWorkflowState('r1', 'u1')).toBeNull();
  });

  it('builds the workflow state with current/next levels', async () => {
    push(
      [{ remittance: validRem({ approvalStatus: 'pending_regional' }), organization: { name: 'Local 1' } }],
      [], // history
      [{ role: 'regional_admin' }], // authority for current level
    );
    const state = await getApprovalWorkflowState('r1', 'u1');
    expect(state).not.toBeNull();
    expect(state?.currentLevel).toBe('regional');
    expect(state?.nextLevel).toBe('national');
    expect(state?.canApprove).toBe(true);
  });

  it('returns null on error', async () => {
    push(new Error('db down'));
    expect(await getApprovalWorkflowState('r1', 'u1')).toBeNull();
  });
});

describe('getApprovalHistory', () => {
  it('maps approval rows including user-name fallbacks', async () => {
    push([
      { approval: { id: 'a1', approvalLevel: 'local', action: 'approved', comment: 'ok', rejectionReason: null, createdAt: '2024-01-01' }, user: { displayName: 'Jane Doe', email: 'jane@x.com' } },
      { approval: { id: 'a2', approvalLevel: 'regional', action: 'submitted', comment: null, rejectionReason: null, createdAt: null }, user: { firstName: 'John', lastName: 'Roe' } },
      { approval: { id: 'a3', approvalLevel: 'clc', action: 'rejected', comment: null, rejectionReason: 'bad', createdAt: '2024-02-01' }, user: null },
    ]);
    const history = await getApprovalHistory('r1');
    expect(history[0].approverName).toBe('Jane Doe');
    expect(history[1].approverName).toBe('John Roe');
    expect(history[2].approverName).toBe('Unknown');
  });
});

describe('runComplianceChecks', () => {
  it('passes for a consistent remittance', async () => {
    const r = await runComplianceChecks(validRem());
    expect(r.passed).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('reports errors for missing fields and calculation mismatch', async () => {
    const r = await runComplianceChecks({ totalMembers: 0, perCapitaRate: 0, totalAmount: 0, dueDate: future });
    expect(r.passed).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('warns when overdue and unpaid', async () => {
    const past = new Date(Date.now() - 86400000).toISOString();
    const r = await runComplianceChecks(validRem({ dueDate: past, paidDate: null }));
    expect(r.warnings.some((w) => w.includes('overdue'))).toBe(true);
  });
});
