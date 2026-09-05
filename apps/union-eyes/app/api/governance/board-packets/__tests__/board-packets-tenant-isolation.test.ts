/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 — public-authority tranche (governance/board_packets family).
 * Found during manifest reclassification: board_packets is not part of
 * the 0108 RLS baseline (no live RLS policy exists for it yet), and every
 * route in this subsystem queried it WITHOUT an organizationId filter —
 * the list route returned every organization's board packets (financial
 * summaries, audit exceptions, compliance status) to any officer+ caller;
 * create trusted a client-supplied `organizationId` in the request body;
 * the single-packet GET had no org check at all; PATCH/DELETE relied
 * solely on a non-existent RLS policy; distribute could email another
 * org's packet to attacker-supplied recipients. All fixed to filter/force
 * by the framework-resolved caller organizationId.
 *
 * These tests assert on the actual `eq`/`and` predicate arguments passed
 * to `.where(...)` (mocking `eq`/`and` as recording pass-throughs) rather
 * than trying to fully simulate Drizzle's query builder — proves the
 * correct COLUMN and VALUE are used for org-scoping without coupling the
 * test to the builder's exact chain shape.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  selectWhere: vi.fn(),
  insertReturning: vi.fn(),
  updateWhereReturning: vi.fn(),
  distributePacket: vi.fn(),
  auditDataMutation: vi.fn(),
  eqCalls: [] as unknown[][],
}));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    withApi: m.withApi,
    z,
    ApiError: {
      notFound: (msg: string) => new Error(`404:${msg}`),
      badRequest: (msg: string) => new Error(`400:${msg}`),
    },
  };
});

vi.mock('@/lib/db/with-rls-context', () => ({
  // Routes now use the tx parameter explicitly (PR #752 round 16) — pass
  // the same mocked db object as tx so tx.insert/tx.update resolve.
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => {
    const { db } = await import('@/db/db');
    return op(db);
  },
}));

function chain(terminal: (...args: unknown[]) => unknown) {
  let capturedArgs: unknown[] = [];
  const c: Record<string, unknown> = {
    where: (...args: unknown[]) => {
      capturedArgs = args;
      return c;
    },
    orderBy: () => c,
    limit: () => c,
    offset: () => c,
    then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
      Promise.resolve(terminal(...capturedArgs)).then(resolve, reject),
  };
  return c;
}

vi.mock('@/db/db', () => ({
  db: {
    select: () => ({ from: () => chain(m.selectWhere) }),
    insert: () => ({ values: () => ({ returning: m.insertReturning }) }),
    update: () => ({ set: () => ({ where: (...args: unknown[]) => ({ returning: () => m.updateWhereReturning(...args) }) }) }),
  },
}));

vi.mock('@/db/schema/board-packet-schema', () => ({
  boardPackets: {
    id: 'boardPackets.id',
    organizationId: 'boardPackets.organizationId',
    createdAt: 'boardPackets.createdAt',
    status: 'boardPackets.status',
  },
}));

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (...args: unknown[]) => {
      m.eqCalls.push(args);
      return { __eq: args };
    },
    and: (...conds: unknown[]) => ({ __and: conds }),
  };
});

vi.mock('@/lib/services/board-packet-generator', () => ({
  boardPacketGenerator: { distributePacket: m.distributePacket },
}));

vi.mock('@/lib/audit-logger', () => ({
  auditDataMutation: m.auditDataMutation,
}));

const ORG_A = 'org-a-uuid';
const ORG_B = 'org-b-uuid';

beforeEach(() => {
  vi.clearAllMocks();
  m.eqCalls.length = 0;
  m.withApi.mockImplementation((_cfg: unknown, handler: unknown) => handler);
  m.selectWhere.mockResolvedValue([]);
  m.insertReturning.mockResolvedValue([{ id: 'packet-1', organizationId: ORG_A }]);
  m.updateWhereReturning.mockResolvedValue([{ id: 'packet-1', organizationId: ORG_A }]);
  m.distributePacket.mockResolvedValue([]);
});

describe('GET /api/governance/board-packets (list) — tenant isolation', () => {
  it('filters the list by the caller organizationId, not an unscoped select-all', async () => {
    const { GET } = await import('../route');

    await GET({
      request: new Request('http://x/api/governance/board-packets'),
      organizationId: ORG_A,
    } as never);

    const orgFilterCalls = m.eqCalls.filter((args) => args[0] === 'boardPackets.organizationId');
    expect(orgFilterCalls.length).toBeGreaterThan(0);
    expect(orgFilterCalls.every((args) => args[1] === ORG_A)).toBe(true);
  });
});

