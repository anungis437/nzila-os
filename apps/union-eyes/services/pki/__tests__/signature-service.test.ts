import { describe, it, expect, beforeEach, vi } from 'vitest';
import crypto from 'crypto';
import { TEST_KEY_PEM } from './_pki-fixtures';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'innerJoin', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const findFirst = vi.fn();
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    query: { users: { findFirst } },
  };
  const getUserCertificate = vi.fn();
  return { queue, db, findFirst, getUserCertificate };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/services/financial-service/src/db/schema', () =>
  new Proxy({}, { has: () => true, get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })) }),
);
vi.mock('@/db/schema/domains/documents', () => ({
  signatureWorkflows: new Proxy({}, { get: (_o, c) => ({ __col: c }) }),
  signers: new Proxy({}, { get: (_o, c) => ({ __col: c }) }),
  signatureWorkflowStatusEnum: { enumValues: ['draft', 'in_progress', 'completed', 'cancelled', 'expired'] },
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
}));
vi.mock('../certificate-manager', () => ({ getUserCertificate: h.getUserCertificate }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

import {
  cancelSignatureRequest,
  completeSignatureRequestStep,
  createSignatureRequest,
  expireOverdueSignatureRequests,
  getDocumentSignatures,
  getUserSignatureRequests,
  hashDocument,
  hashDocumentReference,
  rejectSignature,
  signDocument,
  signDocumentWithKey,
  SignatureService,
} from '../signature-service';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

const certInfo = {
  certificateInfo: {
    subject: { commonName: 'Test User' },
    issuer: { commonName: 'Test User' },
    serialNumber: 'ABC',
    validFrom: new Date('2025-01-01'),
    validTo: new Date('2099-01-01'),
    fingerprint: 'AA:BB',
    publicKey: crypto.createPublicKey(TEST_KEY_PEM).export({ type: 'spki', format: 'pem' }) as string,
  },
};

beforeEach(() => {
  h.queue.length = 0;
  h.findFirst.mockReset();
  h.getUserCertificate.mockReset();
});

describe('pki/signature-service', () => {
  describe('hashing', () => {
    it('hashes content with SHA-512', () => {
      const hash = hashDocument('hello');
      expect(hash).toHaveLength(128);
    });

    it('hashes a document reference deterministically', () => {
      const a = hashDocumentReference('contract', 'd1', 'o1');
      const b = hashDocumentReference('contract', 'd1', 'o1');
      expect(a).toBe(b);
    });
  });

  describe('signDocument', () => {
    const params = { documentId: 'd1', documentType: 'contract', userId: 'u1', userName: 'User', organizationId: 'o1' };

    it('signs a document via attestation', async () => {
      h.getUserCertificate.mockResolvedValueOnce(certInfo);
      pushSel([]); // no existing
      pushSel([{ id: 'sig-1', signedAt: new Date().toISOString(), certificateThumbprint: 'AA:BB' }]);
      const result = await signDocument(params);
      expect(result.signatureId).toBe('sig-1');
    });

    it('throws when no certificate exists', async () => {
      h.getUserCertificate.mockResolvedValueOnce(null);
      await expect(signDocument(params)).rejects.toThrow('No active certificate');
    });

    it('throws when already signed by the user', async () => {
      h.getUserCertificate.mockResolvedValueOnce(certInfo);
      pushSel([{ id: 'existing' }]);
      await expect(signDocument(params)).rejects.toThrow('already signed');
    });
  });

  describe('signDocumentWithKey', () => {
    const params = {
      documentId: 'd1',
      documentType: 'contract',
      userId: 'u1',
      userName: 'User',
      organizationId: 'o1',
      documentContent: 'payload',
      privateKeyPem: TEST_KEY_PEM,
    };

    it('signs a document cryptographically', async () => {
      h.getUserCertificate.mockResolvedValueOnce(certInfo);
      pushSel([]); // no existing
      pushSel([{ id: 'sig-2', signedAt: new Date().toISOString(), certificateThumbprint: 'AA:BB' }]);
      const result = await signDocumentWithKey(params);
      expect(result.signatureId).toBe('sig-2');
    });

    it('throws when no certificate exists', async () => {
      h.getUserCertificate.mockResolvedValueOnce(null);
      await expect(signDocumentWithKey(params)).rejects.toThrow('No active certificate');
    });

    it('throws when already signed', async () => {
      h.getUserCertificate.mockResolvedValueOnce(certInfo);
      pushSel([{ id: 'existing' }]);
      await expect(signDocumentWithKey(params)).rejects.toThrow('already signed');
    });

    it('throws when the private key cannot be decrypted (password branch)', async () => {
      h.getUserCertificate.mockResolvedValueOnce(certInfo);
      pushSel([]); // no existing
      await expect(signDocumentWithKey({ ...params, privateKeyPem: 'not-a-valid-key', password: 'wrong' })).rejects.toThrow('Failed to decrypt');
    });
  });

  describe('getDocumentSignatures', () => {
    it('returns mapped signatures', async () => {
      pushSel([
        { id: 's1', signerUserId: 'u1', signerName: 'U', signerTitle: 't', signerEmail: 'e', signatureStatus: 'signed', signedAt: new Date().toISOString(), certificateThumbprint: 'AA', isVerified: true, verifiedAt: new Date().toISOString() },
      ]);
      const sigs = await getDocumentSignatures('d1', 'o1');
      expect(sigs).toHaveLength(1);
      expect(sigs[0].signedAt).toBeInstanceOf(Date);
    });

    it('handles null timestamps without org filter', async () => {
      pushSel([{ id: 's1', signerUserId: 'u1', signerName: 'U', signerTitle: null, signerEmail: null, signatureStatus: 'signed', signedAt: null, certificateThumbprint: null, isVerified: null, verifiedAt: null }]);
      const sigs = await getDocumentSignatures('d1');
      expect(sigs[0].signedAt).toBeNull();
    });
  });

  describe('rejectSignature', () => {
    it('marks a signature rejected', async () => {
      pushSel([]);
      await expect(rejectSignature('sig-1', 'bad', 'admin')).resolves.toBeUndefined();
    });
  });

  describe('createSignatureRequest', () => {
    it('creates a workflow and signer records with email lookup branches', async () => {
      pushSel([{ id: 'wf-1' }]); // workflow insert returning
      // 3 signers; their db.insert(signers) calls default to []
      const invokeWhere = (val: unknown) => (args: { where?: (t: unknown, ops: { eq: (...a: unknown[]) => unknown }) => unknown }) => {
        args.where?.({ userId: 'col' }, { eq: () => ({}) });
        return Promise.resolve(val);
      };
      h.findFirst
        .mockImplementationOnce(invokeWhere({ email: 'a@b.c' })) // found, exercises where callback
        .mockResolvedValueOnce(null) // fallback
        .mockRejectedValueOnce(new Error('db down')); // catch branch
      const req = await createSignatureRequest(
        'd1',
        'contract',
        'o1',
        'req-1',
        'Requester',
        [
          { userId: 'u1', userName: 'U1', order: 3, required: true },
          { userId: 'u2', userName: 'U2', order: 1, required: true },
          { userId: 'u3', userName: 'U3', order: 2, required: true },
        ],
        new Date('2099-01-01'),
      );
      expect(req.id).toBeDefined();
      expect(req.requiredSigners[0].order).toBe(1); // sorted
    });
  });

  describe('getUserSignatureRequests', () => {
    it('groups workflows from joined rows', async () => {
      const wf = {
        id: 'wf-1',
        documentId: 'd1',
        createdBy: 'req-1',
        organizationId: 'o1',
        expiresAt: new Date('2099-01-01'),
        status: 'in_progress',
        createdAt: new Date(),
        completedAt: null,
        workflowData: { documentType: 'contract', requesterName: 'R', signings: [] },
      };
      pushSel([
        { workflow: wf, signer: { id: 'sg1' } },
        { workflow: wf, signer: { id: 'sg2' } }, // duplicate workflow → grouped
      ]);
      const reqs = await getUserSignatureRequests('u1', 'o1', 'in_progress');
      expect(reqs).toHaveLength(1);
    });

    it('falls back when workflowData is missing', async () => {
      pushSel([
        { workflow: { id: 'wf-2', documentId: 'd2', createdBy: null, organizationId: 'o1', expiresAt: null, status: 'draft', createdAt: new Date(), completedAt: null, workflowData: null }, signer: { id: 'sg3' } },
      ]);
      const reqs = await getUserSignatureRequests('u1');
      expect(reqs[0].documentType).toBe('unknown');
    });
  });

  describe('completeSignatureRequestStep', () => {
    const wf = { id: 'wf-1', documentId: 'd1', createdBy: 'req-1', organizationId: 'o1', expiresAt: null, status: 'completed', createdAt: new Date(), completedAt: new Date(), workflowData: { documentType: 'contract', requesterName: 'R' } };
    const sigRows = [{ memberId: 'u1', name: 'U1', signerOrder: 1, signedAt: new Date(), externalSignerId: 'sig-1' }];

    it('completes the workflow when no pending signers remain', async () => {
      pushSel([{ id: 'signer-1' }]); // find signer
      pushSel([]); // update signer
      pushSel([]); // pending signers (empty → complete)
      pushSel([]); // update workflow
      pushSel([wf]); // fetch workflow
      pushSel(sigRows); // workflow signers
      const result = await completeSignatureRequestStep('wf-1', 'u1', 'sig-1');
      expect(result.status).toBe('completed');
      expect(result.requiredSigners).toHaveLength(1);
    });

    it('leaves the workflow open when signers are still pending', async () => {
      pushSel([{ id: 'signer-1' }]); // find signer
      pushSel([]); // update signer
      pushSel([{ id: 'pending-1' }]); // pending signers (non-empty)
      pushSel([{ ...wf, status: 'in_progress' }]); // fetch workflow
      pushSel(sigRows); // workflow signers
      const result = await completeSignatureRequestStep('wf-1', 'u1', 'sig-1');
      expect(result.status).toBe('in_progress');
    });

    it('throws when the signer is not part of the workflow', async () => {
      pushSel([]); // find signer empty
      await expect(completeSignatureRequestStep('wf-1', 'u1', 'sig-1')).rejects.toThrow('Signer not found');
    });
  });

  describe('cancelSignatureRequest', () => {
    it('cancels the workflow and skips pending signers', async () => {
      pushSel([]); // update workflow
      pushSel([]); // update signers
      await expect(cancelSignatureRequest('wf-1', 'admin', 'no longer needed')).resolves.toBeUndefined();
    });
  });

  describe('expireOverdueSignatureRequests', () => {
    it('expires overdue workflows', async () => {
      pushSel([{ id: 'wf-1' }]); // overdue workflows
      // per workflow: update workflow + update signers default []
      const count = await expireOverdueSignatureRequests();
      expect(count).toBe(1);
    });

    it('returns 0 when nothing is overdue', async () => {
      pushSel([]);
      expect(await expireOverdueSignatureRequests()).toBe(0);
    });
  });

  it('exposes the SignatureService namespace', () => {
    expect(typeof SignatureService.hashDocument).toBe('function');
  });
});
