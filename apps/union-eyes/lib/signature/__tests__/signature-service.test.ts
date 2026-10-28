import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  audit: vi.fn(),
  signerFind: vi.fn(),
  documentFind: vi.fn(),
  voidEnvelope: vi.fn(),
  open: [] as unknown[],
  signerUpdate: [] as unknown[],
  voidUpdate: [] as unknown[],
  tx: {} as Record<string, any>,
  trail: [] as Record<string, unknown>[],
}));

vi.mock('@/db', () => ({
  db: { query: { documentSigners: { findFirst: m.signerFind }, signatureDocuments: { findFirst: m.documentFind } } },
}));
vi.mock('@/db/schema', () => {
  const t = (name: string) => new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return { signatureDocuments: t('signatureDocuments'), documentSigners: t('documentSigners'), signatureAuditTrail: t('signatureAuditTrail') };
});
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), or: vi.fn(() => 'or'), desc: vi.fn(), notInArray: vi.fn(() => 'notIn'), inArray: vi.fn(() => 'in') }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_org: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('../providers', () => ({ default: { getProvider: () => ({ voidEnvelope: m.voidEnvelope }), getDefaultProvider: vi.fn() } }));
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: {} }));
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: {} }));
vi.mock('@/lib/services/document-storage-service', () => ({ default: class {} }));

import { SignatureService, SignatureAuthorityError } from '../signature-service';

const DOC = { id: 'd1', organizationId: 'o1', sentBy: 'sender', status: 'sent', providerEnvelopeId: null, provider: 'internal' };
const SIGNER = { id: 'sg1', documentId: 'd1', userId: 'signer', name: 'Sam', email: 's@x.test' };

describe('SignatureService authority and atomic audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.trail = [];
    m.open = [{ id: 'd1' }];
    m.signerUpdate = [{ ...SIGNER, status: 'signed' }];
    m.voidUpdate = [{ id: 'd1' }];
    m.audit.mockResolvedValue(undefined);
    m.signerFind.mockResolvedValue(SIGNER);
    m.documentFind.mockResolvedValue({ ...DOC, signers: [SIGNER] });
    m.tx.select = vi.fn(() => ({ from: () => ({ where: async () => m.open }) }));
    m.tx.update = vi.fn((table: string) => ({
      set: () => ({
        where: () => ({
          returning: async () => (String((table as any).__t).startsWith('documentSigners') ? m.signerUpdate : m.voidUpdate),
        }),
      }),
    }));
    m.tx.insert = vi.fn(() => ({ values: async (v: Record<string, unknown>) => { m.trail.push(v); } }));
    m.tx.query = { documentSigners: { findMany: async () => [{ status: 'signed' }, { status: 'sent' }] } };
  });

  describe('verifyDocumentAccess', () => {
    it('lets the sender and a signer in, and keeps an ordinary organization member out', async () => {
      expect(await SignatureService.verifyDocumentAccess('d1', 'sender')).toBe(true);
      expect(await SignatureService.verifyDocumentAccess('d1', 'signer')).toBe(true);
      expect(await SignatureService.verifyDocumentAccess('d1', 'other-member')).toBe(false);
    });
  });

  describe('voidDocument', () => {
    it('refuses anyone but the sender, and writes nothing', async () => {
      await expect(SignatureService.voidDocument('d1', 'signer', 'why')).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(m.tx.update).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });

    it.each(['completed', 'voided', 'declined', 'expired'])('refuses a %s document', async (status) => {
      m.documentFind.mockResolvedValue({ ...DOC, status });
      await expect(SignatureService.voidDocument('d1', 'sender', 'why')).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('voids for the sender and records the trail entry and the platform audit on the same transaction', async () => {
      await SignatureService.voidDocument('d1', 'sender', 'wrong version');
      expect(m.trail[0]).toMatchObject({ eventType: 'document_voided', actorUserId: 'sender' });
      expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'signature.document.void', userId: 'sender', organizationId: 'o1' }));
    });

    it('is a conflict with no audit when the document completed in the meantime', async () => {
      m.voidUpdate = [];
      await expect(SignatureService.voidDocument('d1', 'sender', 'why')).rejects.toBeInstanceOf(SignatureAuthorityError);
      expect(m.audit).not.toHaveBeenCalled();
    });
  });

  describe('recordSignature', () => {
    const input = { signerId: 'sg1', actorUserId: 'signer', signatureImageUrl: 'https://x.test/s.png', signatureType: 'electronic' as const };

    it('refuses a caller who is not the signer', async () => {
      await expect(SignatureService.recordSignature({ ...input, actorUserId: 'someone-else' })).rejects.toThrow('not authorized');
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('does not sign a document that is no longer open', async () => {
      m.open = [];
      await expect(SignatureService.recordSignature(input)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(m.tx.update).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('does not overwrite a signature the signer already gave', async () => {
      m.signerUpdate = [];
      await expect(SignatureService.recordSignature(input)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('signs and audits on the same transaction, attributed to the signer', async () => {
      await SignatureService.recordSignature(input);
      expect(m.trail[0]).toMatchObject({ eventType: 'document_signed', actorUserId: 'signer' });
      expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'signature.document.sign', userId: 'signer' }));
    });

    it('proves the signer row belongs to the document organization inside the signing statement', async () => {
      const { eq } = await import('drizzle-orm');
      vi.mocked(eq).mockClear();
      await SignatureService.recordSignature(input);
      expect(vi.mocked(eq).mock.calls.some((c) => c[0] === 'signatureDocuments.organizationId' && c[1] === 'o1')).toBe(true);
    });

    it('binds the void and completion statements to the document organization', async () => {
      const { eq } = await import('drizzle-orm');
      vi.mocked(eq).mockClear();
      await SignatureService.voidDocument('d1', 'sender', 'why');
      expect(vi.mocked(eq).mock.calls.some((c) => c[0] === 'signatureDocuments.organizationId' && c[1] === 'o1')).toBe(true);
    });

    it('fails the signature when its audit cannot be written', async () => {
      m.audit.mockRejectedValue(new Error('audit down'));
      await expect(SignatureService.recordSignature(input)).rejects.toThrow('audit down');
    });
  });
});
