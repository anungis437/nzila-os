import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  audit: vi.fn(),
  signerFind: vi.fn(),
  documentFind: vi.fn(),
  voidEnvelope: vi.fn(),
  open: [] as unknown[],
  queue: [] as unknown[][],
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
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), or: vi.fn(() => 'or'), desc: vi.fn(), notInArray: vi.fn(() => 'notIn'), inArray: vi.fn(() => 'in'), lt: vi.fn(() => 'lt') }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_org: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('../providers', () => ({ default: { getProvider: () => ({ voidEnvelope: m.voidEnvelope }), getDefaultProvider: vi.fn() } }));
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: {} }));
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: {} }));
vi.mock('@/lib/services/document-storage-service', () => ({ default: class {} }));
vi.mock('../audit-chain-store', () => ({ nextChainLink: vi.fn(async () => ({ seq: 1, previousHash: null })), loadChainRows: vi.fn(async () => []) }));
vi.mock('../file-integrity', () => ({ verifySignatureDocumentFile: vi.fn(async () => ({ status: 'verified', sha256: 'h' })) }));


import { SignatureService, SignatureAuthorityError } from '../signature-service';

const DOC = { id: 'd1', organizationId: 'o1', sentBy: 'sender', status: 'sent', providerEnvelopeId: null, provider: 'internal' };
const SIGNER = { id: 'sg1', documentId: 'd1', userId: 'signer', name: 'Sam', email: 's@x.test' };

