import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockSelect: vi.fn(),
  mockExecute: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockSet: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockFrom: vi.fn(),
  mockCreateHash: vi.fn(),
  mockRenderToBuffer: vi.fn(),
  mockGetEmailService: vi.fn(),
  mockMoneyToNumber: vi.fn(),
  mockAudit: vi.fn(),
  tx: {} as Record<string, unknown>,
}));

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mocks.tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.mockAudit }));
vi.mock('@/db/schema/organization-members-schema', () => ({
  organizationMembers: { userId: 'user_id', organizationId: 'organization_id', email: 'email', deletedAt: 'deleted_at' },
}));

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert,
    update: mocks.mockUpdate,
    select: mocks.mockSelect,
    execute: mocks.mockExecute,
  },
}));

vi.mock('@/db/schema/board-packet-schema', () => ({
  boardPackets: { id: 'id', organizationId: 'organization_id' },
  boardPacketDistributions: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((a, b) => ({ field: a, values: b })),
  isNull: vi.fn((a) => ({ isNull: a })),
  sql: vi.fn((...args: any[]) => args),
}));

vi.mock('crypto', () => ({
  default: {
    createHash: mocks.mockCreateHash,
    randomBytes: vi.fn(() => Buffer.from('abcd1234', 'hex')),
  },
}));

vi.mock('@react-pdf/renderer', () => ({
  Document: vi.fn(),
  Page: vi.fn(),
  StyleSheet: { create: vi.fn(() => ({})) },
  Text: vi.fn(),
  renderToBuffer: mocks.mockRenderToBuffer,
}));

vi.mock('react', () => ({
  default: { createElement: vi.fn() },
  createElement: vi.fn(),
}));

vi.mock('@/lib/services/messaging/email-service', () => ({
  getEmailService: mocks.mockGetEmailService,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/decimal-safe', () => ({
  moneyToNumber: mocks.mockMoneyToNumber,
}));

import { BoardPacketGenerator } from '../board-packet-generator';

