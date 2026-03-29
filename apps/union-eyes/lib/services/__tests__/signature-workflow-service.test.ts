import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockInsert: vi.fn(),
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockSet: vi.fn(),
  mockGetSignatureProvider: vi.fn(),
  mockGetNotificationService: vi.fn(),
  mockCreateAuditLog: vi.fn(),
  mockGetDocumentStorageService: vi.fn(),
  mockCreateHash: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    insert: mocks.mockInsert,
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
  },
}));

vi.mock('@/db/schema/domains/documents', () => ({
  signatureWorkflows: { id: 'id', status: 'status', externalEnvelopeId: 'external_envelope_id', provider: 'provider' },
  signers: { id: 'id', workflowId: 'workflow_id', status: 'status' },
  signatureAuditLog: { id: 'id' },
  signatureVerification: { id: 'id' },
}));

vi.mock('../signature-providers', () => ({
  getSignatureProvider: mocks.mockGetSignatureProvider,
}));

vi.mock('../notification-service', () => ({
  getNotificationService: mocks.mockGetNotificationService,
}));

vi.mock('../audit-service', () => ({
  createAuditLog: mocks.mockCreateAuditLog,
}));

vi.mock('../document-storage-service', () => ({
  getDocumentStorageService: mocks.mockGetDocumentStorageService,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => args),
  or: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col) => ({ column: col, direction: 'desc' })),
  asc: vi.fn((col) => ({ column: col, direction: 'asc' })),
  sql: vi.fn(),
  gt: vi.fn((a, b) => ({ field: a, value: b })),
  lt: vi.fn((a, b) => ({ field: a, value: b })),
  gte: vi.fn((a, b) => ({ field: a, value: b })),
  lte: vi.fn((a, b) => ({ field: a, value: b })),
  inArray: vi.fn((a, b) => ({ field: a, values: b })),
  isNull: vi.fn((a) => ({ field: a, op: 'isNull' })),
  between: vi.fn((a, b, c) => ({ field: a, from: b, to: c })),
  like: vi.fn((a, b) => ({ field: a, pattern: b })),
  ilike: vi.fn((a, b) => ({ field: a, pattern: b })),
  not: vi.fn((a) => ({ op: 'not', value: a })),
  ne: vi.fn((a, b) => ({ field: a, value: b })),
  count: vi.fn(),
  sum: vi.fn(),
  avg: vi.fn(),
  min: vi.fn(),
  max: vi.fn(),
  relations: vi.fn(() => ({})),
}));

vi.mock('crypto', () => ({
  createHash: mocks.mockCreateHash,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  createSignatureWorkflow,
  getWorkflowStatus,
  handleSignerCompleted,
  voidWorkflow,
  sendSignerReminders,
} from '../signature-workflow-service';

// ── Shared helpers ───────────────────────────────────────────────────────────

function setupDefaultMocks() {
  // Hash mock
  mocks.mockCreateHash.mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('hash-abc'),
  });

  // Signature provider mock
  mocks.mockGetSignatureProvider.mockReturnValue({
    name: 'docusign',
    createEnvelope: vi.fn().mockResolvedValue({
      id: 'env-1',
      status: 'sent',
      subject: 'Sign',
      message: 'Please sign',
      signers: [],
      documentUrl: 'https://docusign.example.com/env-1',
      createdAt: new Date(),
    }),
    getEnvelopeStatus: vi.fn().mockResolvedValue({ status: 'sent' }),
    downloadSignedDocument: vi.fn().mockResolvedValue(Buffer.from('signed-pdf')),
    voidEnvelope: vi.fn().mockResolvedValue(undefined),
    sendReminder: vi.fn().mockResolvedValue(undefined),
  });

  // Notification service mock
  mocks.mockGetNotificationService.mockReturnValue({
    send: vi.fn().mockResolvedValue({ id: 'notif-1', status: 'sent' }),
  });

  // Document storage service mock
  mocks.mockGetDocumentStorageService.mockReturnValue({
    uploadDocument: vi.fn().mockResolvedValue({ url: 'https://storage/signed.pdf', key: 'signed.pdf' }),
  });

  // Audit log mock
  mocks.mockCreateAuditLog.mockResolvedValue(undefined);

  // DB Insert chain
  mocks.mockReturning.mockResolvedValue([{
    id: 'wf-1',
    status: 'sent',
    createdAt: new Date(),
  }]);
  mocks.mockValues.mockReturnValue({ returning: mocks.mockReturning });
  mocks.mockInsert.mockReturnValue({ values: mocks.mockValues });

  // DB Update chain
  mocks.mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mocks.mockUpdate.mockReturnValue({ set: mocks.mockSet });

  // DB Select chain — default workflow record
  setupSelectResult([{
    id: 'wf-1',
    status: 'sent',
    name: 'Contract',
    description: 'Sign contract',
    organizationId: 'org-1',
    documentId: 'doc-1',
    externalEnvelopeId: 'env-1',
    provider: 'docusign',
    createdBy: 'user-1',
    createdAt: new Date(),
    completedAt: null,
    workflowData: { documentName: 'contract.pdf', subject: 'Please sign' },
  }]);
}

