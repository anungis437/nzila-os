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

// ════════════════ DOCUSIGN ════════════════

describe('DocuSignProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockCreateSign.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      end: vi.fn(),
      sign: vi.fn().mockReturnValue(Buffer.from('signature')),
    });
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

  it('throws when env-based constructor defaults resolve to empty credentials', () => {
    delete process.env.DOCUSIGN_API_ACCOUNT_ID;
    delete process.env.DOCUSIGN_ACCOUNT_ID;
    delete process.env.DOCUSIGN_INTEGRATION_KEY;
    delete process.env.DOCUSIGN_USER_ID;
    expect(() => new DocuSignProvider()).toThrow('DocuSign credentials not configured');
  });

  it('creates instance with valid credentials', () => {
    const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
    expect(provider.name).toBe('docusign');
  });

  it('uses DOCUSIGN_ACCOUNT_ID fallback when API account id is unset', () => {
    delete process.env.DOCUSIGN_API_ACCOUNT_ID;
    process.env.DOCUSIGN_ACCOUNT_ID = 'acct-fallback';
    process.env.DOCUSIGN_INTEGRATION_KEY = 'key-fallback';
    process.env.DOCUSIGN_USER_ID = 'user-fallback';
    process.env.DOCUSIGN_PRIVATE_KEY = 'pk';

    const provider = new DocuSignProvider();
    expect(provider.name).toBe('docusign');

    delete process.env.DOCUSIGN_ACCOUNT_ID;
    delete process.env.DOCUSIGN_INTEGRATION_KEY;
    delete process.env.DOCUSIGN_USER_ID;
    delete process.env.DOCUSIGN_PRIVATE_KEY;
  });

  it('normalizes DocuSign base URLs and oauth host', () => {
    expect((DocuSignProvider as any).resolveOAuthBaseUrl('https://demo.docusign.net/restapi')).toBe('https://account-d.docusign.com');
    expect((DocuSignProvider as any).resolveOAuthBaseUrl('https://account-d.docusign.com')).toBe('https://account-d.docusign.com');
    expect((DocuSignProvider as any).resolveOAuthBaseUrl('not-a-url')).toBe('https://account.docusign.com');

    expect((DocuSignProvider as any).normalizeBaseUrls('https://demo.docusign.net/')).toEqual({
      apiBaseUrl: 'https://demo.docusign.net/restapi',
      oauthBaseUrl: 'https://account-d.docusign.com',
    });
    expect((DocuSignProvider as any).normalizeBaseUrls('https://api.docusign.net/restapi')).toEqual({
      apiBaseUrl: 'https://api.docusign.net/restapi',
      oauthBaseUrl: 'https://account.docusign.com',
    });
  });

  it('throws when private key is missing during JWT build', () => {
    const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', '', 'https://demo.docusign.net');
    expect(() => (provider as any).buildJwtAssertion()).toThrow('DOCUSIGN_PRIVATE_KEY not configured');
  });

  it('surfaces auth errors when token response is missing access_token', async () => {
    mocks.mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}), text: vi.fn().mockResolvedValue('') });
    const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
    await expect(provider.createEnvelope({
      documentId: 'doc-1', documentName: 'contract.pdf', documentBuffer: Buffer.from('pdf'),
      subject: 'Sign this', message: 'Please sign',
      signers: [{ name: 'Alice', email: 'alice@test.com', role: 'signer' }],
      organizationId: 'org-1', userId: 'user-1',
    })).rejects.toThrow('DocuSign auth response missing access_token');
  });

  describe('createEnvelope', () => {
    it('creates envelope via API', async () => {
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      const result = await provider.createEnvelope({
        documentId: 'doc-1', documentName: 'contract.pdf', documentBuffer: Buffer.from('pdf'),
        subject: 'Sign this', message: 'Please sign',
        signers: [{ name: 'Alice', email: 'alice@test.com', role: 'signer' }],
        organizationId: 'org-1', userId: 'user-1',
      });
      expect(result.id).toBeDefined();
      expect(result.status).toBe('sent');
    });

    it('uses timestamp fallback id when envelopeId is absent', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      const result = await provider.createEnvelope({
        documentId: 'doc-1', documentName: 'c.pdf', documentBuffer: Buffer.from('pdf'),
        subject: 'Sign', message: 'Please',
        signers: [{ name: 'Bob', email: 'bob@test.com', role: 'signer' }],
        organizationId: 'org-1', userId: 'user-1',
      });
      expect(result.id).toMatch(/^docusign-/);
    });

    it('throws on API error', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: false, text: vi.fn().mockResolvedValue('Forbidden') });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(provider.createEnvelope({
        documentId: 'doc-1', documentName: 'c.pdf', documentBuffer: Buffer.from('pdf'),
        subject: 'Sign', message: 'Please',
        signers: [{ name: 'Bob', email: 'bob@test.com', role: 'signer' }],
        organizationId: 'org-1', userId: 'user-1',
      })).rejects.toThrow('DocuSign API error');
    });
  });

  describe('error handling', () => {
    it('throws when token endpoint fails', async () => {
      mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue('Unauthorized') });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(provider.getEnvelopeStatus('env-1')).rejects.toThrow('DocuSign auth error: 401 - Unauthorized');
    });

    it('throws when void endpoint fails', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: false, status: 500, text: vi.fn().mockResolvedValue('boom') });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(provider.voidEnvelope('env-1', 'reason')).rejects.toThrow('DocuSign API error: 500');
    });
  });

  describe('getEnvelopeStatus', () => {
    it('fetches envelope status', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'test-token' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: vi.fn().mockResolvedValue({
            envelopeId: 'env-1', status: 'completed',
            emailSubject: 'Test', emailBlurb: 'Test msg',
            createdDateTime: '2026-01-01T00:00:00Z',
            recipients: { signers: [{ name: 'Alice', email: 'alice@test.com' }] },
          }),
        });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      const result = await provider.getEnvelopeStatus('env-1');
      expect(result.id).toBe('env-1');
      expect(result.signers).toEqual([{ name: 'Alice', email: 'alice@test.com', role: 'signer' }]);
    });

    it('uses fallback values for absent fields', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      const result = await provider.getEnvelopeStatus('env-x');
      expect(result.status).toBe('pending');
      expect(result.signers).toEqual([]);
    });

    it('maps signer fallback values when signer name/email are missing', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ recipients: { signers: [{}] } }) });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      const result = await provider.getEnvelopeStatus('env-fallback-signer');
      expect(result.signers).toEqual([{ name: '', email: '', role: 'signer' }]);
    });

    it('throws on status API error', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: false, status: 404, text: vi.fn().mockResolvedValue('Not found') });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(provider.getEnvelopeStatus('env-x')).rejects.toThrow('DocuSign API error: 404');
    });
  });

  describe('voidEnvelope / download / reminder', () => {
    it('voidEnvelope succeeds', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('') });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(provider.voidEnvelope('env-1', 'reason')).resolves.toBeUndefined();
    });

    it('downloadSignedDocument returns buffer', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer) });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      const buf = await provider.downloadSignedDocument('env-1');
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.length).toBe(3);
    });

    it('throws on download API error', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: false, status: 500, text: vi.fn().mockResolvedValue('err') });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(provider.downloadSignedDocument('env-1')).rejects.toThrow('DocuSign API error: 500');
    });

    it('sendReminder succeeds', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('') });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(provider.sendReminder('env-1', 'alice@test.com')).resolves.toBeUndefined();
    });

    it('throws on reminder API error', async () => {
      mocks.mockFetch
        .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ access_token: 'tok' }) })
        .mockResolvedValueOnce({ ok: false, status: 503, text: vi.fn().mockResolvedValue('') });
      const provider = new DocuSignProvider('acct-1', 'key-1', 'user-1', 'pk', 'https://demo.docusign.net');
      await expect(provider.sendReminder('env-1', 'alice@test.com')).rejects.toThrow('DocuSign API error: 503');
    });
  });
});

