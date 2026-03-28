import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  deriveVotingSessionKey,
  signVote,
  verifyVoteSignature,
  generateVoteReceipt,
} from '../voting-crypto-service';

describe('voting-crypto-service', () => {
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
});
