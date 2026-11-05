import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  withRLSContext: vi.fn(),
  createBoardPacket: vi.fn(),
  applyBoardPacketUpdate: vi.fn(),
  distributePacket: vi.fn(),
  selected: [] as Array<{ columns: Record<string, unknown> | undefined; where: unknown; limit?: number; offset?: number }>,
  total: 0,
  rows: [] as unknown[],
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

const ORG = '7d3a0a3e-1c2b-4f5e-9a60-0a1b2c3d4e5f';
const PACKET = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';
const MEMBER = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const MEMBER_2 = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';

type Handler = (ctx: unknown) => Promise<unknown>;
const call = (handler: unknown, ctx: Record<string, unknown>) => (handler as Handler)({ organizationId: ORG, userId: 'admin-1', ...ctx });
const listRequest = (query = '') => ({ request: new Request(`http://x/api/governance/board-packets${query}`) });

beforeEach(() => {
  vi.clearAllMocks();
  m.selected.length = 0;
  m.total = 0;
  m.rows = [];
  m.withApi.mockImplementation((config: unknown, handler: unknown) => Object.assign(handler as object, { config }));
  m.withRLSContext.mockImplementation(async (_context: unknown, work: (tx: unknown) => Promise<unknown>) => work(m.tx));
  m.createBoardPacket.mockResolvedValue({ id: PACKET });
  m.applyBoardPacketUpdate.mockResolvedValue({ id: PACKET });
  m.distributePacket.mockResolvedValue({ distributions: [], delivered: 0, failed: 0 });
  m.tx.select = vi.fn((columns?: Record<string, unknown>) => {
    const entry: (typeof m.selected)[number] = { columns, where: undefined };
    m.selected.push(entry);
    const query: Record<string, unknown> = {
      from: () => query,
      where: (condition: unknown) => {
        entry.where = condition;
        return columns && 'total' in columns ? Promise.resolve([{ total: m.total }]) : query;
      },
      orderBy: () => query,
      limit: (value: number) => {
        entry.limit = value;
        return query;
      },
      offset: (value: number) => {
        entry.offset = value;
        return query;
      },
      then: (resolve: (rows: unknown[]) => void) => resolve(m.rows),
    };
    return query;
  });
});

describe('what each board packet route asks of the wrapper', () => {
  it('lets an officer read and requires an admin to create, change, archive or distribute, all under the governance entitlement', async () => {
    const list = await import('../route');
    const item = await import('../[id]/route');
    const distribute = await import('../[id]/distribute/route');
    const config = (handler: unknown) => (handler as { config: { auth: { minRole: string }; entitlement: string } }).config;
    expect(config(list.GET).auth.minRole).toBe('officer');
    expect(config(item.GET).auth.minRole).toBe('officer');
    for (const handler of [list.POST, item.PATCH, item.DELETE, distribute.POST]) expect(config(handler).auth.minRole).toBe('admin');
    for (const handler of [list.GET, list.POST, item.GET, item.PATCH, item.DELETE, distribute.POST]) expect(config(handler).entitlement).toBe('governance_suite');
  });
});

