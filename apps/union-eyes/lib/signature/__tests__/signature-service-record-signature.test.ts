import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Round 45 security regression tests.
 *
 * SignatureService.recordSignature() previously updated documentSigners by
 * id alone, with no verification that the authenticated caller was the
 * actual signer. Any authenticated platform user could "sign" on behalf of
 * any other signer (including a completely different organization's
 * document) by supplying an arbitrary signerId UUID. This is a signature
 * forgery / IDOR vulnerability in a compliance-critical e-signature flow.
 */

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findMany: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  updateReturning: vi.fn(),
  insertValues: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    query: {
      documentSigners: {
        findFirst: mocks.findFirst,
        findMany: mocks.findMany,
      },
    },
    update: vi.fn(() => ({
      set: mocks.updateSet,
    })),
    insert: vi.fn(() => ({
      values: mocks.insertValues,
    })),
  },
}));

vi.mock('@/lib/services/notification-service', () => ({
  NotificationService: { send: vi.fn() },
}));

vi.mock('@/lib/services/document-storage-service', () => ({
  default: class {
    uploadDocument = vi.fn();
  },
}));

import { SignatureService } from '../signature-service';

const OWNER_USER_ID = 'user-owner';
const ATTACKER_USER_ID = 'user-attacker';
const SIGNER_ID = 'signer-1';
const DOCUMENT_ID = 'doc-1';

describe('SignatureService.recordSignature ownership verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateSet.mockReturnValue({
      where: mocks.updateWhere,
    });
    mocks.updateWhere.mockReturnValue({
      returning: mocks.updateReturning,
    });
    mocks.insertValues.mockResolvedValue(undefined);
    mocks.findMany.mockResolvedValue([{ status: 'pending' }]);
  });

  it('rejects when the signer row belongs to a different user (impersonation attempt)', async () => {
    mocks.findFirst.mockResolvedValue({
      id: SIGNER_ID,
      documentId: DOCUMENT_ID,
      userId: OWNER_USER_ID,
      email: 'owner@example.com',
      name: 'Owner',
    });

    await expect(
      SignatureService.recordSignature({
        signerId: SIGNER_ID,
        actorUserId: ATTACKER_USER_ID,
        signatureImageUrl: 'https://example.com/sig.png',
        signatureType: 'electronic',
      })
    ).rejects.toThrow('You are not authorized to sign as this signer');

    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it('rejects signing an external signer record (null userId) via the authenticated-session flow', async () => {
    mocks.findFirst.mockResolvedValue({
      id: SIGNER_ID,
      documentId: DOCUMENT_ID,
      userId: null,
      email: 'external@example.com',
      name: 'External Signer',
    });

    await expect(
      SignatureService.recordSignature({
        signerId: SIGNER_ID,
        actorUserId: ATTACKER_USER_ID,
        signatureImageUrl: 'https://example.com/sig.png',
        signatureType: 'electronic',
      })
    ).rejects.toThrow('You are not authorized to sign as this signer');

    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it('rejects when the signer record does not exist', async () => {
    mocks.findFirst.mockResolvedValue(undefined);

    await expect(
      SignatureService.recordSignature({
        signerId: 'does-not-exist',
        actorUserId: OWNER_USER_ID,
        signatureImageUrl: 'https://example.com/sig.png',
        signatureType: 'electronic',
      })
    ).rejects.toThrow('Signer not found');

    expect(mocks.updateSet).not.toHaveBeenCalled();
  });

  it('allows the owning signer to record their own signature', async () => {
    mocks.findFirst.mockResolvedValue({
      id: SIGNER_ID,
      documentId: DOCUMENT_ID,
      userId: OWNER_USER_ID,
      email: 'owner@example.com',
      name: 'Owner',
    });
    mocks.updateReturning.mockResolvedValue([
      {
        id: SIGNER_ID,
        documentId: DOCUMENT_ID,
        userId: OWNER_USER_ID,
        email: 'owner@example.com',
        name: 'Owner',
        status: 'signed',
      },
    ]);

    const result = await SignatureService.recordSignature({
      signerId: SIGNER_ID,
      actorUserId: OWNER_USER_ID,
      signatureImageUrl: 'https://example.com/sig.png',
      signatureType: 'electronic',
    });

    expect(result.status).toBe('signed');
    expect(mocks.updateSet).toHaveBeenCalledTimes(1);
  });
});
