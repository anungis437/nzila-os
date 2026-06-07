import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockCreateSign: vi.fn(),
  mockCreateAuditLog: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../audit-service', () => ({
  createAuditLog: mocks.mockCreateAuditLog,
}));

vi.mock('crypto', () => ({
  createSign: mocks.mockCreateSign,
}));

import { DocuSignProvider, HelloSignProvider, AdobeSignProvider, getSignatureProvider } from '../signature-providers';

describe('DocuSignProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock crypto createSign
    mocks.mockCreateSign.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      end: vi.fn(),
      sign: vi.fn().mockReturnValue(Buffer.from('signature')),
    });

    // Mock global fetch
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ access_token: 'token-123', envelopeId: 'env-1' }),
      text: vi.fn().mockResolvedValue(''),
    });

    mocks.mockCreateAuditLog.mockResolvedValue(undefined);
  });

  it('throws if credentials not configured', () => {
    expect(() => new DocuSignProvider('', '', '')).toThrow('DocuSign credentials not configured');
  });

  it('creates instance with valid credentials', () => {
    const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
    expect(provider.name).toBe('docusign');
  });

  describe('createEnvelope', () => {
    it('creates envelope via API', async () => {
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      const result = await provider.createEnvelope({
        documentId: 'doc-1',
        documentName: 'contract.pdf',
        documentBuffer: Buffer.from('pdf'),
        subject: 'Sign this',
        message: 'Please sign',
        signers: [{ name: 'Alice', email: 'alice@test.com', role: 'signer' }],
        organizationId: 'org-1',
        userId: 'user-1',
      });
      expect(result.id).toBeDefined();
      expect(result.status).toBe('sent');
    });

    it('throws on API error', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: false, text: vi.fn().mockResolvedValue('Forbidden') });

      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(
        provider.createEnvelope({
          documentId: 'doc-1',
          documentName: 'c.pdf',
          documentBuffer: Buffer.from('pdf'),
          subject: 'Sign',
          message: 'Please',
          signers: [{ name: 'Bob', email: 'bob@test.com', role: 'signer' }],
          organizationId: 'org-1',
          userId: 'user-1',
        }),
      ).rejects.toThrow('DocuSign API error');
    });
  });

  describe('getEnvelopeStatus', () => {
    it('fetches envelope status', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({ access_token: 'test-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            envelopeId: 'env-1',
            status: 'completed',
            emailSubject: 'Test',
            emailBlurb: 'Test msg',
            createdDateTime: '2026-01-01T00:00:00Z',
            recipients: { signers: [] },
          }),
        });

      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      const result = await provider.getEnvelopeStatus('env-1');
      expect(result.id).toBe('env-1');
    });
  });
});

describe('HelloSignProvider', () => {
  it('creates instance with valid API key', () => {
    const provider = new HelloSignProvider('hs-key');
    expect(provider.name).toBe('hellosign');
  });

  it('throws if no API key', () => {
    expect(() => new HelloSignProvider('')).toThrow();
  });
});

describe('AdobeSignProvider', () => {
  it('creates instance with valid credentials', () => {
    const provider = new AdobeSignProvider('client-id', 'client-secret', 'refresh-token');
    expect(provider.name).toBe('adobe_sign');
  });

  it('throws if credentials missing', () => {
    expect(() => new AdobeSignProvider('', '', '')).toThrow();
  });
});

describe('getSignatureProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCreateSign.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      end: vi.fn(),
      sign: vi.fn().mockReturnValue(Buffer.from('sig')),
    });
  });

  it('returns docusign provider', () => {
    process.env.DOCUSIGN_API_ACCOUNT_ID = 'acct';
    process.env.DOCUSIGN_INTEGRATION_KEY = 'key';
    process.env.DOCUSIGN_USER_ID = 'uid';
    const provider = getSignatureProvider('docusign');
    expect(provider.name).toBe('docusign');
    delete process.env.DOCUSIGN_API_ACCOUNT_ID;
    delete process.env.DOCUSIGN_INTEGRATION_KEY;
    delete process.env.DOCUSIGN_USER_ID;
  });

  it('throws for unknown provider', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => getSignatureProvider('unknown' as any)).toThrow();
  });
});