// ════════════════ HELLOSIGN ════════════════

describe('HelloSignProvider', () => {
  it('creates instance with valid API key', () => {
    const provider = new HelloSignProvider('hs-key');
    expect(provider.name).toBe('hellosign');
  });

  it('uses HELLOSIGN_API_KEY env fallback in constructor', () => {
    process.env.HELLOSIGN_API_KEY = 'hs-env-key';
    const provider = new HelloSignProvider();
    expect(provider.name).toBe('hellosign');
    delete process.env.HELLOSIGN_API_KEY;
  });

  it('throws if no API key', () => {
    expect(() => new HelloSignProvider('')).toThrow();
  });

  it('throws when env-based HelloSign constructor default resolves to empty key', () => {
    delete process.env.HELLOSIGN_API_KEY;
    expect(() => new HelloSignProvider()).toThrow('HelloSign API key not configured');
  });

  it('createEnvelope sends request and returns envelope', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ signature_request: { signature_request_id: 'hs-1' } }),
    });
    const provider = new HelloSignProvider('hs-key');
    const result = await provider.createEnvelope({
      documentId: 'd1', documentName: 'contract.pdf', documentBuffer: Buffer.from('pdf'),
      subject: 'Please sign', message: 'msg',
      signers: [{ name: 'Alice', email: 'alice@test.com', role: 'signer' }],
      organizationId: 'org-1', userId: 'u1',
    });
    expect(result.id).toBe('hs-1');
    expect(result.status).toBe('sent');
  });

  it('createEnvelope uses timestamp fallback id when signature_request_id is absent', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ signature_request: {} }),
    });
    const provider = new HelloSignProvider('hs-key');
    const result = await provider.createEnvelope({
      documentId: 'd1', documentName: 'contract.pdf', documentBuffer: Buffer.from('pdf'),
      subject: 'Please sign', message: 'msg',
      signers: [{ name: 'Alice', email: 'alice@test.com', role: 'signer' }],
      organizationId: 'org-1', userId: 'u1',
    });
    expect(result.id).toMatch(/^hellosign-/);
  });

  it('createEnvelope uses test_mode 0 in production and supports ArrayBuffer document buffer', async () => {
    globalThis.fetch = mocks.mockFetch;
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    mocks.mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ signature_request: { signature_request_id: 'hs-prod' } }),
    });

    const provider = new HelloSignProvider('hs-key');
    const result = await provider.createEnvelope({
      documentId: 'd1',
      documentName: 'contract.pdf',
      documentBuffer: new Uint8Array([1, 2, 3]).buffer,
      subject: 'Please sign',
      message: 'msg',
      signers: [{ name: 'Alice', email: 'alice@test.com', role: 'signer' }],
      organizationId: 'org-1',
      userId: 'u1',
    });

    expect(mocks.mockFetch).toHaveBeenCalled();
    expect(result.id).toBe('hs-prod');
    process.env.NODE_ENV = oldNodeEnv;
  });

  it('throws when createEnvelope API returns an error', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 429, text: vi.fn().mockResolvedValue('Rate limited') });
    const provider = new HelloSignProvider('hs-key');
    await expect(provider.createEnvelope({
      documentId: 'd1', documentName: 'contract.pdf', documentBuffer: Buffer.from('pdf'),
      subject: 'Please sign', message: 'msg',
      signers: [{ name: 'Alice', email: 'alice@test.com', role: 'signer' }],
      organizationId: 'org-1', userId: 'u1',
    })).rejects.toThrow('HelloSign API error: 429 - Rate limited');
  });

  it('getEnvelopeStatus returns mapped values', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        signature_request: {
          status: 'completed', title: 'T', message: 'M', created_at: 1700000000,
          signatures: [{ signer_name: 'A', signer_email_address: 'a@test.com' }],
        },
      }),
    });
    const provider = new HelloSignProvider('hs-key');
    const result = await provider.getEnvelopeStatus('hs-1');
    expect(result.id).toBe('hs-1');
    expect(result.signers).toHaveLength(1);
  });

  it('getEnvelopeStatus uses fallback values for absent fields', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({
      ok: true, json: vi.fn().mockResolvedValue({ signature_request: {} }),
    });
    const provider = new HelloSignProvider('hs-key');
    const result = await provider.getEnvelopeStatus('hs-x');
    expect(result.status).toBe('pending');
    expect(result.signers).toEqual([]);
  });

  it('getEnvelopeStatus maps signer fallback values when fields are missing', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ signature_request: { signatures: [{}] } }),
    });
    const provider = new HelloSignProvider('hs-key');
    const result = await provider.getEnvelopeStatus('hs-fallback');
    expect(result.signers).toEqual([{ name: '', email: '', role: 'signer' }]);
  });

  it('void/download/reminder succeed', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('') })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([4, 5]).buffer) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('') });
    const provider = new HelloSignProvider('hs-key');
    await expect(provider.voidEnvelope('hs-1', 'reason')).resolves.toBeUndefined();
    const buf = await provider.downloadSignedDocument('hs-1');
    expect(buf.length).toBe(2);
    await expect(provider.sendReminder('hs-1', 'a@test.com')).resolves.toBeUndefined();
  });

  it('throws on voidEnvelope API error', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 409, text: vi.fn().mockResolvedValue('conflict') });
    const provider = new HelloSignProvider('hs-key');
    await expect(provider.voidEnvelope('hs-1', 'reason')).rejects.toThrow('HelloSign API error: 409');
  });

  it('throws on downloadSignedDocument API error', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: vi.fn().mockResolvedValue('Forbidden') });
    const provider = new HelloSignProvider('hs-key');
    await expect(provider.downloadSignedDocument('hs-1')).rejects.toThrow('HelloSign API error: 403');
  });

  it('throws on sendReminder API error', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: vi.fn().mockResolvedValue('bad') });
    const provider = new HelloSignProvider('hs-key');
    await expect(provider.sendReminder('hs-1', 'a@test.com')).rejects.toThrow('HelloSign API error: 400');
  });

  it('throws when status fetch fails', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: vi.fn().mockResolvedValue('') });
    const provider = new HelloSignProvider('hs-key');
    await expect(provider.getEnvelopeStatus('hs-1')).rejects.toThrow('HelloSign API error: 404');
  });
});