describe('GET /api/governance/board-packets', () => {
  it('returns a page of packets with the real total, and the offset of the page asked for', async () => {
    m.total = 12;
    m.rows = [{ id: PACKET }];
    const { GET } = await import('../route');
    const result = await call(GET, listRequest('?page=2&limit=5'));

    expect(result).toEqual({ data: [{ id: PACKET }], pagination: { page: 2, limit: 5, total: 12, totalPages: 3 } });
    const page = m.selected.find((entry) => entry.columns && !('total' in entry.columns));
    expect(page).toMatchObject({ limit: 5, offset: 5 });
  });

  it('lists the descriptors of a packet and not its sections, its action items or its PDF', async () => {
    const { GET } = await import('../route');
    await call(GET, listRequest());
    const columns = Object.keys(m.selected.find((entry) => entry.columns && !('total' in entry.columns))!.columns!);
    expect(columns).toEqual(expect.arrayContaining(['id', 'title', 'status', 'finalizedAt', 'signedBy', 'contentHash', 'distributedAt']));
    for (const heavy of ['financialSummary', 'membershipStats', 'caseSummary', 'complianceStatus', 'actionItems', 'attachments', 'pdfUrl', 'distributionList', 'metadata']) {
      expect(columns).not.toContain(heavy);
    }
  });

  it('leaves archived packets out unless they are asked for', async () => {
    const { GET } = await import('../route');
    await call(GET, listRequest());
    const byDefault = render(m.selected[0].where);
    expect(byDefault.sql).toContain('"board_packets"."status" <> $2');
    expect(byDefault.params).toEqual([ORG, 'archived']);

    m.selected.length = 0;
    await call(GET, listRequest('?status=archived'));
    const archived = render(m.selected[0].where);
    expect(archived.sql).toContain('"board_packets"."status" = $2');
    expect(archived.params).toEqual([ORG, 'archived']);
  });

  it('refuses a status that is not one of the four, and a page that is not a positive number', async () => {
    const { GET } = await import('../route');
    await expect(call(GET, listRequest('?status=approved'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(call(GET, listRequest('?page=0'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(call(GET, listRequest('?limit=101'))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });
});

describe('POST /api/governance/board-packets', () => {
  it('returns the packet the service created', async () => {
    const { POST } = await import('../route');
    const body = {
      title: 'Q1',
      packetType: 'monthly',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-31',
      fiscalYear: 2026,
      financialSummary: { summary: 'a' },
      membershipStats: { summary: 'b' },
      caseSummary: { summary: 'c' },
      complianceStatus: { summary: 'd' },
      recipientRoles: [],
    };
    expect(await call(POST, { body })).toEqual({ id: PACKET });
  });

  it('refuses a request that is not a packet, and creates nothing', async () => {
    const { POST } = await import('../route');
    await expect(call(POST, { body: undefined })).rejects.toMatchObject({ name: 'ZodError' });
    await expect(call(POST, { body: { title: 'only a title' } })).rejects.toMatchObject({ name: 'ZodError' });
    expect(m.createBoardPacket).not.toHaveBeenCalled();
  });
});

describe('PATCH and DELETE /api/governance/board-packets/[id]', () => {
  it('answers not found, and opens no transaction, for an id that is not a uuid', async () => {
    const { GET, PATCH, DELETE } = await import('../[id]/route');
    for (const handler of [GET, PATCH, DELETE]) {
      await expect(call(handler, { params: { id: 'bp_1' }, body: { title: 'x' } })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('refuses an update that changes nothing, sets the distributed status, or names a field the server records', async () => {
    const { PATCH } = await import('../[id]/route');
    for (const body of [{}, undefined, { status: 'distributed' }, { contentHash: 'x' }, { signedBy: 'x' }, { generatedBy: 'x' }, { pdfUrl: 'https://x.test/a.pdf' }]) {
      await expect(call(PATCH, { params: { id: PACKET }, body })).rejects.toMatchObject({ name: 'ZodError' });
    }
    expect(m.applyBoardPacketUpdate).not.toHaveBeenCalled();
  });

  it('answers what the service answers: a locked packet is a conflict, not a success', async () => {
    const { ApiError } = await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors');
    m.applyBoardPacketUpdate.mockRejectedValueOnce(ApiError.conflict('A finalized board packet cannot be edited: reopen it as a draft first'));
    const { PATCH } = await import('../[id]/route');
    await expect(call(PATCH, { params: { id: PACKET }, body: { title: 'x' } })).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('is named for what it does: DELETE archives', async () => {
    const { DELETE } = await import('../[id]/route');
    const summary = (DELETE as unknown as { config: { openapi: { summary: string } } }).config.openapi.summary;
    expect(summary).toBe('Archive board packet');
  });
});

describe('POST /api/governance/board-packets/[id]/distribute', () => {
  const schema = async () => ((await import('../[id]/distribute/route')).POST as unknown as { config: { body: { safeParse: (value: unknown) => { success: boolean } } } }).config.body;
  const recipient = { recipientId: MEMBER, recipientRole: 'board_member' };

  it('takes recipients by member id and role: names and addresses come from the membership record, so a request that sends them is refused', async () => {
    const body = await schema();
    expect(body.safeParse({ recipients: [recipient] }).success).toBe(true);
    expect(body.safeParse({ recipients: [{ ...recipient, recipientEmail: 'forged@elsewhere.test' }] }).success).toBe(false);
    expect(body.safeParse({ recipients: [{ ...recipient, recipientName: 'Anyone' }] }).success).toBe(false);
  });

  it('needs at least one recipient, names each once, and bounds what is stored', async () => {
    const body = await schema();
    expect(body.safeParse({ recipients: [] }).success).toBe(false);
    expect(body.safeParse({ recipients: [recipient, recipient] }).success).toBe(false);
    expect(body.safeParse({ recipients: [recipient, { ...recipient, recipientId: MEMBER_2 }] }).success).toBe(true);
    expect(body.safeParse({ recipients: [{ ...recipient, recipientRole: 'x'.repeat(51) }] }).success).toBe(false);
    expect(body.safeParse({ recipients: [{ ...recipient, recipientId: 'not-a-uuid' }] }).success).toBe(false);
  });

  it('reports delivery honestly: recorded but not delivered is not "distributed successfully"', async () => {
    const { POST } = await import('../[id]/distribute/route');
    m.distributePacket.mockResolvedValueOnce({ distributions: [{ id: 'd0' }], delivered: 0, failed: 1 });
    const response = (await call(POST, { params: { id: PACKET }, body: { recipients: [recipient] } })) as Response;
    expect(await response.json()).toMatchObject({
      message: 'Board packet distribution recorded; delivery failed for some recipients',
      stats: { totalRecipients: 1, sent: 0, failed: 1 },
    });
  });
});