function setupSelectResult(rows: unknown[]) {
  mocks.mockWhere.mockResolvedValue(rows);
  mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
  mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createSignatureWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  const request = {
    organizationId: 'org-1',
    documentId: 'doc-1',
    documentName: 'contract.pdf',
    documentBuffer: Buffer.from('pdf-data'),
    workflowType: 'contract' as const,
    subject: 'Please sign',
    message: 'Sign the contract',
    signers: [
      { name: 'Alice', email: 'alice@test.com', role: 'signer' },
    ],
    userId: 'user-1',
  };

  it('creates a workflow successfully', async () => {
    const result = await createSignatureWorkflow(request);
    expect(result.id).toBe('wf-1');
    expect(result.status).toBe('sent');
  });

  it('creates envelope with provider', async () => {
    await createSignatureWorkflow(request);
    const provider = mocks.mockGetSignatureProvider();
    expect(provider.createEnvelope).toHaveBeenCalled();
  });

  it('stores signer records in database', async () => {
    await createSignatureWorkflow(request);
    expect(mocks.mockInsert).toHaveBeenCalled();
  });

  it('sends notifications to signers', async () => {
    await createSignatureWorkflow(request);
    const notifService = mocks.mockGetNotificationService();
    expect(notifService.send).toHaveBeenCalled();
  });

  it('throws on provider error', async () => {
    mocks.mockGetSignatureProvider.mockReturnValue({
      name: 'docusign',
      createEnvelope: vi.fn().mockRejectedValue(new Error('Provider error')),
    });
    await expect(createSignatureWorkflow(request)).rejects.toThrow('Provider error');
  });
});

describe('getWorkflowStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('returns workflow status from database', async () => {
    const result = await getWorkflowStatus('wf-1');
    expect(result.id).toBe('wf-1');
    expect(result.status).toBe('sent');
  });

  it('throws if workflow not found', async () => {
    setupSelectResult([]);
    await expect(getWorkflowStatus('wf-999')).rejects.toThrow('not found');
  });

  it('syncs with provider when requested', async () => {
    await getWorkflowStatus('wf-1', true);
    const provider = mocks.mockGetSignatureProvider();
    expect(provider.getEnvelopeStatus).toHaveBeenCalledWith('env-1');
  });
});

describe('handleSignerCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  const signatureData = {
    signedAt: new Date('2026-03-20T10:00:00Z'),
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  it('updates signer status and creates audit log', async () => {
    // First select: workflow, second select: all signers (still pending)
    let callCount = 0;
    mocks.mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{
          id: 'wf-1', status: 'sent', organizationId: 'org-1',
          externalEnvelopeId: 'env-1', provider: 'docusign',
          workflowData: { documentName: 'contract.pdf' },
          name: 'Contract',
        }]);
      }
      // signers — not all completed
      return Promise.resolve([
        { id: 's-1', email: 'alice@test.com', status: 'signed' },
        { id: 's-2', email: 'bob@test.com', status: 'pending' },
      ]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    await handleSignerCompleted('wf-1', 'alice@test.com', signatureData);

    // update called for signer status
    expect(mocks.mockUpdate).toHaveBeenCalled();
    // insert called for audit log + notification
    expect(mocks.mockInsert).toHaveBeenCalled();
    // notification sent
    const notifService = mocks.mockGetNotificationService();
    expect(notifService.send).toHaveBeenCalled();
  });

  it('completes workflow when all signers finished', async () => {
    let callCount = 0;
    mocks.mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // handleSignerCompleted: get workflow
        return Promise.resolve([{
          id: 'wf-1', status: 'sent', organizationId: 'org-1',
          externalEnvelopeId: 'env-1', provider: 'docusign',
          workflowData: { documentName: 'contract.pdf' },
          name: 'Contract', createdBy: 'user-1', documentId: 'doc-1',
          description: 'Sign contract',
        }]);
      }
      if (callCount === 2) {
        // handleSignerCompleted: get all signers — all signed
        return Promise.resolve([
          { id: 's-1', email: 'alice@test.com', status: 'signed' },
        ]);
      }
      // completeWorkflow: get workflow
      return Promise.resolve([{
        id: 'wf-1', status: 'sent', organizationId: 'org-1',
        externalEnvelopeId: 'env-1', provider: 'docusign',
        workflowData: { documentName: 'contract.pdf', documentHash: 'orig-hash' },
        name: 'Contract', createdBy: 'user-1', documentId: 'doc-1',
        description: 'Sign contract',
      }]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    await handleSignerCompleted('wf-1', 'alice@test.com', signatureData);

    // completeWorkflow triggers provider.downloadSignedDocument
    const provider = mocks.mockGetSignatureProvider();
    expect(provider.downloadSignedDocument).toHaveBeenCalledWith('env-1');
    // workflow updated to completed
    expect(mocks.mockUpdate).toHaveBeenCalled();
    // signed document stored
    const storage = mocks.mockGetDocumentStorageService();
    expect(storage.uploadDocument).toHaveBeenCalled();
  });

  it('throws if workflow not found', async () => {
    setupSelectResult([]);
    await expect(
      handleSignerCompleted('wf-999', 'alice@test.com', signatureData)
    ).rejects.toThrow('not found');
  });
});

