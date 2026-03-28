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

import { createSignatureWorkflow, getWorkflowStatus } from '../signature-workflow-service';

describe('createSignatureWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
      getEnvelopeStatus: vi.fn(),
    });

    // Notification service mock
    mocks.mockGetNotificationService.mockReturnValue({
      send: vi.fn().mockResolvedValue({ id: 'notif-1', status: 'sent' }),
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

    // DB Select chain
    mocks.mockWhere.mockResolvedValue([{
      id: 'wf-1',
      status: 'sent',
      externalEnvelopeId: 'env-1',
      provider: 'docusign',
      createdAt: new Date(),
      completedAt: null,
    }]);
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });
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
    // insert called for workflow, signers, and audit log entries
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

    // Select chain for workflow
    mocks.mockWhere.mockResolvedValue([{
      id: 'wf-1',
      status: 'sent',
      externalEnvelopeId: 'env-1',
      provider: 'docusign',
      createdAt: new Date(),
      completedAt: null,
    }]);
    mocks.mockFrom.mockReturnValue({ where: mocks.mockWhere });
    mocks.mockSelect.mockReturnValue({ from: mocks.mockFrom });

    mocks.mockGetSignatureProvider.mockReturnValue({
      name: 'docusign',
      getEnvelopeStatus: vi.fn().mockResolvedValue({ status: 'completed' }),
    });

    mocks.mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });
  });

  it('returns workflow status from database', async () => {
    const result = await getWorkflowStatus('wf-1');
    expect(result.id).toBe('wf-1');
    expect(result.status).toBe('sent');
  });

  it('throws if workflow not found', async () => {
    mocks.mockWhere.mockResolvedValue([]);
    await expect(getWorkflowStatus('wf-999')).rejects.toThrow('not found');
  });

  it('syncs with provider when requested', async () => {
    await getWorkflowStatus('wf-1', true);
    const provider = mocks.mockGetSignatureProvider();
    expect(provider.getEnvelopeStatus).toHaveBeenCalledWith('env-1');
  });
});
