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
  sql: vi.fn((...args: unknown[]) => args),
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
      const result = await generator.finalizePacket('pkt-1', 'user-1');
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
      await expect(generator.finalizePacket('pkt-1', 'user-1')).rejects.toThrow('Update failed');
    });
  });

  describe('distributePacket', () => {
    const recipients = [
      { recipientId: 'u1', recipientName: 'Alice', recipientEmail: 'alice@test.com', recipientRole: 'board_member' },
    ];

    it('distributes packet to recipients', async () => {
      await generator.distributePacket('pkt-1', recipients);
      expect(mocks.mockSelect).toHaveBeenCalled();
    });

    it('throws if packet not found', async () => {
      mocks.mockLimit.mockResolvedValue([]);
      await expect(generator.distributePacket('pkt-999', recipients)).rejects.toThrow();
    });
  });
});
