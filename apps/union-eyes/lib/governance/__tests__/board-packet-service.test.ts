import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { boardPacketContentHash } from '../board-packet-lifecycle';

const mocks = vi.hoisted(() => ({ audit: vi.fn() }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));

import { applyBoardPacketUpdate, createBoardPacket } from '../board-packet-service';

const dialect = new PgDialect();
const render = (condition: unknown) => dialect.sqlToQuery(condition as SQL);

const content = {
  title: 'Q1 packet',
  description: null,
  packetType: 'quarterly',
  periodStart: '2026-01-01',
  periodEnd: '2026-03-31',
  fiscalYear: 2026,
  fiscalQuarter: 1,
  financialSummary: { summary: 'On plan' },
  membershipStats: { summary: 'Steady' },
  caseSummary: { summary: 'Twelve open' },
  motionsAndVotes: null,
  auditExceptions: null,
  complianceStatus: { summary: 'Two outstanding' },
  actionItems: null,
  recipientRoles: ['board_member'],
  attachments: null,
};
const ORG = '7d3a0a3e-1c2b-4f5e-9a60-0a1b2c3d4e5f';
const PACKET = '3f2b8c1e-5d4a-4f6b-9a7c-1e2d3c4b5a69';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: PACKET,
  organizationId: ORG,
  generatedBy: 'admin-0',
  status: 'draft',
  finalizedAt: null,
  signedBy: null,
  signedAt: null,
  contentHash: null,
  ...content,
  ...overrides,
});

