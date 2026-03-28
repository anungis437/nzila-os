/**
 * Voting Crypto Service — Unit Tests
 *
 * Tests all PURE cryptographic functions:
 *   - deriveVotingSessionKey (PBKDF2)
 *   - signVote / verifyVoteSignature (HMAC-SHA256)
 *   - generateVoteReceipt / verifyVoteReceipt (audit hash chain)
 *
 * Tier 1 — Security & Money
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before importing service
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  deriveVotingSessionKey,
  signVote,
  verifyVoteSignature,
  generateVoteReceipt,
  verifyVoteReceipt,
} from '../services/voting-crypto-service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const SESSION_ID = 'session-abc-123';
const SESSION_SECRET = 'test-voting-secret-with-sufficient-entropy-32chars!';
const MEMBER_ID = 'member-xyz-456';
const OPTION_ID = 'option-yes';

function makeVoteData(overrides?: Partial<{ sessionId: string; optionId: string; memberId: string; timestamp: number }>) {
  return {
    sessionId: SESSION_ID,
    optionId: OPTION_ID,
    memberId: MEMBER_ID,
    timestamp: Math.floor(Date.now() / 1000),
    ...overrides,
  };
}

// ─── deriveVotingSessionKey ──────────────────────────────────────────────────

describe('deriveVotingSessionKey', () => {
  it('returns a 32-byte Buffer (256-bit key)', () => {
    const key = deriveVotingSessionKey(SESSION_ID, SESSION_SECRET);
    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  it('is deterministic — same inputs produce same key', () => {
    const k1 = deriveVotingSessionKey(SESSION_ID, SESSION_SECRET);
    const k2 = deriveVotingSessionKey(SESSION_ID, SESSION_SECRET);
    expect(k1.equals(k2)).toBe(true);
  });

  it('different session IDs produce different keys', () => {
    const k1 = deriveVotingSessionKey('session-1', SESSION_SECRET);
    const k2 = deriveVotingSessionKey('session-2', SESSION_SECRET);
    expect(k1.equals(k2)).toBe(false);
  });

  it('different secrets produce different keys', () => {
    const k1 = deriveVotingSessionKey(SESSION_ID, 'secret-alpha');
    const k2 = deriveVotingSessionKey(SESSION_ID, 'secret-beta');
    expect(k1.equals(k2)).toBe(false);
  });

  it('throws if session secret is undefined', () => {
    expect(() => deriveVotingSessionKey(SESSION_ID, undefined)).toThrow(
      'VOTING_SECRET environment variable must be set',
    );
  });

  it('throws if session secret is empty string', () => {
    expect(() => deriveVotingSessionKey(SESSION_ID, '')).toThrow(
      'VOTING_SECRET environment variable must be set',
    );
  });
});

// ─── signVote ────────────────────────────────────────────────────────────────

describe('signVote', () => {
  let sessionKey: Buffer;

  beforeEach(() => {
    sessionKey = deriveVotingSessionKey(SESSION_ID, SESSION_SECRET);
  });

  it('returns voteHash, signature, and nonce', () => {
    const result = signVote(makeVoteData(), sessionKey);
    expect(result).toHaveProperty('voteHash');
    expect(result).toHaveProperty('signature');
    expect(result).toHaveProperty('nonce');
    expect(typeof result.voteHash).toBe('string');
    expect(typeof result.signature).toBe('string');
    expect(typeof result.nonce).toBe('string');
  });

  it('voteHash is deterministic for same inputs (excluding nonce)', () => {
    const data = makeVoteData({ timestamp: 1700000000 });
    const r1 = signVote(data, sessionKey);
    const r2 = signVote(data, sessionKey);
    expect(r1.voteHash).toBe(r2.voteHash);
  });

  it('signatures differ across calls due to random nonce', () => {
    const data = makeVoteData({ timestamp: 1700000000 });
    const r1 = signVote(data, sessionKey);
    const r2 = signVote(data, sessionKey);
    // nonces are different → signatures are different
    expect(r1.nonce).not.toBe(r2.nonce);
    expect(r1.signature).not.toBe(r2.signature);
  });

  it('different vote data produces different hashes', () => {
    const r1 = signVote(makeVoteData({ optionId: 'yes' }), sessionKey);
    const r2 = signVote(makeVoteData({ optionId: 'no' }), sessionKey);
    expect(r1.voteHash).not.toBe(r2.voteHash);
  });

  it('voteHash and signature are hex strings (64 chars for SHA256)', () => {
    const result = signVote(makeVoteData(), sessionKey);
    expect(result.voteHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('nonce is a 32-char hex string (16 random bytes)', () => {
    const result = signVote(makeVoteData(), sessionKey);
    expect(result.nonce).toMatch(/^[0-9a-f]{32}$/);
  });
});

// ─── verifyVoteSignature ─────────────────────────────────────────────────────

describe('verifyVoteSignature', () => {
  let sessionKey: Buffer;

  beforeEach(() => {
    sessionKey = deriveVotingSessionKey(SESSION_ID, SESSION_SECRET);
  });

  it('returns true for a valid, fresh signature', () => {
    const data = makeVoteData();
    const sig = signVote(data, sessionKey);
    expect(verifyVoteSignature(data, sig, sessionKey)).toBe(true);
  });

  it('returns false when vote data is tampered with', () => {
    const data = makeVoteData();
    const sig = signVote(data, sessionKey);
    const tampered = { ...data, optionId: 'no' };
    expect(verifyVoteSignature(tampered, sig, sessionKey)).toBe(false);
  });

  it('returns false when signature hash is altered', () => {
    const data = makeVoteData();
    const sig = signVote(data, sessionKey);
    const altered = { ...sig, voteHash: 'a'.repeat(64) };
    expect(verifyVoteSignature(data, altered, sessionKey)).toBe(false);
  });

  it('returns false when signature value is altered', () => {
    const data = makeVoteData();
    const sig = signVote(data, sessionKey);
    const altered = { ...sig, signature: 'b'.repeat(64) };
    expect(verifyVoteSignature(data, altered, sessionKey)).toBe(false);
  });

  it('returns false when using wrong session key', () => {
    const data = makeVoteData();
    const sig = signVote(data, sessionKey);
    const wrongKey = deriveVotingSessionKey('wrong-session', SESSION_SECRET);
    expect(verifyVoteSignature(data, sig, wrongKey)).toBe(false);
  });

  it('returns false for expired signatures (beyond maxAgeSeconds)', () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const data = makeVoteData({ timestamp: pastTimestamp });
    const sig = signVote(data, sessionKey);
    // Default maxAgeSeconds is 300 (5 min)
    expect(verifyVoteSignature(data, sig, sessionKey)).toBe(false);
  });

  it('accepts custom maxAgeSeconds', () => {
    const pastTimestamp = Math.floor(Date.now() / 1000) - 600;
    const data = makeVoteData({ timestamp: pastTimestamp });
    const sig = signVote(data, sessionKey);
    // Allow 1 hour
    expect(verifyVoteSignature(data, sig, sessionKey, 3600)).toBe(true);
  });
});

// ─── generateVoteReceipt ─────────────────────────────────────────────────────

describe('generateVoteReceipt', () => {
  let sessionKey: Buffer;

  beforeEach(() => {
    sessionKey = deriveVotingSessionKey(SESSION_ID, SESSION_SECRET);
  });

  it('generates a receipt with all required fields', () => {
    const sig = signVote(makeVoteData(), sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
    );

    expect(receipt).toHaveProperty('receiptId');
    expect(receipt).toHaveProperty('voteHash', sig.voteHash);
    expect(receipt).toHaveProperty('signature', sig.signature);
    expect(receipt).toHaveProperty('votedAt');
    expect(receipt).toHaveProperty('sessionId', SESSION_ID);
    expect(receipt).toHaveProperty('optionId', OPTION_ID);
    expect(receipt).toHaveProperty('isAnonymous', false);
    expect(receipt).toHaveProperty('verificationCode');
    expect(receipt).toHaveProperty('auditHash');
  });

  it('verification code is a 6-digit string', () => {
    const sig = signVote(makeVoteData(), sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
    );
    expect(receipt.verificationCode).toMatch(/^\d{6}$/);
  });

  it('receiptId is a 32-char hex string', () => {
    const sig = signVote(makeVoteData(), sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
    );
    expect(receipt.receiptId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('auditHash is a 64-char hex string (SHA256)', () => {
    const sig = signVote(makeVoteData(), sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
    );
    expect(receipt.auditHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('chaining: receipts with different previousAuditHash produce different auditHash', () => {
    const sig = signVote(makeVoteData(), sessionKey);
    const r1 = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
      null,
    );
    const r2 = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
      r1.auditHash,
    );
    expect(r1.auditHash).not.toBe(r2.auditHash);
  });

  it('preserves anonymous flag', () => {
    const sig = signVote(makeVoteData(), sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: true },
      sig,
    );
    expect(receipt.isAnonymous).toBe(true);
  });
});

// ─── verifyVoteReceipt ──────────────────────────────────────────────────────

describe('verifyVoteReceipt', () => {
  let sessionKey: Buffer;

  beforeEach(() => {
    sessionKey = deriveVotingSessionKey(SESSION_ID, SESSION_SECRET);
  });

  it('returns valid for correct verification code and matching data', () => {
    const data = makeVoteData({ timestamp: 1700000000 });
    const sig = signVote(data, sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
    );

    const result = verifyVoteReceipt(receipt, receipt.verificationCode, data, sessionKey);
    expect(result.valid).toBe(true);
    expect(result.matchesOption).toBe(true);
  });

  it('returns invalid for wrong verification code', () => {
    const data = makeVoteData({ timestamp: 1700000000 });
    const sig = signVote(data, sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
    );

    const result = verifyVoteReceipt(receipt, '000000', data, sessionKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Verification code');
  });

  it('detects tampering if optionId was changed after receipt generation', () => {
    const data = makeVoteData({ timestamp: 1700000000 });
    const sig = signVote(data, sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
    );

    const tampered = { ...data, optionId: 'option-no' };
    const result = verifyVoteReceipt(receipt, receipt.verificationCode, tampered, sessionKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('tampering');
  });

  it('detects tampering if wrong session key used for verification', () => {
    const data = makeVoteData({ timestamp: 1700000000 });
    const sig = signVote(data, sessionKey);
    const receipt = generateVoteReceipt(
      { sessionId: SESSION_ID, optionId: OPTION_ID, memberId: MEMBER_ID, isAnonymous: false },
      sig,
    );

    const wrongKey = deriveVotingSessionKey('different-session', SESSION_SECRET);
    const result = verifyVoteReceipt(receipt, receipt.verificationCode, data, wrongKey);
    expect(result.valid).toBe(false);
  });
});
