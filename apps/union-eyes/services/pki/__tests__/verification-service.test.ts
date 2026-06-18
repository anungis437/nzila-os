import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { TEST_KEY_PEM } from './_pki-fixtures';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
  const hashDocument = vi.fn((c: Buffer | string) => {
    const hash = crypto.createHash('sha512');
    hash.update(c);
    return hash.digest('hex');
  });
  return { queue, db, hashDocument };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/services/financial-service/src/db/schema', () =>
  new Proxy({}, { has: () => true, get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })) }),
);
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  inArray: vi.fn(() => ({})),
}));
vi.mock('./signature-service', () => ({ hashDocument: h.hashDocument }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import {
  bulkVerifySignatures,
  getSignatureVerificationHistory,
  isSignatureValid,
  verifyCertificateChain,
  verifyDocumentIntegrity,
  verifySignature,
  VerificationService,
} from '../verification-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

// Build a real RSA-SHA512 signature over a known document hash for the happy path.
const PUB_KEY = crypto.createPublicKey(TEST_KEY_PEM).export({ type: 'spki', format: 'pem' }) as string;
const DOC_HASH = crypto.createHash('sha512').update('payload').digest('hex');
function realSignature(hashHex: string): string {
  const signer = crypto.createSign('RSA-SHA512');
  signer.update(hashHex);
  signer.end();
  return signer.sign(crypto.createPrivateKey(TEST_KEY_PEM), 'base64');
}

const baseSig = {
  id: 'sig-1',
  signatureStatus: 'signed',
  rejectionReason: null,
  certificateNotBefore: new Date('2025-01-01').toISOString(),
  certificateNotAfter: new Date('2099-01-01').toISOString(),
  documentHash: DOC_HASH,
  signatureValue: realSignature(DOC_HASH),
  publicKey: PUB_KEY,
  isVerified: false,
  verifiedAt: null,
  verificationMethod: null,
  signedAt: new Date('2025-06-01').toISOString(),
  revokedAt: null,
  revocationReason: null,
};

beforeEach(() => {
  h.queue.length = 0;
  h.hashDocument.mockClear();
});

describe('pki/verification-service', () => {
  describe('verifySignature', () => {
    it('verifies a valid cryptographic signature with matching content', async () => {
      pushSel([baseSig]); // fetch
      pushSel([]); // update verified
      const result = await verifySignature('sig-1', 'payload');
      expect(result.isValid).toBe(true);
      expect(result.details.signatureValid).toBe(true);
      expect(result.details.hashMatches).toBe(true);
    });

    it('reports a hash mismatch when content differs', async () => {
      pushSel([baseSig]);
      const result = await verifySignature('sig-1', 'tampered');
      expect(result.details.hashMatches).toBe(false);
      expect(result.isValid).toBe(false);
    });

    it('skips hash verification when no content is provided', async () => {
      pushSel([baseSig]);
      pushSel([]); // update
      const result = await verifySignature('sig-1');
      expect(result.warnings.join(' ')).toContain('hash verification skipped');
    });

    it('treats an attestation-only signature as valid', async () => {
      pushSel([{ ...baseSig, signatureValue: 'ATTESTATION' }]);
      pushSel([]); // update
      const result = await verifySignature('sig-1');
      expect(result.details.signatureValid).toBe(true);
    });

    it('flags a revoked signature', async () => {
      pushSel([{ ...baseSig, signatureStatus: 'revoked' }]);
      const result = await verifySignature('sig-1');
      expect(result.details.certificateRevoked).toBe(true);
      expect(result.isValid).toBe(false);
    });

    it('reports a rejected signature', async () => {
      pushSel([{ ...baseSig, signatureStatus: 'rejected', rejectionReason: 'invalid' }]);
      const result = await verifySignature('sig-1');
      expect(result.errors.join(' ')).toContain('rejected');
    });

    it('flags an expired and not-yet-valid certificate', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2099-06-01T00:00:00Z'));
      pushSel([baseSig]);
      const result = await verifySignature('sig-1');
      expect(result.details.certificateExpired).toBe(true);
      vi.useRealTimers();
    });

    it('handles a cryptographic verification error gracefully', async () => {
      pushSel([{ ...baseSig, publicKey: 'not-a-key' }]);
      const result = await verifySignature('sig-1', 'payload');
      expect(result.details.signatureValid).toBe(false);
      expect(result.errors.join(' ')).toContain('verification error');
    });

    it('throws when the signature is not found', async () => {
      pushSel([]);
      await expect(verifySignature('missing')).rejects.toThrow('Signature not found');
    });
  });

  describe('verifyDocumentIntegrity', () => {
    it('verifies all signatures for a document', async () => {
      pushSel([baseSig]); // fetch signatures list
      pushSel([baseSig]); // verifySignature fetch
      pushSel([]); // verifySignature update
      const result = await verifyDocumentIntegrity('doc-1', 'payload', 'org-1');
      expect(result.isIntact).toBe(true);
      expect(result.totalSignatures).toBe(1);
      expect(result.validSignatures).toBe(1);
    });

    it('throws when no signatures exist', async () => {
      pushSel([]);
      await expect(verifyDocumentIntegrity('doc-1')).rejects.toThrow('No signatures found');
    });
  });

  describe('bulkVerifySignatures', () => {
    it('returns results and captures per-signature errors', async () => {
      pushSel([baseSig]); // verifySignature 1 fetch
      pushSel([]); // update
      pushSel([]); // verifySignature 2 fetch → empty → throws → error result
      const results = await bulkVerifySignatures(['sig-1', 'missing']);
      expect(results).toHaveLength(2);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
    });
  });

  describe('verifyCertificateChain', () => {
    afterEach(() => vi.unstubAllEnvs());

    it('returns invalid when the thumbprint is missing', async () => {
      const result = await verifyCertificateChain('');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('returns invalid when not in the trusted list', async () => {
      vi.stubEnv('PKI_TRUSTED_CERT_THUMBPRINTS', 'OTHER');
      const result = await verifyCertificateChain('AA:BB');
      expect(result.trustedRoot).toBe(false);
    });

    it('returns valid when the thumbprint is trusted', async () => {
      vi.stubEnv('PKI_TRUSTED_CERT_THUMBPRINTS', 'AA:BB, CC:DD');
      const result = await verifyCertificateChain('AA:BB');
      expect(result.isValid).toBe(true);
      expect(result.trustedRoot).toBe(true);
    });
  });

  describe('isSignatureValid', () => {
    it('returns true for a valid signature', async () => {
      pushSel([baseSig]);
      expect(await isSignatureValid('sig-1')).toBe(true);
    });

    it('returns false when not found', async () => {
      pushSel([]);
      expect(await isSignatureValid('missing')).toBe(false);
    });

    it('returns false when revoked', async () => {
      pushSel([{ ...baseSig, signatureStatus: 'revoked' }]);
      expect(await isSignatureValid('sig-1')).toBe(false);
    });

    it('returns false when the certificate is expired', async () => {
      pushSel([{ ...baseSig, certificateNotAfter: new Date('2000-01-01').toISOString() }]);
      expect(await isSignatureValid('sig-1')).toBe(false);
    });
  });

  describe('getSignatureVerificationHistory', () => {
    it('returns the verification history', async () => {
      pushSel([{ ...baseSig, isVerified: true, verifiedAt: new Date().toISOString(), verificationMethod: 'full', revokedAt: new Date().toISOString(), revocationReason: 'x' }]);
      const history = await getSignatureVerificationHistory('sig-1');
      expect(history.signatureId).toBe('sig-1');
      expect(history.isVerified).toBe(true);
    });

    it('handles null optional fields', async () => {
      pushSel([baseSig]);
      const history = await getSignatureVerificationHistory('sig-1');
      expect(history.lastVerifiedAt).toBeUndefined();
      expect(history.revokedAt).toBeUndefined();
    });

    it('throws when not found', async () => {
      pushSel([]);
      await expect(getSignatureVerificationHistory('missing')).rejects.toThrow('Signature not found');
    });
  });

  it('exposes the VerificationService namespace', () => {
    expect(typeof VerificationService.verifySignature).toBe('function');
  });
});
