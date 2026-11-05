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
 * The predicates a route builds are rendered with the real drizzle dialect and the real schema, so what is asserted is the SQL condition the database
 * receives (the column and the value), not the shape of a query-builder chain. board-packets-routes.postgres.test.ts proves the same isolation on
 * PostgreSQL as the real roles.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  createBoardPacket: vi.fn(),
  applyBoardPacketUpdate: vi.fn(),
  distributePacket: vi.fn(),
  wheres: [] as unknown[],
  tx: {} as Record<string, unknown>,
}));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const { ApiError } = await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors');
  return { withApi: m.withApi, ApiError, z };
});
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/governance/board-packet-service', () => ({
  createBoardPacket: m.createBoardPacket,
  applyBoardPacketUpdate: m.applyBoardPacketUpdate,
}));
vi.mock('@/lib/services/board-packet-generator', () => ({ boardPacketGenerator: { distributePacket: m.distributePacket } }));

const dialect = new PgDialect();
const render = (condition: unknown) => dialect.sqlToQuery(condition as SQL);

const ORG_A = '7d3a0a3e-1c2b-4f5e-9a60-0a1b2c3d4e5f';
const ORG_B = '9b8c7d6e-5f4a-4b3c-8d2e-1f0a9b8c7d6e';
const PACKET = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';
const MEMBER = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

const validPacket = {
  title: 'Q1 Report',
  packetType: 'quarterly',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  fiscalYear: 2026,
  financialSummary: { summary: 'On plan' },
  membershipStats: { summary: 'Steady' },
  caseSummary: { summary: 'Twelve open' },
  complianceStatus: { summary: 'Two outstanding' },
  recipientRoles: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  m.wheres.length = 0;
  m.withApi.mockImplementation((_config: unknown, handler: unknown) => handler);
  m.withRLSContext.mockImplementation(async (_context: unknown, work: (tx: unknown) => Promise<unknown>) => work(m.tx));
  m.createBoardPacket.mockResolvedValue({ id: PACKET, organizationId: ORG_A });
  m.applyBoardPacketUpdate.mockResolvedValue({ id: PACKET, organizationId: ORG_A });
  m.distributePacket.mockResolvedValue({ distributions: [], delivered: 0, failed: 0 });
  // Every select ends in the rows a list or a single read returns; the condition handed to .where() is recorded.
  m.tx.select = vi.fn((columns?: Record<string, unknown>) => {
    const counting = columns !== undefined && 'total' in columns;
    const query = {
      from: () => query,
      where: (condition: unknown) => {
        m.wheres.push(condition);
        return counting ? Promise.resolve([{ total: 0 }]) : query;
      },
      orderBy: () => query,
      limit: () => query,
      offset: () => query,
      then: (resolve: (rows: unknown[]) => void) => resolve([{ id: PACKET, organizationId: ORG_A }]),
    };
    return query;
  });
});

describe('GET /api/governance/board-packets (list) — tenant isolation', () => {
  it('opens the transaction for the caller organization and filters the list by it, not by anything in the request', async () => {
    const { GET } = await import('../route');
    await (GET as unknown as (ctx: unknown) => Promise<unknown>)({
      request: new Request(`http://x/api/governance/board-packets?organizationId=${ORG_B}`),
      organizationId: ORG_A,
    });

    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG_A }, expect.any(Function));
    expect(m.wheres.length).toBe(2);
    for (const condition of m.wheres) {
      const { sql, params } = render(condition);
      expect(sql).toContain('"board_packets"."organization_id" = $1');
      expect(params[0]).toBe(ORG_A);
      expect(params).not.toContain(ORG_B);
    }
  });
});

