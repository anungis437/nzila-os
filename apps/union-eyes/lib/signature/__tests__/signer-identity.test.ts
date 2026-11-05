import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  members: [] as Array<{ userId: string; name: string | null; email: string | null }>,
  createEnvelope: vi.fn(),
  upload: vi.fn(),
  documentFind: vi.fn(),
  signerFind: vi.fn(),
  joined: [] as unknown[],
}));

vi.mock('@/db', () => ({
  db: { query: { documentSigners: { findFirst: (...a: unknown[]) => m.signerFind(...a) }, signatureDocuments: { findFirst: (...a: unknown[]) => m.documentFind(...a) } } },
}));
vi.mock('@/db/schema', () => {
  const t = (name: string) => new Proxy({}, { get: (_x, p) => `${name}.${String(p)}` });
  return { signatureDocuments: t('signatureDocuments'), documentSigners: t('documentSigners'), signatureAuditTrail: t('signatureAuditTrail') };
});
vi.mock('@/db/schema-organizations', () => ({ organizationMembers: { userId: 'userId', name: 'name', email: 'email', organizationId: 'organizationId', status: 'status' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), and: vi.fn(() => 'and'), or: vi.fn(), desc: vi.fn(), notInArray: vi.fn(), inArray: vi.fn(() => 'in'), isNull: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_org: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      select: () => ({
        from: () => ({
          where: async () => m.members,
          innerJoin: () => ({ where: () => ({ limit: async () => m.joined }) }),
        }),
      }),
    }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('../providers', () => ({ default: { getProvider: () => ({ name: 'internal', createEnvelope: m.createEnvelope }), getDefaultProvider: () => ({ name: 'internal', createEnvelope: m.createEnvelope }) } }));
vi.mock('@/lib/services/notification-service', () => ({ NotificationService: {} }));
vi.mock('@/lib/services/document-storage-service', () => ({ default: class { uploadDocument = m.upload } }));


import { verifySignerList, signerListSchema, SignerVerificationError } from '../signer-verification';

// DEF-0B11-SOC-SIGNER-IDENTITY-IS-SENDER-TYPED-TEXT-AND-A-SENDER-CAN-SIGN-AS-A-NAMED-PERSON-AND-COMPLETE-THE-DOCUMENT

describe('verifySignerList', () => {
  const alice = { userId: 'u-alice', name: 'Alice Member', email: 'Alice@Union.example' };

  it('stores a platform signer under the member record, discarding the name and e-mail the sender typed', () => {
    const [signer] = verifySignerList(
      [{ userId: 'u-alice', name: 'The Prime Minister', email: 'pm@gov.example' }],
      [alice],
    );
    expect(signer).toMatchObject({ userId: 'u-alice', name: 'Alice Member', email: 'alice@union.example' });
  });

  it('refuses a platform signer who is not an active member of the organization', () => {
    expect(() => verifySignerList([{ userId: 'u-outsider', name: 'Out', email: 'out@x.example' }], [alice])).toThrow(SignerVerificationError);
  });

  it('refuses a user id listed twice and two signers sharing an e-mail address', () => {
    expect(() =>
      verifySignerList([{ userId: 'u-alice', name: 'A', email: 'a@x.example' }, { userId: 'u-alice', name: 'A2', email: 'a2@x.example' }], [alice]),
    ).toThrow('listed more than once');
    expect(() =>
      verifySignerList([{ name: 'E1', email: 'same@x.example' }, { name: 'E2', email: 'SAME@x.example' }], []),
    ).toThrow('share an e-mail');
  });

  it('keeps an external signer as an e-mail identity with no platform user id', () => {
    const [signer] = verifySignerList([{ name: 'Outside Counsel', email: 'Counsel@Firm.example' }], []);
    expect(signer).toEqual({ name: 'Outside Counsel', email: 'counsel@firm.example' });
    expect(signer.userId).toBeUndefined();
  });

  it('a sender who lists their own id under another person\'s name is stored as themselves', () => {
    const [signer] = verifySignerList([{ userId: 'u-alice', name: 'CEO Jane Doe', email: 'jane@union.example' }], [alice]);
    expect(signer.name).toBe('Alice Member');
    expect(signer.email).toBe('alice@union.example');
  });
});

describe('signerListSchema', () => {
  it('rejects unknown fields, bad e-mail addresses, empty and oversized lists', () => {
    expect(signerListSchema.safeParse([{ email: 'a@x.example', name: 'A', status: 'signed' }]).success).toBe(false);
    expect(signerListSchema.safeParse([{ email: 'nope', name: 'A' }]).success).toBe(false);
    expect(signerListSchema.safeParse([]).success).toBe(false);
    expect(signerListSchema.safeParse(Array.from({ length: 21 }, (_, i) => ({ email: `s${i}@x.example`, name: 'S' }))).success).toBe(false);
    expect(signerListSchema.safeParse([{ email: 'a@x.example', name: 'A', signingOrder: 1 }]).success).toBe(true);
  });
});

describe('SignatureService.createSignatureRequest and recordSignature — identity and provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.members = [];
    m.joined = [];
  });

  const request = (signers: Array<Record<string, unknown>>) => ({
    organizationId: 'org-1', title: 'T', documentType: 'contract', file: Buffer.from('x'), fileName: 'a.pdf', sentBy: 'sender',
    signers: signers as never,
  });

  it('creates no envelope and stores no file when a platform signer is not an active member', async () => {
    const { SignatureService, SignatureAuthorityError } = await import('../signature-service');
    m.members = [];
    await expect(SignatureService.createSignatureRequest(request([{ userId: 'outsider', name: 'X', email: 'x@x.example' }]))).rejects.toBeInstanceOf(SignatureAuthorityError);
    expect(m.createEnvelope).not.toHaveBeenCalled();
    expect(m.upload).not.toHaveBeenCalled();
  });

  it('creates no envelope for a malformed signer list', async () => {
    const { SignatureService } = await import('../signature-service');
    await expect(SignatureService.createSignatureRequest(request([{ email: 'nope', name: 'X' }]))).rejects.toThrow('signer list is invalid');
    expect(m.createEnvelope).not.toHaveBeenCalled();
  });

  it('refuses to record a signature locally on a document held by a signature provider', async () => {
    const { SignatureService } = await import('../signature-service');
    m.joined = [{ signer: { id: 'sg1', documentId: 'd1', userId: 'actor', name: 'A', email: 'a@x.example' }, document: { id: 'd1', organizationId: 'org-1', status: 'sent', provider: 'docusign' } }];
    await expect(
      SignatureService.recordSignature({ signerId: 'sg1', actorUserId: 'actor', organizationId: 'org-1', signatureImageUrl: 'https://x.example/s.png', signatureType: 'electronic' }),
    ).rejects.toThrow('signed through its signature provider');
  });
});