describe('BoardPacketGenerator', () => {
  let generator: BoardPacketGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = new BoardPacketGenerator();

    mocks.mockMoneyToNumber.mockReturnValue(0);
    mocks.mockExecute.mockResolvedValue([{ totalAmount: 0, count: 0 }]);

    // Chain: insert().values().returning()
    mocks.mockReturning.mockResolvedValue([{
      id: 'pkt-1',
      title: 'Test Packet',
      packetType: 'monthly',
      status: 'draft',
      contentHash: 'abc',
    }]);
    mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
    mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

    // Chain: update().set().where().returning()
    mocks.mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 'pkt-1', status: 'finalized' }]),
        }),
      }),
    });

    // Chain: select().from().where().limit()
    mocks.mockLimit.mockResolvedValue([{ id: 'pkt-1', title: 'Test Packet' }]);
    mocks.mockWhere.mockReturnValue({ limit: mocks.mockLimit });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    // Hash
    mocks.mockCreateHash.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue('hash123'),
    });

    mocks.mockRenderToBuffer.mockResolvedValue(Buffer.from('pdf'));
    mocks.mockGetEmailService.mockReturnValue({
      send: vi.fn().mockResolvedValue({ id: 'email-1' }),
    });
  });

  describe('generatePacket', () => {
    const packetData = {
      title: 'Monthly Board Packet',
      organizationId: 'org-1',
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-01-31'),
      generatedBy: 'user-1',
    };

    it('generates a board packet with default monthly type', async () => {
      const result = await generator.generatePacket(packetData);
      expect(result).toBeDefined();
      expect(result.id).toBe('pkt-1');
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('uses specified packet type', async () => {
      await generator.generatePacket({ ...packetData, packetType: 'quarterly' });
      expect(mocks.mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ packetType: 'quarterly' }),
      );
    });

    it('calculates content hash using sha256', async () => {
      await generator.generatePacket(packetData);
      expect(mocks.mockCreateHash).toHaveBeenCalledWith('sha256');
    });

    it('throws on db insert failure', async () => {
      mocks.mockReturning.mockRejectedValue(new Error('DB error'));
      await expect(generator.generatePacket(packetData)).rejects.toThrow('DB error');
    });
  });

  describe('finalizePacket', () => {
    it('updates packet status to finalized', async () => {
      const result = await generator.finalizePacket('pkt-1', 'org-1', 'user-1');
      expect(result).toBeDefined();
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('throws on update failure', async () => {
      mocks.mockUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockRejectedValue(new Error('Update failed')),
          }),
        }),
      });
      await expect(generator.finalizePacket('pkt-1', 'org-1', 'user-1')).rejects.toThrow('Update failed');
    });
  });

  describe('distributePacket', () => {
    const context = { organizationId: 'org-1', userId: 'admin-1' };
    const recipients = [
      { recipientId: 'u1', recipientName: 'Alice', recipientEmail: 'forged@elsewhere.test', recipientRole: 'board_member' },
    ];
    let send: ReturnType<typeof vi.fn>;
    let txInsertValues: ReturnType<typeof vi.fn>;
    let txUpdateReturning: ReturnType<typeof vi.fn>;
    let members: Array<{ userId: string; email: string }>;

    beforeEach(() => {
      members = [{ userId: 'u1', email: 'alice@union.test' }];
      send = vi.fn().mockResolvedValue({ id: 'email-1' });
      mocks.mockGetEmailService.mockReturnValue({ send });
      mocks.mockLimit.mockResolvedValue([{ id: 'pkt-1', title: 'Test Packet', status: 'finalized' }]);
      mocks.mockAudit.mockResolvedValue(undefined);

      txInsertValues = vi.fn((rows: Array<Record<string, unknown>>) => ({ returning: async () => rows.map((row, i) => ({ id: `d${i}`, ...row })) }));
      txUpdateReturning = vi.fn(async () => [{ id: 'pkt-1' }]);
      mocks.tx.select = vi.fn(() => ({ from: () => ({ where: async () => members }) }));
      mocks.tx.insert = vi.fn(() => ({ values: txInsertValues }));
      mocks.tx.update = vi.fn(() => ({ set: vi.fn(() => ({ where: () => ({ returning: txUpdateReturning }) })) }));
    });

    it('records the distribution, the status change and the audit on one transaction, then emails the member address on file', async () => {
      const result = await generator.distributePacket('pkt-1', recipients, context);

      expect(mocks.tx.insert).toHaveBeenCalledTimes(1);
      expect(mocks.tx.update).toHaveBeenCalledTimes(1);
      expect(mocks.mockAudit).toHaveBeenCalledWith(
        mocks.tx,
        expect.objectContaining({ organizationId: 'org-1', userId: 'admin-1', action: 'board_packet.distribute', resourceId: 'pkt-1' }),
      );
      expect(txInsertValues).toHaveBeenCalledWith([expect.objectContaining({ recipientEmail: 'alice@union.test' })]);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'alice@union.test' }));
      expect(result).toMatchObject({ delivered: 1, failed: 0 });
    });

    it('refuses a recipient who is not a member of the organization, and distributes nothing', async () => {
      members = [];
      await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(mocks.tx.insert).not.toHaveBeenCalled();
      expect(mocks.mockAudit).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('refuses a packet that is not finalized', async () => {
      mocks.mockLimit.mockResolvedValue([{ id: 'pkt-1', title: 'Test Packet', status: 'draft' }]);
      await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(send).not.toHaveBeenCalled();
    });

    it('answers a conflict, sends nothing and writes no audit when the packet changed concurrently', async () => {
      txUpdateReturning.mockResolvedValueOnce([]);
      await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(mocks.mockAudit).not.toHaveBeenCalled();
      expect(send).not.toHaveBeenCalled();
    });

    it('sends nothing when the audit cannot be written', async () => {
      mocks.mockAudit.mockRejectedValueOnce(new Error('audit unavailable'));
      await expect(generator.distributePacket('pkt-1', recipients, context)).rejects.toThrow('audit unavailable');
      expect(send).not.toHaveBeenCalled();
    });

    it('reports and audits a failed delivery without undoing the recorded distribution', async () => {
      send.mockRejectedValueOnce(new Error('smtp down'));
      const result = await generator.distributePacket('pkt-1', recipients, context);
      expect(result).toMatchObject({ delivered: 0, failed: 1 });
      expect(mocks.mockAudit).toHaveBeenCalledWith(
        mocks.tx,
        expect.objectContaining({ action: 'board_packet.distribute.delivery_failed', details: { failedRecipientIds: ['u1'] } }),
      );
    });

    it('throws if packet not found (or belongs to another organization)', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      await expect(generator.distributePacket('pkt-999', recipients, context)).rejects.toThrow('Board packet not found');
    });
  });
});
