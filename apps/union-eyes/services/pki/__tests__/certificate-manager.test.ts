import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TEST_CERT_PEM } from './_pki-fixtures';

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
  return { queue, db };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/services/financial-service/src/db/schema', () =>
  new Proxy(
    {},
    {
      has: () => true,
      get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
    },
  ),
);
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  gte: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
}));

import {
  getExpiringCertificates,
  getUserCertificate,
  parseCertificate,
  revokeCertificate,
  storeCertificate,
  validateCertificate,
  CertificateManager,
} from '../certificate-manager';

const pushSel = (...items: unknown[]) => h.queue.push(...items);
const VALID_SUBJECT_JSON = JSON.stringify({ commonName: 'Test User', organizationName: 'Test Org', email: 'test@example.com' });
const VALID_ISSUER_JSON = JSON.stringify({ commonName: 'Test User', organizationName: 'Test Org' });

beforeEach(() => {
  h.queue.length = 0;
});

describe('pki/certificate-manager', () => {
  describe('parseCertificate', () => {
    it('parses a PEM certificate into structured info', () => {
      const info = parseCertificate(TEST_CERT_PEM);
      expect(info.subject.commonName).toContain('Test User');
      expect(info.fingerprint).toContain(':');
      expect(info.publicKey).toContain('PUBLIC KEY');
      expect(info.keyUsage).toContain('digitalSignature');
      expect(info.extendedKeyUsage).toContain('clientAuth');
    });

    it('throws on invalid PEM', () => {
      expect(() => parseCertificate('not-a-cert')).toThrow('Failed to parse certificate');
    });
  });

  describe('validateCertificate', () => {
    afterEach(() => vi.useRealTimers());

    it('validates a good certificate with org/email/key-usage requirements', () => {
      const result = validateCertificate(TEST_CERT_PEM, {
        requireOrgName: true,
        requireEmail: true,
        allowedKeyUsages: ['digitalSignature'],
      });
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('reports an error when required key usage is missing', () => {
      const result = validateCertificate(TEST_CERT_PEM, { allowedKeyUsages: ['codeSigning'] });
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('key usage');
    });

    it('warns when validity period is below the minimum', () => {
      const result = validateCertificate(TEST_CERT_PEM, { minValidityDays: 9_999_999 });
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('flags an expired certificate', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
      const result = validateCertificate(TEST_CERT_PEM);
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('expired');
    });

    it('flags a not-yet-valid certificate', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2000-01-01T00:00:00Z'));
      const result = validateCertificate(TEST_CERT_PEM);
      expect(result.isValid).toBe(false);
      expect(result.errors.join(' ')).toContain('not yet valid');
    });

    it('returns invalid on a parse failure', () => {
      const result = validateCertificate('garbage');
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('storeCertificate', () => {
    it('stores a valid certificate', async () => {
      pushSel([]); // no existing
      pushSel([{ id: 'cert-1', signerUserId: 'u1', organizationId: 'o1', signedAt: new Date().toISOString() }]);
      const stored = await storeCertificate('u1', 'o1', TEST_CERT_PEM);
      expect(stored.id).toBe('cert-1');
      expect(stored.status).toBe('active');
    });

    it('throws when the certificate already exists', async () => {
      pushSel([{ id: 'dup' }]);
      await expect(storeCertificate('u1', 'o1', TEST_CERT_PEM)).rejects.toThrow('already exists');
    });

    it('throws on an invalid certificate', async () => {
      await expect(storeCertificate('u1', 'o1', 'garbage')).rejects.toThrow('Invalid certificate');
    });
  });

  describe('getUserCertificate', () => {
    const row = {
      id: 'cert-1',
      signerUserId: 'u1',
      organizationId: 'o1',
      signatureValue: TEST_CERT_PEM,
      certificateSubject: VALID_SUBJECT_JSON,
      certificateIssuer: VALID_ISSUER_JSON,
      certificateSerialNumber: 'ABC123',
      certificateNotBefore: new Date('2025-01-01').toISOString(),
      certificateNotAfter: new Date('2099-01-01').toISOString(),
      certificateThumbprint: 'AA:BB',
      publicKey: 'pub',
      signedAt: new Date('2025-06-01').toISOString(),
    };

    it('returns the active certificate', async () => {
      pushSel([row]);
      const cert = await getUserCertificate('u1', 'o1');
      expect(cert?.id).toBe('cert-1');
      expect(cert?.certificateInfo.subject.commonName).toBe('Test User');
    });

    it('returns null when none found', async () => {
      pushSel([]);
      expect(await getUserCertificate('u1')).toBeNull();
    });

    it('falls back gracefully on corrupted certificate JSON', async () => {
      pushSel([{ ...row, certificateSubject: 'not-json', certificateIssuer: 'not-json' }]);
      const cert = await getUserCertificate('u1');
      expect(cert?.certificateInfo.subject.commonName).toBe('');
    });
  });

  describe('revokeCertificate', () => {
    it('updates the signature status to revoked', async () => {
      pushSel([]);
      await expect(revokeCertificate('cert-1', 'compromised')).resolves.toBeUndefined();
    });
  });

  describe('getExpiringCertificates', () => {
    it('maps expiring certificates', async () => {
      pushSel([
        {
          id: 'cert-1',
          signerUserId: 'u1',
          organizationId: 'o1',
          signatureValue: TEST_CERT_PEM,
          certificateSubject: VALID_SUBJECT_JSON,
          certificateIssuer: VALID_ISSUER_JSON,
          certificateSerialNumber: 'ABC123',
          certificateNotBefore: new Date('2025-01-01').toISOString(),
          certificateNotAfter: new Date('2025-07-01').toISOString(),
          certificateThumbprint: 'AA:BB',
          publicKey: 'pub',
          signedAt: new Date('2025-06-01').toISOString(),
        },
      ]);
      const certs = await getExpiringCertificates(30);
      expect(certs).toHaveLength(1);
      expect(certs[0].id).toBe('cert-1');
    });
  });

  it('exposes the CertificateManager namespace', () => {
    expect(typeof CertificateManager.parseCertificate).toBe('function');
  });
});