describe('voidWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('voids envelope with provider and updates DB', async () => {
    // First select: workflow, second select: signers for notifications
    let callCount = 0;
    mocks.mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{
          id: 'wf-1', status: 'sent', organizationId: 'org-1',
          externalEnvelopeId: 'env-1', provider: 'docusign',
          workflowData: { documentName: 'contract.pdf', subject: 'Sign' },
          name: 'Contract', description: 'Sign contract',
        }]);
      }
      // signers
      return Promise.resolve([
        { id: 's-1', email: 'alice@test.com', status: 'pending' },
        { id: 's-2', email: 'bob@test.com', status: 'pending' },
      ]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    await voidWorkflow('wf-1', 'No longer needed', 'user-1');

    const provider = mocks.mockGetSignatureProvider();
    expect(provider.voidEnvelope).toHaveBeenCalledWith('env-1', 'No longer needed');
    expect(mocks.mockUpdate).toHaveBeenCalled();
    // Notifications to both signers
    const notifService = mocks.mockGetNotificationService();
    expect(notifService.send).toHaveBeenCalledTimes(2);
  });

  it('throws if workflow not found', async () => {
    setupSelectResult([]);
    await expect(
      voidWorkflow('wf-999', 'reason', 'user-1')
    ).rejects.toThrow('not found');
  });

  it('creates audit log entry', async () => {
    let callCount = 0;
    mocks.mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{
          id: 'wf-1', status: 'sent', organizationId: 'org-1',
          externalEnvelopeId: 'env-1', provider: 'docusign',
          workflowData: {}, name: 'Contract', description: 'desc',
        }]);
      }
      return Promise.resolve([]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    await voidWorkflow('wf-1', 'cancelled', 'user-1');

    // insert called for audit log
    expect(mocks.mockInsert).toHaveBeenCalled();
    expect(mocks.mockValues).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'workflow_voided',
    }));
  });
});

describe('sendSignerReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('sends reminders to pending signers', async () => {
    // First select: workflow, second select: pending signers
    let callCount = 0;
    mocks.mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{
          id: 'wf-1', status: 'sent', organizationId: 'org-1',
          externalEnvelopeId: 'env-1', provider: 'docusign',
          workflowData: { documentName: 'contract.pdf', subject: 'Sign' },
          name: 'Contract', description: 'Sign contract',
        }]);
      }
      return Promise.resolve([
        { id: 's-1', email: 'alice@test.com', status: 'pending', signingUrl: 'https://sign/1' },
      ]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    await sendSignerReminders('wf-1', 'user-1');

    const provider = mocks.mockGetSignatureProvider();
    expect(provider.sendReminder).toHaveBeenCalledWith('env-1', 'alice@test.com');
    const notifService = mocks.mockGetNotificationService();
    expect(notifService.send).toHaveBeenCalled();
    // audit log for reminder
    expect(mocks.mockInsert).toHaveBeenCalled();
  });

  it('throws if workflow not found', async () => {
    setupSelectResult([]);
    await expect(
      sendSignerReminders('wf-999', 'user-1')
    ).rejects.toThrow('not found');
  });

  it('handles no pending signers gracefully', async () => {
    let callCount = 0;
    mocks.mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{
          id: 'wf-1', status: 'sent', organizationId: 'org-1',
          externalEnvelopeId: 'env-1', provider: 'docusign',
          workflowData: {}, name: 'Contract', description: 'desc',
        }]);
      }
      return Promise.resolve([]);
    });
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    // Should not throw even with no pending signers
    await sendSignerReminders('wf-1', 'user-1');

    const provider = mocks.mockGetSignatureProvider();
    expect(provider.sendReminder).not.toHaveBeenCalled();
  });
});
