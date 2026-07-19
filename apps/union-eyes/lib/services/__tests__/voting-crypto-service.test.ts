import { createSign, generateKeyPairSync } from 'crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  const mockOrderBy = vi.fn().mockResolvedValue([]);
  const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere, orderBy: mockOrderBy });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  return {
    mockDb: { insert: mockInsert, select: mockSelect, update: mockUpdate },
    mockInsert,
    mockInsertValues,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockSelect,
    mockFrom,
    mockWhere,
    mockOrderBy,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/db', () => ({ db: mocks.mockDb }));
vi.mock('@/db/schema/domains/governance', () => ({
  votingAuditLog: { id: 'id', sessionId: 'sessionId', votedAt: 'votedAt' },
}));
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_column, value) => ({ _type: 'eq', value })),
  asc: vi.fn(),
}));

import {
  deriveVotingSessionKey,
  signVote,
  verifyVoteSignature,
  generateVoteReceipt,
  createVotingAuditLog,
  verifyElectionIntegrity,
} from '../voting-crypto-service';

import { logger } from '@/lib/logger';

describe('voting-crypto-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const sessionId = 'session-vote-001';
  const sessionSecret = 'super-secret-voting-key-for-tests';

  describe('deriveVotingSessionKey', () => {
    it('returns a 32-byte Buffer', () => {
      const key = deriveVotingSessionKey(sessionId, sessionSecret);
      expect(Buffer.isBuffer(key)).toBe(true);
      expect(key.length).toBe(32);
    });

    it('throws when sessionSecret is undefined', () => {
      expect(() => deriveVotingSessionKey(sessionId, undefined)).toThrow(
        'VOTING_SECRET environment variable must be set'
      );
    });

    it('produces deterministic output for same inputs', () => {
      const key1 = deriveVotingSessionKey(sessionId, sessionSecret);
      const key2 = deriveVotingSessionKey(sessionId, sessionSecret);
      expect(key1.equals(key2)).toBe(true);
    });
  });

  describe('signVote', () => {
    it('returns voteHash, signature, and nonce', () => {
      const key = deriveVotingSessionKey(sessionId, sessionSecret);
      const voteData = {
        sessionId,
        optionId: 'option-accept',
        memberId: 'member-456',
        timestamp: Date.now() / 1000,
      };

      const result = signVote(voteData, key);

      expect(result.voteHash).toMatch(/^[0-9a-f]+$/);
      expect(result.signature).toMatch(/^[0-9a-f]+$/);
      expect(result.nonce).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('verifyVoteSignature', () => {
    it('returns true for a valid signature', () => {
      const key = deriveVotingSessionKey(sessionId, sessionSecret);
      const timestamp = Date.now() / 1000;
      const voteData = {
        sessionId,
        optionId: 'option-accept',
        memberId: 'member-456',
        timestamp,
      };

      const sig = signVote(voteData, key);
      const valid = verifyVoteSignature(voteData, sig, key, 300);

      expect(valid).toBe(true);
    });

    it('returns false for expired signature', () => {
      const key = deriveVotingSessionKey(sessionId, sessionSecret);
      const oldTimestamp = Date.now() / 1000 - 600; // 10 minutes ago
      const voteData = {
        sessionId,
        optionId: 'option-accept',
        memberId: 'member-456',
        timestamp: oldTimestamp,
      };

      const sig = signVote(voteData, key);
      const valid = verifyVoteSignature(voteData, sig, key, 300);

      expect(valid).toBe(false);
    });

    it('returns false for tampered vote data', () => {
      const key = deriveVotingSessionKey(sessionId, sessionSecret);
      const timestamp = Date.now() / 1000;
      const voteData = {
        sessionId,
        optionId: 'option-accept',
        memberId: 'member-456',
        timestamp,
      };

      const sig = signVote(voteData, key);

      // Tamper with option
      const tampered = { ...voteData, optionId: 'option-reject' };
      const valid = verifyVoteSignature(tampered, sig, key, 300);

      expect(valid).toBe(false);
    });
  });

  describe('generateVoteReceipt', () => {
    it('returns receipt with all required fields', () => {
      const key = deriveVotingSessionKey(sessionId, sessionSecret);
      const voteData = {
        sessionId,
        optionId: 'option-accept',
        memberId: 'member-456',
        isAnonymous: true,
      };
      const sig = signVote(
        { ...voteData, timestamp: Date.now() / 1000 },
        key
      );

      const receipt = generateVoteReceipt(voteData, sig, null);

      expect(receipt.receiptId).toBeTruthy();
      expect(receipt.voteHash).toBe(sig.voteHash);
      expect(receipt.signature).toBe(sig.signature);
      expect(receipt.votedAt).toBeInstanceOf(Date);
      expect(receipt.sessionId).toBe(sessionId);
      expect(receipt.optionId).toBe('option-accept');
      expect(receipt.isAnonymous).toBe(true);
      expect(receipt.verificationCode).toMatch(/^\d{6}$/);
      expect(receipt.auditHash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('createVotingAuditLog', () => {
    it('persists the voting audit entry and returns it', async () => {
      const key = deriveVotingSessionKey(sessionId, sessionSecret);
      const voteData = {
        sessionId,
        optionId: 'option-accept',
        memberId: 'member-456',
        isAnonymous: true,
      };
      const signature = signVote({ ...voteData, timestamp: 1_725_000_000 }, key);
      const receipt = generateVoteReceipt(voteData, signature, null);

      const auditEntry = await createVotingAuditLog(sessionId, voteData.memberId, receipt, null);

      expect(mocks.mockInsert).toHaveBeenCalled();
      expect(mocks.mockInsertValues).toHaveBeenCalledWith(expect.objectContaining({
        sessionId,
        receiptId: receipt.receiptId,
        voteHash: receipt.voteHash,
        signature: receipt.signature,
        auditHash: receipt.auditHash,
        verificationCode: receipt.verificationCode,
        isAnonymous: true,
      }));
      expect(auditEntry).toEqual(expect.objectContaining({
        sessionId,
        memberId: voteData.memberId,
        receiptId: receipt.receiptId,
        voteHash: receipt.voteHash,
      }));
      expect(logger.info).toHaveBeenCalledWith('Voting audit log stored successfully', { receiptId: receipt.receiptId });
    });
  });

  describe('verifyElectionIntegrity', () => {
    it('returns a valid result when the audit log chain is intact', async () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const sessionKey = Buffer.from(publicKey.export({ type: 'spki', format: 'pem' }).toString());
      const voteHash = 'a'.repeat(64);
      const signer = createSign('RSA-SHA256');
      signer.update(voteHash);
      const signature = signer.sign(privateKey).toString('hex');

      mocks.mockOrderBy.mockResolvedValueOnce([
        {
          id: 'audit-1',
          receiptId: 'receipt-1',
          voteHash,
          signature,
          auditHash: 'b'.repeat(64),
          previousAuditHash: null,
          votedAt: new Date('2026-01-01T00:00:00.000Z'),
          verificationCode: '123456',
          isAnonymous: true,
          chainValid: true,
        },
      ]);

      const result = await verifyElectionIntegrity(sessionId, sessionKey);

      expect(result).toEqual({
        valid: true,
        voteCount: 1,
        chainValid: true,
        tamperedVotes: undefined,
        issues: undefined,
      });
      expect(logger.info).toHaveBeenCalledWith('Election integrity verification completed', expect.objectContaining({
        sessionId,
        voteCount: 1,
        tamperedVotes: 0,
        valid: true,
      }));
    });

    it('marks tampered votes and updates chain status', async () => {
      const { publicKey, privateKey } = generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const sessionKey = Buffer.from(publicKey.export({ type: 'spki', format: 'pem' }).toString());
      const voteHash = 'c'.repeat(64);
      const signer = createSign('RSA-SHA256');
      signer.update(voteHash);
      const validSignature = signer.sign(privateKey).toString('hex');

      mocks.mockOrderBy.mockResolvedValueOnce([
        {
          id: 'audit-1',
          receiptId: 'receipt-1',
          voteHash,
          signature: validSignature,
          auditHash: 'd'.repeat(64),
          previousAuditHash: null,
          votedAt: new Date('2026-01-01T00:00:00.000Z'),
          verificationCode: '123456',
          isAnonymous: true,
          chainValid: true,
        },
        {
          id: 'audit-2',
          receiptId: 'receipt-2',
          voteHash,
          signature: '00',
          auditHash: 'e'.repeat(64),
          previousAuditHash: 'broken-link',
          votedAt: new Date('2026-01-01T00:05:00.000Z'),
          verificationCode: '654321',
          isAnonymous: true,
          chainValid: true,
        },
      ]);

      const result = await verifyElectionIntegrity(sessionId, sessionKey);

      expect(result.valid).toBe(false);
      expect(result.tamperedVotes).toBe(2);
      expect(result.issues).toEqual(expect.arrayContaining([
        expect.stringContaining('Hash chain broken at index 1'),
        expect.stringContaining('Signature verification failed for vote receipt-2'),
      ]));
      expect(mocks.mockUpdate).toHaveBeenCalled();
      expect(mocks.mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({
        chainValid: false,
      }));
    });
  });
});