describe('POST /api/governance/board-packets (create) — tenant isolation', () => {
  it('creates in the caller organization, as the caller', async () => {
    const { POST } = await import('../route');
    await (POST as unknown as (ctx: unknown) => Promise<unknown>)({ body: validPacket, userId: 'user-1', organizationId: ORG_A });

    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG_A }, expect.any(Function));
    expect(m.createBoardPacket).toHaveBeenCalledWith(m.tx, { organizationId: ORG_A, userId: 'user-1', packet: validPacket });
  });

  it('refuses a body that names an organization, a preparer or a status, and creates nothing', async () => {
    const { POST } = await import('../route');
    for (const extra of [{ organizationId: ORG_B }, { generatedBy: 'someone-else' }, { status: 'finalized' }]) {
      await expect(
        (POST as unknown as (ctx: unknown) => Promise<unknown>)({ body: { ...validPacket, ...extra }, userId: 'user-1', organizationId: ORG_A }),
      ).rejects.toMatchObject({ name: 'ZodError' });
    }
    expect(m.createBoardPacket).not.toHaveBeenCalled();
  });
});

describe('GET/PATCH/DELETE /api/governance/board-packets/[id] — tenant isolation', () => {
  it('GET filters by both the packet id and the caller organization', async () => {
    const { GET } = await import('../[id]/route');
    await (GET as unknown as (ctx: unknown) => Promise<unknown>)({ params: { id: PACKET }, organizationId: ORG_A });

    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG_A }, expect.any(Function));
    const { sql, params } = render(m.wheres[0]);
    expect(sql).toContain('"board_packets"."id" = $1');
    expect(sql).toContain('"board_packets"."organization_id" = $2');
    expect(params).toEqual([PACKET, ORG_A]);
  });

  it('GET answers not found when the packet is not in the caller organization', async () => {
    const { GET } = await import('../[id]/route');
    (m.tx.select as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      const query: Record<string, unknown> = {
        from: () => query,
        where: () => query,
        limit: () => query,
        then: (resolve: (rows: unknown[]) => void) => resolve([]),
      };
      return query;
    });
    await expect((GET as unknown as (ctx: unknown) => Promise<unknown>)({ params: { id: PACKET }, organizationId: ORG_B })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('PATCH applies the update in the caller organization, as the caller', async () => {
    const { PATCH } = await import('../[id]/route');
    await (PATCH as unknown as (ctx: unknown) => Promise<unknown>)({ params: { id: PACKET }, body: { title: 'Updated' }, organizationId: ORG_A, userId: 'user-1' });

    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: ORG_A }, expect.any(Function));
    expect(m.applyBoardPacketUpdate).toHaveBeenCalledWith(m.tx, { packetId: PACKET, organizationId: ORG_A, userId: 'user-1', request: { title: 'Updated' } });
  });

  it('DELETE archives in the caller organization, as the caller', async () => {
    const { DELETE } = await import('../[id]/route');
    await (DELETE as unknown as (ctx: unknown) => Promise<unknown>)({ params: { id: PACKET }, organizationId: ORG_A, userId: 'user-1' });

    expect(m.applyBoardPacketUpdate).toHaveBeenCalledWith(m.tx, { packetId: PACKET, organizationId: ORG_A, userId: 'user-1', request: { status: 'archived' } });
  });
});

describe('POST /api/governance/board-packets/[id]/distribute — tenant isolation', () => {
  it('hands the caller organization to the service, which reads the packet by it', async () => {
    const { POST } = await import('../[id]/distribute/route');
    await (POST as unknown as (ctx: unknown) => Promise<unknown>)({
      params: { id: PACKET },
      body: { recipients: [{ recipientId: MEMBER, recipientRole: 'board_member' }] },
      organizationId: ORG_A,
      userId: 'admin-1',
    });

    expect(m.distributePacket).toHaveBeenCalledWith(PACKET, [{ recipientId: MEMBER, recipientRole: 'board_member' }], { organizationId: ORG_A, userId: 'admin-1' });
  });

  it('answers not found, and calls no service, for an id that is not a uuid', async () => {
    const { POST } = await import('../[id]/distribute/route');
    await expect(
      (POST as unknown as (ctx: unknown) => Promise<unknown>)({
        params: { id: 'not-a-uuid' },
        body: { recipients: [{ recipientId: MEMBER, recipientRole: 'board_member' }] },
        organizationId: ORG_B,
        userId: 'admin-2',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.distributePacket).not.toHaveBeenCalled();
  });
});
