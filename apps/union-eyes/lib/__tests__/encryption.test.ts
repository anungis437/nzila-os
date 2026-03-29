/**
 * Tests for encryption.ts
 *
 * Tests the fallback/local encryption path (no Azure Key Vault).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.hoisted(() => {
  // Must use require() inside vi.hoisted — ESM imports aren't available yet
  const nodeCrypto = require('node:crypto');
  const testKey = nodeCrypto.randomBytes(32).toString('base64');
  process.env.NODE_ENV = 'test';
  process.env.TEST_ENCRYPTION_KEY = testKey;
  delete process.env.AZURE_KEY_VAULT_URL;
  delete process.env.FALLBACK_ENCRYPTION_KEY;
});

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: class {},
}));

vi.mock('@azure/keyvault-keys', () => ({
  KeyClient: class {},
  CryptographyClient: class {},
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  encryptionService,
  encryptSIN,
  decryptSIN,
  formatSINForDisplay,
  migrateSINToEncrypted,
  generateEncryptionKey,
  getCurrentKeyVersion,
  getKeyVersionsInfo,
  forceKeyRotation,
  reEncryptData,
} from '../encryption';

describe('encryption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('module loads without throwing in test environment', () => {
    expect(encryptionService).toBeDefined();
  });

  // ── Encrypt / Decrypt ─────────────────────────────────────────────────────
  describe('encrypt and decrypt', () => {
    it('round-trips plaintext', async () => {
      const encrypted = await encryptionService.encrypt('hello world');
      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.keyVersion).toBe('v1');

      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe('hello world');
    });

    it('decrypt accepts JSON string', async () => {
      const encrypted = await encryptionService.encrypt('test');
      const decrypted = await encryptionService.decrypt(JSON.stringify(encrypted));
      expect(decrypted).toBe('test');
    });
  });

  describe('encryptToString and decryptFromString', () => {
    it('round-trips as base64', async () => {
      const encrypted = await encryptionService.encryptToString('secret');
      expect(typeof encrypted).toBe('string');
      const decrypted = await encryptionService.decryptFromString(encrypted);
      expect(decrypted).toBe('secret');
    });
  });

  // ── Hash ──────────────────────────────────────────────────────────────────
  describe('hash', () => {
    it('returns consistent SHA-256 hex', () => {
      const h1 = encryptionService.hash('test');
      const h2 = encryptionService.hash('test');
      expect(h1).toBe(h2);
      expect(h1).toHaveLength(64);
    });

    it('returns different hash for different input', () => {
      expect(encryptionService.hash('a')).not.toBe(encryptionService.hash('b'));
    });
  });

  // ── isEncrypted ───────────────────────────────────────────────────────────
  describe('isEncrypted', () => {
    it('returns true for encrypted data', async () => {
      const encrypted = await encryptionService.encryptToString('data');
      expect(encryptionService.isEncrypted(encrypted)).toBe(true);
    });

    it('returns false for plain text', () => {
      expect(encryptionService.isEncrypted('not encrypted')).toBe(false);
    });
  });

  // ── SIN utilities ─────────────────────────────────────────────────────────
  describe('encryptSIN', () => {
    it('encrypts a valid SIN', async () => {
      const encrypted = await encryptSIN('123456789');
      expect(typeof encrypted).toBe('string');
    });

    it('accepts SIN with dashes and spaces', async () => {
      const encrypted = await encryptSIN('123-456-789');
      expect(typeof encrypted).toBe('string');
    });

    it('throws for invalid SIN format', async () => {
      await expect(encryptSIN('12345')).rejects.toThrow('Invalid SIN format');
    });
  });

  describe('decryptSIN', () => {
    it('round-trips with encryptSIN', async () => {
      const encrypted = await encryptSIN('123456789');
      const decrypted = await decryptSIN(encrypted);
      expect(decrypted).toBe('123456789');
    });

    it('throws on empty input', async () => {
      await expect(decryptSIN('')).rejects.toThrow('No encrypted SIN');
    });
  });

  describe('formatSINForDisplay', () => {
    it('masks plaintext SIN', async () => {
      const result = await formatSINForDisplay('123456789');
      expect(result).toBe('***-***-6789');
    });

    it('decrypts then masks encrypted SIN', async () => {
      const encrypted = await encryptSIN('987654321');
      const result = await formatSINForDisplay(encrypted, true);
      expect(result).toBe('***-***-4321');
    });

    it('returns mask for empty input', async () => {
      const result = await formatSINForDisplay('');
      expect(result).toBe('***-***-****');
    });
  });

  describe('migrateSINToEncrypted', () => {
    it('encrypts plaintext SIN', async () => {
      const encrypted = await migrateSINToEncrypted('123456789');
      const decrypted = await decryptSIN(encrypted);
      expect(decrypted).toBe('123456789');
    });

    it('throws for empty input', async () => {
      await expect(migrateSINToEncrypted('')).rejects.toThrow('No SIN to migrate');
    });

    it('skips already-encrypted SIN', async () => {
      const encrypted = await encryptSIN('123456789');
      const result = await migrateSINToEncrypted(encrypted);
      expect(result).toBe(encrypted);
    });
  });

  // ── Key management ────────────────────────────────────────────────────────
  describe('key management', () => {
    it('getCurrentKeyVersion returns initial version', () => {
      expect(getCurrentKeyVersion()).toBeGreaterThanOrEqual(1);
    });

    it('getKeyVersionsInfo returns metadata', () => {
      const info = getKeyVersionsInfo();
      expect(info.length).toBeGreaterThanOrEqual(1);
      expect(info[0]).toHaveProperty('version');
      expect(info[0]).toHaveProperty('createdAt');
      expect(info[0]).toHaveProperty('isActive');
    });

    it('generateEncryptionKey creates 32-byte base64 key', () => {
      const key = generateEncryptionKey();
      expect(Buffer.from(key, 'base64')).toHaveLength(32);
    });
  });

  // ── Key rotation (modifies singleton state — put last) ────────────────────
  describe('key rotation', () => {
    it('forceKeyRotation increments version', async () => {
      const before = getCurrentKeyVersion();
      await forceKeyRotation();
      expect(getCurrentKeyVersion()).toBe(before + 1);
    });

    it('data encrypted with old key is still decryptable', async () => {
      const encrypted = await encryptionService.encrypt('before rotation');
      await forceKeyRotation();
      const decrypted = await encryptionService.decrypt(encrypted);
      expect(decrypted).toBe('before rotation');
    });

    it('shouldReEncrypt detects old version', async () => {
      const encrypted = await encryptionService.encrypt('old');
      await forceKeyRotation();
      expect(encryptionService.shouldReEncrypt(encrypted)).toBe(true);
    });

    it('shouldReEncrypt returns false for current version', async () => {
      const encrypted = await encryptionService.encrypt('current');
      expect(encryptionService.shouldReEncrypt(encrypted)).toBe(false);
    });

    it('reEncryptData migrates to current version', async () => {
      // decrypt() expects a JSON string, not base64 (encryptToString returns base64)
      const encryptedObj = await encryptionService.encrypt('migrate-me');
      const encrypted = JSON.stringify(encryptedObj);
      await forceKeyRotation();
      const reEncrypted = await reEncryptData(encrypted);
      expect(reEncrypted).not.toBe(encrypted);
      // reEncrypt returns base64, decryptFromString expects base64
      const decrypted = await encryptionService.decryptFromString(reEncrypted);
      expect(decrypted).toBe('migrate-me');
    });

    it('batchReEncrypt handles array', async () => {
      const e1 = await encryptionService.encryptToString('a');
      const e2 = await encryptionService.encryptToString('b');
      await forceKeyRotation();
      const results = await encryptionService.batchReEncrypt([e1, e2]);
      expect(results).toHaveLength(2);
    });
  });
});