// ════════════════ ADOBE SIGN ════════════════

describe('AdobeSignProvider', () => {
  it('creates instance with valid credentials', () => {
    const provider = new AdobeSignProvider('client-id', 'client-secret', 'refresh-token');
    expect(provider.name).toBe('adobe_sign');
  });

  it('uses ADOBE_SIGN_API_KEY env fallback in constructor', () => {
    process.env.ADOBE_SIGN_API_KEY = 'adobe-env-key';
    const provider = new AdobeSignProvider();
    expect(provider.name).toBe('adobe_sign');
    delete process.env.ADOBE_SIGN_API_KEY;
  });

  it('throws if credentials missing', () => {
    expect(() => new AdobeSignProvider('', '', '')).toThrow();
  });

  it('throws when env-based Adobe constructor default resolves to empty key', () => {
    delete process.env.ADOBE_SIGN_API_KEY;
    expect(() => new AdobeSignProvider()).toThrow('Adobe Sign API key not configured');
  });

  it('createEnvelope uploads then creates agreement', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ transientDocumentId: 'td-1' }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ id: 'ag-1' }) });
    const provider = new AdobeSignProvider('api-key');
    const result = await provider.createEnvelope({
      documentId: 'd1', documentName: 'contract.pdf', documentBuffer: Buffer.from('pdf'),
      subject: 'Sign', message: 'msg',
      signers: [{ name: 'A', email: 'a@test.com', role: 'signer' }],
      organizationId: 'org-1', userId: 'u1',
    });
    expect(result.id).toBe('ag-1');
    expect(result.status).toBe('sent');
  });

  it('createEnvelope uses ArrayBuffer and timestamp fallback agreement id when id is absent', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ transientDocumentId: 'td-1' }) })
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });
    const provider = new AdobeSignProvider('api-key');
    const result = await provider.createEnvelope({
      documentId: 'd1',
      documentName: 'contract.pdf',
      documentBuffer: new Uint8Array([1, 2, 3]).buffer,
      subject: 'Sign',
      message: 'msg',
      signers: [{ name: 'A', email: 'a@test.com', role: 'signer' }],
      organizationId: 'org-1',
      userId: 'u1',
    });
    expect(result.id).toMatch(/^adobe-sign-/);
  });

  it('throws when upload fails', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: vi.fn().mockResolvedValue('bad upload') });
    const provider = new AdobeSignProvider('api-key');
    await expect(provider.createEnvelope({
      documentId: 'd1', documentName: 'contract.pdf', documentBuffer: Buffer.from('pdf'),
      subject: 'Sign', message: 'msg',
      signers: [{ name: 'A', email: 'a@test.com', role: 'signer' }],
      organizationId: 'org-1', userId: 'u1',
    })).rejects.toThrow('Adobe Sign upload error: 400');
  });

  it('throws on createEnvelope agreement creation error', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch
      .mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({ transientDocumentId: 'td-1' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: vi.fn().mockResolvedValue('server error') });
    const provider = new AdobeSignProvider('api-key');
    await expect(provider.createEnvelope({
      documentId: 'd1', documentName: 'contract.pdf', documentBuffer: Buffer.from('pdf'),
      subject: 'Sign', message: 'msg',
      signers: [{ name: 'A', email: 'a@test.com', role: 'signer' }],
      organizationId: 'org-1', userId: 'u1',
    })).rejects.toThrow('Adobe Sign API error: 500');
  });

  it('getEnvelopeStatus returns agreement mapping', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        status: 'completed', name: 'Agreement', message: 'M',
        createdDate: '2026-01-01T00:00:00Z',
        participantSetsInfo: [{ memberInfos: [{ name: 'A', email: 'a@test.com' }] }],
      }),
    });
    const provider = new AdobeSignProvider('api-key');
    const result = await provider.getEnvelopeStatus('ag-1');
    expect(result.id).toBe('ag-1');
    expect(result.signers).toHaveLength(1);
  });

  it('getEnvelopeStatus uses fallback values for absent fields', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue({}) });
    const provider = new AdobeSignProvider('api-key');
    const result = await provider.getEnvelopeStatus('ag-x');
    expect(result.status).toBe('pending');
    expect(result.signers).toEqual([]);
  });

  it('getEnvelopeStatus maps signer fallback values when fields are missing', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({ participantSetsInfo: [{ memberInfos: [{}] }] }),
    });
    const provider = new AdobeSignProvider('api-key');
    const result = await provider.getEnvelopeStatus('ag-fallback');
    expect(result.signers).toEqual([{ name: '', email: '', role: 'signer' }]);
  });

  it('throws on getEnvelopeStatus API error', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: vi.fn().mockResolvedValue('Unauthorized') });
    const provider = new AdobeSignProvider('api-key');
    await expect(provider.getEnvelopeStatus('ag-x')).rejects.toThrow('Adobe Sign API error: 401');
  });

  it('void/download/reminder succeed', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('') })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([7]).buffer) })
      .mockResolvedValueOnce({ ok: true, text: vi.fn().mockResolvedValue('') });
    const provider = new AdobeSignProvider('api-key');
    await expect(provider.voidEnvelope('ag-1', 'reason')).resolves.toBeUndefined();
    const buf = await provider.downloadSignedDocument('ag-1');
    expect(buf.length).toBe(1);
    await expect(provider.sendReminder('ag-1', 'a@test.com')).resolves.toBeUndefined();
  });

  it('throws on voidEnvelope API error', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 409, text: vi.fn().mockResolvedValue('') });
    const provider = new AdobeSignProvider('api-key');
    await expect(provider.voidEnvelope('ag-1', 'reason')).rejects.toThrow('Adobe Sign API error: 409');
  });

  it('throws on downloadSignedDocument API error', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: vi.fn().mockResolvedValue('Forbidden') });
    const provider = new AdobeSignProvider('api-key');
    await expect(provider.downloadSignedDocument('ag-1')).rejects.toThrow('Adobe Sign API error: 403');
  });

  it('throws when reminder request fails', async () => {
    globalThis.fetch = mocks.mockFetch;
    mocks.mockFetch.mockResolvedValueOnce({ ok: false, status: 503, text: vi.fn().mockResolvedValue('') });
    const provider = new AdobeSignProvider('api-key');
    await expect(provider.sendReminder('ag-1', 'a@test.com')).rejects.toThrow('Adobe Sign API error: 503');
  });
});

// ════════════════ getSignatureProvider ════════════════

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

  it('returns hellosign provider', () => {
    process.env.HELLOSIGN_API_KEY = 'hs-key';
    const provider = getSignatureProvider('hellosign');
    expect(provider.name).toBe('hellosign');
    delete process.env.HELLOSIGN_API_KEY;
  });

  it('returns adobe_sign provider', () => {
    process.env.ADOBE_SIGN_API_KEY = 'adobe-key';
    const provider = getSignatureProvider('adobe_sign');
    expect(provider.name).toBe('adobe_sign');
    delete process.env.ADOBE_SIGN_API_KEY;
  });
});