describe('POST /api/governance/board-packets (create) — tenant isolation', () => {
  it('forces organizationId from the resolved caller context, ignoring any body-supplied value', async () => {
    const { POST } = await import('../route');

    await POST({
      body: {
        title: 'Q1 Report',
        packetType: 'quarterly',
        organizationId: ORG_B, // attacker-supplied — must be ignored
        periodStart: '2026-01-01',
        periodEnd: '2026-03-31',
        fiscalYear: 2026,
        generatedBy: 'user-1',
        financialSummary: {},
        membershipStats: {},
        caseSummary: {},
        complianceStatus: {},
        recipientRoles: [],
      },
      userId: 'user-1',
      organizationId: ORG_A,
    } as never);

    expect(m.insertReturning).toHaveBeenCalled();
    expect(m.auditDataMutation).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: ORG_A }),
    );
  });
});

describe('GET/PATCH/DELETE /api/governance/board-packets/[id] — tenant isolation', () => {
  it('GET filters by both packet id and the caller organizationId', async () => {
    const { GET } = await import('../[id]/route');
    m.selectWhere.mockResolvedValue([{ id: 'packet-1', organizationId: ORG_A }]);

    await GET({
      request: new Request('http://x/api/governance/board-packets/packet-1'),
      organizationId: ORG_A,
    } as never);

    expect(m.eqCalls.some((a) => a[0] === 'boardPackets.id' && a[1] === 'packet-1')).toBe(true);
    expect(m.eqCalls.some((a) => a[0] === 'boardPackets.organizationId' && a[1] === ORG_A)).toBe(true);
  });

  it('GET 404s when the packet belongs to a different organization', async () => {
    const { GET } = await import('../[id]/route');
    m.selectWhere.mockResolvedValue([]);

    await expect(
      GET({
        request: new Request('http://x/api/governance/board-packets/packet-1'),
        organizationId: ORG_B,
      } as never),
    ).rejects.toThrow('404:');
  });

  it('PATCH scopes the update by organizationId, not just packet id', async () => {
    const { PATCH } = await import('../[id]/route');

    await PATCH({
      request: new Request('http://x/api/governance/board-packets/packet-1'),
      body: { title: 'Updated' },
      organizationId: ORG_A,
    } as never);

    expect(m.updateWhereReturning).toHaveBeenCalled();
    expect(m.eqCalls.some((a) => a[0] === 'boardPackets.organizationId' && a[1] === ORG_A)).toBe(true);
  });

  it('DELETE scopes the archive-update by organizationId, not just packet id', async () => {
    const { DELETE } = await import('../[id]/route');

    await DELETE({
      request: new Request('http://x/api/governance/board-packets/packet-1'),
      organizationId: ORG_A,
    } as never);

    expect(m.updateWhereReturning).toHaveBeenCalled();
    expect(m.eqCalls.some((a) => a[0] === 'boardPackets.organizationId' && a[1] === ORG_A)).toBe(true);
  });
});

describe('POST /api/governance/board-packets/[id]/distribute — tenant isolation', () => {
  it('verifies the packet belongs to the caller org BEFORE calling distributePacket', async () => {
    const { POST } = await import('../[id]/distribute/route');
    m.selectWhere.mockResolvedValue([{ id: 'packet-1' }]);

    await POST({
      params: { id: 'packet-1' },
      body: { recipients: [{ recipientId: 'r1', recipientName: 'A', recipientEmail: 'a@x.com', recipientRole: 'member' }] },
      organizationId: ORG_A,
    } as never);

    expect(m.eqCalls.some((a) => a[0] === 'boardPackets.organizationId' && a[1] === ORG_A)).toBe(true);
    expect(m.distributePacket).toHaveBeenCalledWith('packet-1', expect.any(Array));
  });

  it('404s and never calls distributePacket when the packet belongs to a different organization', async () => {
    const { POST } = await import('../[id]/distribute/route');
    m.selectWhere.mockResolvedValue([]);

    await expect(
      POST({
        params: { id: 'packet-1' },
        body: { recipients: [] },
        organizationId: ORG_B,
      } as never),
    ).rejects.toThrow('404:');

    expect(m.distributePacket).not.toHaveBeenCalled();
  });
});