describe('board packet service', () => {
  let current: Record<string, unknown> | undefined;
  let selectWhere: unknown;
  let lockMode: string | undefined;
  let updateSet: Record<string, unknown> | undefined;
  let updateWhere: unknown;
  let updateReturning: ReturnType<typeof vi.fn>;
  let insertValues: Record<string, unknown> | undefined;
  const tx = {} as Record<string, unknown>;

  beforeEach(() => {
    vi.clearAllMocks();
    current = row();
    selectWhere = undefined;
    lockMode = undefined;
    updateSet = undefined;
    updateWhere = undefined;
    insertValues = undefined;
    mocks.audit.mockResolvedValue(undefined);
    updateReturning = vi.fn(async () => [{ ...current, ...updateSet }]);
    tx.select = vi.fn(() => ({
      from: () => ({
        where: (condition: unknown) => {
          selectWhere = condition;
          return {
            for: async (mode: string) => {
              lockMode = mode;
              return current ? [current] : [];
            },
          };
        },
      }),
    }));
    tx.update = vi.fn(() => ({
      set: (set: Record<string, unknown>) => {
        updateSet = set;
        return {
          where: (condition: unknown) => {
            updateWhere = condition;
            return { returning: updateReturning };
          },
        };
      },
    }));
    tx.insert = vi.fn(() => ({
      values: (values: Record<string, unknown>) => {
        insertValues = values;
        return { returning: async () => [{ id: PACKET, ...values }] };
      },
    }));
  });

  describe('createBoardPacket', () => {
    const packet = {
      title: 'Q1 packet',
      packetType: 'quarterly' as const,
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      fiscalYear: 2026,
      financialSummary: { summary: 'On plan' },
      membershipStats: { summary: 'Steady' },
      caseSummary: { summary: 'Twelve open' },
      complianceStatus: { summary: 'Two outstanding' },
      recipientRoles: [],
    };

    it('stores a draft prepared by the caller in the caller organization, and audits it on the same transaction', async () => {
      const created = await createBoardPacket(tx as never, { organizationId: ORG, userId: 'admin-1', packet });
      expect(insertValues).toMatchObject({ ...packet, organizationId: ORG, generatedBy: 'admin-1', status: 'draft' });
      expect(created.id).toBe(PACKET);
      expect(mocks.audit).toHaveBeenCalledWith(tx, {
        organizationId: ORG,
        userId: 'admin-1',
        action: 'governance.board_packet.create',
        resourceType: 'board_packets',
        resourceId: PACKET,
        details: { title: 'Q1 packet', packetType: 'quarterly', status: 'draft' },
      });
    });

    it('stores nothing a failed audit would leave unrecorded: the failure reaches the caller, whose transaction rolls back', async () => {
      mocks.audit.mockRejectedValueOnce(new Error('audit sink unavailable'));
      await expect(createBoardPacket(tx as never, { organizationId: ORG, userId: 'admin-1', packet })).rejects.toThrow('audit sink unavailable');
    });
  });

  describe('applyBoardPacketUpdate', () => {
    const input = (request: Record<string, unknown>) => ({ packetId: PACKET, organizationId: ORG, userId: 'admin-1', request });

    it('reads the packet by id and organization under a row lock', async () => {
      await applyBoardPacketUpdate(tx as never, input({ title: 'Renamed' }));
      const { sql, params } = render(selectWhere);
      expect(sql).toMatch(/"board_packets"\."id" = \$1/);
      expect(sql).toMatch(/"board_packets"\."organization_id" = \$2/);
      expect(params).toEqual([PACKET, ORG]);
      expect(lockMode).toBe('update');
    });

    it('writes an edit only to a packet still in the status it was planned from, and audits it on the same transaction', async () => {
      const updated = await applyBoardPacketUpdate(tx as never, input({ title: 'Renamed' }));
      const { sql, params } = render(updateWhere);
      expect(sql).toMatch(/"board_packets"\."id" = \$1/);
      expect(sql).toMatch(/"board_packets"\."organization_id" = \$2/);
      expect(sql).toMatch(/"board_packets"\."status" = \$3/);
      expect(params).toEqual([PACKET, ORG, 'draft']);
      expect(updated).toMatchObject({ title: 'Renamed' });
      expect(mocks.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ organizationId: ORG, userId: 'admin-1', action: 'board_packet.update', resourceId: PACKET, details: { fields: ['title'] } }));
    });

    it('finalizes with the caller as the certifier and the hash of the content', async () => {
      await applyBoardPacketUpdate(tx as never, input({ status: 'finalized' }));
      expect(updateSet).toMatchObject({ status: 'finalized', signedBy: 'admin-1', contentHash: boardPacketContentHash(content as never) });
      expect(updateSet?.finalizedAt).toBeInstanceOf(Date);
      expect(mocks.audit).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'board_packet.finalize', details: expect.objectContaining({ contentHash: boardPacketContentHash(content as never) }) }));
    });

    it('answers not found, and writes nothing, for a packet that is not in the organization', async () => {
      current = undefined;
      await expect(applyBoardPacketUpdate(tx as never, input({ title: 'x' }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(tx.update).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('answers a conflict, and writes nothing, when the lifecycle refuses the move', async () => {
      current = row({ status: 'finalized', contentHash: boardPacketContentHash(content as never) });
      await expect(applyBoardPacketUpdate(tx as never, input({ title: 'x' }))).rejects.toMatchObject({ code: 'CONFLICT', details: { code: 'LOCKED' } });
      expect(tx.update).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('answers a request error for a period that ends before it starts', async () => {
      await expect(applyBoardPacketUpdate(tx as never, input({ periodEnd: '2025-12-31' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(tx.update).not.toHaveBeenCalled();
    });

    it('records nothing for a request that changes nothing', async () => {
      const result = await applyBoardPacketUpdate(tx as never, input({ status: 'draft' }));
      expect(result).toBe(current);
      expect(tx.update).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('answers a conflict, and audits nothing, when the packet is no longer in the status it was planned from', async () => {
      updateReturning.mockResolvedValueOnce([]);
      await expect(applyBoardPacketUpdate(tx as never, input({ title: 'x' }))).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(mocks.audit).not.toHaveBeenCalled();
    });

    it('lets a failed audit reach the caller, whose transaction rolls the update back', async () => {
      mocks.audit.mockRejectedValueOnce(new Error('audit sink unavailable'));
      await expect(applyBoardPacketUpdate(tx as never, input({ title: 'x' }))).rejects.toThrow('audit sink unavailable');
    });
  });
});