describe('SignatureService authority and atomic audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.trail = [];
    m.open = [{ id: 'd1' }];
    m.queue = [];
    m.signerUpdate = [{ ...SIGNER, status: 'signed' }];
    m.voidUpdate = [{ id: 'd1' }];
    m.audit.mockResolvedValue(undefined);
    m.signerFind.mockResolvedValue(SIGNER);
    m.documentFind.mockResolvedValue({ ...DOC, signers: [SIGNER] });
    m.tx.select = vi.fn(() => ({ from: () => ({ where: async () => (m.queue.length ? m.queue.shift()! : m.open) }) }));
    m.tx.update = vi.fn((table: string) => ({
      set: () => ({
        where: () => ({
          returning: async () => (String((table as any).__t).startsWith('documentSigners') ? m.signerUpdate : m.voidUpdate),
        }),
      }),
    }));
    m.tx.transaction = async (fn: (t: unknown) => Promise<unknown>) => fn(m.tx);
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

    // DEF-0B11-SOC-VOID-SWALLOWS-THE-PROVIDER-FAILURE-AND-RECORDS-VOIDED-WHILE-THE-ENVELOPE-CAN-STILL-BE-SIGNED
    it('does not record a void, or audit one, when the provider could not void the envelope', async () => {
      m.documentFind.mockResolvedValue({ ...DOC, provider: 'docusign', providerEnvelopeId: 'env-1' });
      m.voidEnvelope.mockRejectedValue(new Error('provider down'));
      await expect(SignatureService.voidDocument('d1', 'sender', 'why')).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(m.tx.update).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('is a conflict with no audit when the document completed in the meantime', async () => {
      m.voidUpdate = [];
      await expect(SignatureService.voidDocument('d1', 'sender', 'why')).rejects.toBeInstanceOf(SignatureAuthorityError);
      expect(m.audit).not.toHaveBeenCalled();
    });
  });

  describe('recordSignature', () => {
    const input = { signerId: 'sg1', actorUserId: 'signer', signatureImageUrl: 'https://x.test/s.png', signatureType: 'electronic' as const };

    // DEF-0B11-SOC-SIGNING-IGNORES-THE-STORED-EXPIRY-SIGNING-ORDER-AND-AUTHENTICATION-REQUIREMENT
    // Extended in F06 batch 6 (A6): the refusal rolls the signing transaction back, so the expiry itself is recorded on its own.
    it('does not sign an expired request, and records the expiry on its own with its trail event and platform audit', async () => {
      m.queue = [[{ id: 'd1' }], [{ expiresAt: new Date(Date.now() - 1000), sequentialSigning: false }]];
      m.voidUpdate = [{ id: 'd1' }];
      await expect(SignatureService.recordSignature(input)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('expired') });
      expect(m.signerUpdate).toEqual([{ ...SIGNER, status: 'signed' }]);
      expect(m.trail.map((entry) => entry.eventType)).toEqual(['document_expired']);
      expect(m.audit).toHaveBeenCalledTimes(1);
      expect(m.audit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'signature.document.expire', resourceId: 'd1' }));
    });

    it('records nothing more when the expired document had already been settled in the meantime', async () => {
      m.queue = [[{ id: 'd1' }], [{ expiresAt: new Date(Date.now() - 1000), sequentialSigning: false }]];
      m.voidUpdate = [];
      await expect(SignatureService.recordSignature(input)).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(m.trail).toHaveLength(0);
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('refuses to sign a request that stored a second-factor requirement this release cannot perform, writing nothing', async () => {
      m.documentFind.mockResolvedValue({ ...DOC, requireAuthentication: true, signers: [SIGNER] });
      await expect(SignatureService.recordSignature(input)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('second factor') });
      expect(m.tx.update).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('refuses to sign when the stored file no longer matches the hash recorded when it was sent', async () => {
      const { verifySignatureDocumentFile } = await import('../file-integrity');
      vi.mocked(verifySignatureDocumentFile).mockResolvedValueOnce({ status: 'mismatch', expected: 'a', actual: 'b' });
      await expect(SignatureService.recordSignature(input)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('content hash') });
      expect(m.tx.update).not.toHaveBeenCalled();
      expect(m.audit).not.toHaveBeenCalled();
    });

    it('records on the signing event that the file was verified, or that it could not be, and how the address was obtained', async () => {
      const { verifySignatureDocumentFile } = await import('../file-integrity');
      await SignatureService.recordSignature({ ...input, ipAddress: '203.0.113.7', ipProvenance: { source: 'x-forwarded-for', trustedProxyHops: 1 } });
      expect(m.trail[0]).toMatchObject({ eventType: 'document_signed', ipAddress: '203.0.113.7' });
      expect(m.trail[0].metadata).toMatchObject({ fileHashCheck: 'verified', ipProvenance: { source: 'x-forwarded-for', trustedProxyHops: 1 }, chainSeq: 1 });
      expect(String(m.trail[0].hashChain)).toMatch(/^sha256:[0-9a-f]{64}$/);

      m.trail = [];
      vi.mocked(verifySignatureDocumentFile).mockResolvedValueOnce({ status: 'unverified', reason: 'not_own_storage' });
      await SignatureService.recordSignature(input);
      expect(m.trail[0].metadata).toMatchObject({ fileHashCheck: 'unverified:not_own_storage' });
    });

    it('does not create a request that states a second-factor requirement nothing can enforce', async () => {
      await expect(
        SignatureService.createSignatureRequest({ requireAuthentication: true } as never),
      ).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('second-factor') });
    });

    it('makes a later signer wait for the earlier ones when signing is sequential', async () => {
      m.signerFind.mockResolvedValue({ ...SIGNER, signingOrder: 2 });
      m.queue = [[{ id: 'd1' }], [{ expiresAt: null, sequentialSigning: true }], [{ id: 'sg0', status: 'sent' }]];
      await expect(SignatureService.recordSignature(input)).rejects.toMatchObject({ code: 'CONFLICT', message: expect.stringContaining('earlier signer') });
      expect(m.tx.update).not.toHaveBeenCalled();
    });

    it('signs when sequential signing is on and every earlier signer has signed', async () => {
      m.signerFind.mockResolvedValue({ ...SIGNER, signingOrder: 2 });
      m.queue = [[{ id: 'd1' }], [{ expiresAt: null, sequentialSigning: true }], [{ id: 'sg0', status: 'signed' }]];
      await expect(SignatureService.recordSignature(input)).resolves.toMatchObject({ status: 'signed' });
    });

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
