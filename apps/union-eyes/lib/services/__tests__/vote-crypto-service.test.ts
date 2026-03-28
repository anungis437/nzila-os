import { describe, it, expect } from 'vitest';
import {
  generateAnonymousVoterId,
  generateVoterHash,
  generateReceiptId,
  generateVerificationCode,
  generateVoteSignature,
  generateAuditHash,
  verifyAuditChainLink,
  generateSessionSalt,
  verifyVoteByCode,
  generateVoteMetadata,
} from '../vote-crypto-service';

describe('vote-crypto-service', () => {
  const sessionId = 'session-001';
  const sessionSalt = 'a'.repeat(64);
  const userId = 'member-123';

  describe('generateAnonymousVoterId', () => {
    it('returns a 32-character hex string', () => {
      const id = generateAnonymousVoterId(userId, sessionId, sessionSalt);
      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]+$/);
    });

    it('is deterministic for same inputs', () => {
      const id1 = generateAnonymousVoterId(userId, sessionId, sessionSalt);
      const id2 = generateAnonymousVoterId(userId, sessionId, sessionSalt);
      expect(id1).toBe(id2);
    });

    it('differs for different user IDs', () => {
      const id1 = generateAnonymousVoterId('user-A', sessionId, sessionSalt);
      const id2 = generateAnonymousVoterId('user-B', sessionId, sessionSalt);
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateVoterHash', () => {
    it('returns a hex string', () => {
      const hash = generateVoterHash('voter-abc', new Date('2026-03-01'));
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateReceiptId', () => {
    it('starts with RCPT-', () => {
      const id = generateReceiptId();
      expect(id).toMatch(/^RCPT-/);
    });

    it('is unique across calls', () => {
      const id1 = generateReceiptId();
      const id2 = generateReceiptId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('generateVerificationCode', () => {
    it('returns a 6-character string', () => {
      const code = generateVerificationCode();
      expect(code).toHaveLength(6);
    });

    it('contains only uppercase hex characters', () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^[0-9A-F]+$/);
    });
  });

  describe('generateVoteSignature', () => {
    it('returns a hex string', () => {
      const sig = generateVoteSignature(sessionId, 'option-1', 'voter-abc', new Date());
      expect(sig).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('generateAuditHash', () => {
    it('returns a hex hash with previousAuditHash', () => {
      const hash = generateAuditHash('RCPT-1', 'votehash', 'sig', 'prevhash', new Date());
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });

    it('returns a hex hash without previousAuditHash (genesis)', () => {
      const hash = generateAuditHash('RCPT-1', 'votehash', 'sig', null, new Date());
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('verifyAuditChainLink', () => {
    it('returns true for valid chain link', () => {
      const timestamp = new Date('2026-03-01');
      const hash = generateAuditHash('RCPT-1', 'votehash', 'sig', null, timestamp);
      const valid = verifyAuditChainLink('RCPT-1', 'votehash', 'sig', null, timestamp, hash);
      expect(valid).toBe(true);
    });

    it('returns false for tampered data', () => {
      const timestamp = new Date('2026-03-01');
      const hash = generateAuditHash('RCPT-1', 'votehash', 'sig', null, timestamp);
      const valid = verifyAuditChainLink('RCPT-1', 'tampered', 'sig', null, timestamp, hash);
      expect(valid).toBe(false);
    });
  });

  describe('generateSessionSalt', () => {
    it('returns a 64-character hex string', () => {
      const salt = generateSessionSalt();
      expect(salt).toHaveLength(64);
      expect(salt).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('verifyVoteByCode', () => {
    it('returns true for matching codes (case insensitive)', () => {
      expect(verifyVoteByCode('ABC123', 'abc123')).toBe(true);
    });

    it('returns false for non-matching codes', () => {
      expect(verifyVoteByCode('ABC123', 'XYZ789')).toBe(false);
    });
  });

  describe('generateVoteMetadata', () => {
    it('returns complete metadata object', () => {
      const metadata = generateVoteMetadata(sessionId, 'option-1', userId, sessionSalt, null);

      expect(metadata.receiptId).toMatch(/^RCPT-/);
      expect(metadata.verificationCode).toHaveLength(6);
      expect(metadata.anonymousVoterId).toHaveLength(32);
      expect(metadata.voterHash).toMatch(/^[0-9a-f]+$/);
      expect(metadata.signature).toMatch(/^[0-9a-f]+$/);
      expect(metadata.auditHash).toMatch(/^[0-9a-f]+$/);
      expect(metadata.timestamp).toBeInstanceOf(Date);
    });
  });
});
