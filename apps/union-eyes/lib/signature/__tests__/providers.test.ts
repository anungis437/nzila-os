import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  SignatureError,
  DocuSignProvider,
  HelloSignProvider,
  InternalSignatureProvider,
  SignatureProviderFactory,
  type CreateEnvelopeRequest,
  type EnvelopeResponse,
  type EnvelopeStatus,
} from '../providers';

function makeRequest(overrides?: Partial<CreateEnvelopeRequest>): CreateEnvelopeRequest {
  return {
    document: {
      name: 'contract.pdf',
      content: Buffer.from('pdf-content'),
      fileType: 'pdf',
    },
    signers: [
      { email: 'alice@example.com', name: 'Alice', order: 1 },
      { email: 'bob@example.com', name: 'Bob', order: 2 },
    ],
    subject: 'Sign this',
    message: 'Please sign',
    callbackUrl: 'https://example.com/webhook',
    ...overrides,
  };
}

// ─── SignatureError ──────────────────────────────────────────────────

describe('SignatureError', () => {
  it('creates with default status 500', () => {
    const err = new SignatureError('fail');
    expect(err.message).toBe('fail');
    expect(err.status).toBe(500);
    expect(err.name).toBe('SignatureError');
    expect(err).toBeInstanceOf(Error);
  });

  it('creates with custom status', () => {
    const err = new SignatureError('not found', 404);
    expect(err.status).toBe(404);
  });
});

// ─── InternalSignatureProvider ───────────────────────────────────────

describe('InternalSignatureProvider', () => {
  let provider: InternalSignatureProvider;

  beforeEach(() => {
    provider = new InternalSignatureProvider();
  });

  it('has name "internal"', () => {
    expect(provider.name).toBe('internal');
  });

  it('creates envelope with deterministic structure', async () => {
    const req = makeRequest();
    const result = await provider.createEnvelope(req);

    expect(result.envelopeId).toMatch(/^internal_/);
    expect(result.status).toBe('sent');
    expect(result.signers).toHaveLength(2);
    expect(result.signers[0].email).toBe('alice@example.com');
    expect(result.signers[0].signerId).toBe('signer_1');
    expect(result.signers[0].status).toBe('sent');
    expect(result.signers[0].signUrl).toContain('/sign/');
    expect(result.signers[0].signUrl).toContain('token=');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('different signers get different sign URLs', async () => {
    const req = makeRequest();
    const result = await provider.createEnvelope(req);
    expect(result.signers[0].signUrl).not.toBe(result.signers[1].signUrl);
  });

  it('returns default envelope status', async () => {
    const status = await provider.getEnvelopeStatus('env_123');
    expect(status.envelopeId).toBe('env_123');
    expect(status.status).toBe('sent');
    expect(status.signers).toEqual([]);
  });

  it('returns empty buffer for downloadDocument', async () => {
    const buf = await provider.downloadDocument('env_123');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf.length).toBe(0);
  });

  it('voidEnvelope resolves', async () => {
    await expect(provider.voidEnvelope('env_123', 'cancel')).resolves.toBeUndefined();
  });

  it('sendReminder resolves', async () => {
    await expect(provider.sendReminder('env_123', 'signer_1')).resolves.toBeUndefined();
  });
});

// ─── DocuSignProvider ────────────────────────────────────────────────

describe('DocuSignProvider', () => {
  let provider: DocuSignProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new DocuSignProvider({
      apiKey: 'test-key',
      accountId: 'test-account',
      environment: 'sandbox',
    });
  });

  it('has name "docusign"', () => {
    expect(provider.name).toBe('docusign');
  });

  it('creates envelope successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_env_1',
        status: 'sent',
        recipients: { signers: [{ embeddedRecipientStartURL: 'https://ds/sign' }] },
      }),
    });

    const result = await provider.createEnvelope(makeRequest());
    expect(result.envelopeId).toBe('ds_env_1');
    expect(result.status).toBe('sent');
    expect(result.signers).toHaveLength(2);

    // Verify fetch was called with sandbox URL
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toContain('demo.docusign.net');
    expect(call[0]).toContain('/envelopes');
  });

  it('uses production URL when environment is production', () => {
    const prod = new DocuSignProvider({
      apiKey: 'k',
      accountId: 'a',
      environment: 'production',
    });
    expect(prod.name).toBe('docusign');
  });

  it('throws on failed createEnvelope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    await expect(provider.createEnvelope(makeRequest())).rejects.toThrow(
      'Failed to create DocuSign envelope'
    );
  });

  it('getEnvelopeStatus returns mapped result', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_env_1',
        status: 'Completed',
        recipients: {
          signers: [
            {
              recipientId: '1',
              email: 'alice@example.com',
              status: 'completed',
              signedDateTime: '2025-01-01T00:00:00Z',
              deliveredDateTime: '2024-12-31T00:00:00Z',
            },
          ],
        },
        completedDateTime: '2025-01-01T12:00:00Z',
      }),
    });

    const status = await provider.getEnvelopeStatus('ds_env_1');
    expect(status.envelopeId).toBe('ds_env_1');
    expect(status.status).toBe('completed');
    expect(status.signers[0].signedAt).toBeInstanceOf(Date);
    expect(status.completedAt).toBeInstanceOf(Date);
  });

  it('throws on failed getEnvelopeStatus', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    });

    await expect(provider.getEnvelopeStatus('bad')).rejects.toThrow(
      'Failed to get DocuSign envelope status'
    );
  });

  it('downloadDocument returns buffer', async () => {
    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => pdfBytes.buffer,
    });

    const buf = await provider.downloadDocument('ds_env_1');
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('throws on failed downloadDocument', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Server Error',
    });

    await expect(provider.downloadDocument('bad')).rejects.toThrow(
      'Failed to download DocuSign document'
    );
  });

  it('voidEnvelope calls PUT', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await provider.voidEnvelope('ds_env_1', 'cancelled');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/envelopes/ds_env_1');
    expect(opts.method).toBe('PUT');
  });

  it('throws on failed voidEnvelope', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'Bad Request',
    });

    await expect(provider.voidEnvelope('bad', 'reason')).rejects.toThrow(
      'Failed to void DocuSign envelope'
    );
  });

  it('sendReminder calls POST', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await provider.sendReminder('ds_env_1', 'signer_1');

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain('/notification');
    expect(opts.method).toBe('POST');
  });

  it('throws on failed sendReminder', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Error',
    });

    await expect(provider.sendReminder('bad', 's1')).rejects.toThrow(
      'Failed to send DocuSign reminder'
    );
  });
});

// ─── HelloSignProvider ───────────────────────────────────────────────

describe('HelloSignProvider', () => {
  let provider: HelloSignProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new HelloSignProvider({ apiKey: 'hs-key' });
  });

  it('has name "hellosign"', () => {
    expect(provider.name).toBe('hellosign');
  });

  it('creates envelope successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          signature_request_id: 'hs_req_1',
          is_complete: false,
          is_declined: false,
          signatures: [
            { signer_email_address: 'alice@example.com', signature_id: 'sig_1', status_code: 'awaiting_signature' },
          ],
          created_at: 1700000000,
        },
      }),
    });

    const result = await provider.createEnvelope(makeRequest());
    expect(result.envelopeId).toBe('hs_req_1');
    expect(result.status).toBe('sent');
    expect(result.signers[0].status).toBe('sent');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('throws SignatureError on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ error: { error_msg: 'Invalid key' } }),
    });

    await expect(provider.createEnvelope(makeRequest())).rejects.toThrow(SignatureError);
  });

  it('getEnvelopeStatus maps completed status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          is_complete: true,
          is_declined: false,
          signatures: [
            { signer_email_address: 'a@b.com', signature_id: 's1', status_code: 'signed' },
          ],
        },
      }),
    });

    const status = await provider.getEnvelopeStatus('hs_1');
    expect(status.status).toBe('completed');
    expect(status.signers[0].status).toBe('completed');
  });

  it('getEnvelopeStatus maps declined status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          is_complete: false,
          is_declined: true,
          signatures: [
            { signer_email_address: 'a@b.com', signature_id: 's1', status_code: 'declined' },
          ],
        },
      }),
    });

    const status = await provider.getEnvelopeStatus('hs_1');
    expect(status.status).toBe('declined');
    expect(status.signers[0].status).toBe('declined');
  });

  it('throws on failed getEnvelopeStatus', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(provider.getEnvelopeStatus('bad')).rejects.toThrow(SignatureError);
  });

  it('downloadDocument returns buffer', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });

    const buf = await provider.downloadDocument('hs_1');
    expect(buf).toBeInstanceOf(Buffer);
  });

  it('voidEnvelope resolves on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(provider.voidEnvelope('hs_1', 'cancel')).resolves.toBeUndefined();
  });

  it('sendReminder resolves on success', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(provider.sendReminder('hs_1', 'alice@example.com')).resolves.toBeUndefined();
  });
});

// ─── SignatureProviderFactory ────────────────────────────────────────

describe('SignatureProviderFactory', () => {
  beforeEach(() => {
    // Clear providers map and re-initialize to avoid state leaking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (SignatureProviderFactory as any).providers = new Map();
    SignatureProviderFactory.initialize({});
  });

  it('always has internal provider', () => {
    const provider = SignatureProviderFactory.getProvider('internal');
    expect(provider.name).toBe('internal');
  });

  it('throws for unconfigured provider', () => {
    expect(() => SignatureProviderFactory.getProvider('docusign')).toThrow(
      'Provider docusign not configured'
    );
  });

  it('initializes docusign provider', () => {
    SignatureProviderFactory.initialize({
      docusign: { apiKey: 'k', accountId: 'a' },
    });
    const p = SignatureProviderFactory.getProvider('docusign');
    expect(p.name).toBe('docusign');
  });

  it('initializes hellosign provider', () => {
    SignatureProviderFactory.initialize({
      hellosign: { apiKey: 'k' },
    });
    const p = SignatureProviderFactory.getProvider('hellosign');
    expect(p.name).toBe('hellosign');
  });

  it('getDefaultProvider returns docusign when configured', () => {
    SignatureProviderFactory.initialize({
      docusign: { apiKey: 'k', accountId: 'a' },
      hellosign: { apiKey: 'k' },
    });
    const p = SignatureProviderFactory.getDefaultProvider();
    expect(p.name).toBe('docusign');
  });

  it('getDefaultProvider falls back to hellosign', () => {
    SignatureProviderFactory.initialize({
      hellosign: { apiKey: 'k' },
    });
    const p = SignatureProviderFactory.getDefaultProvider();
    expect(p.name).toBe('hellosign');
  });

  it('getDefaultProvider falls back to internal', () => {
    SignatureProviderFactory.initialize({});
    const p = SignatureProviderFactory.getDefaultProvider();
    expect(p.name).toBe('internal');
  });

  it('type checks for interfaces', () => {
    const req: CreateEnvelopeRequest = makeRequest();
    expect(req.subject).toBeTruthy();
    const resp: EnvelopeResponse = {
      envelopeId: 'e1',
      status: 'sent',
      signers: [],
      createdAt: new Date(),
    };
    expect(resp.envelopeId).toBeTruthy();
    const status: EnvelopeStatus = {
      envelopeId: 'e1',
      status: 'sent',
      signers: [],
    };
    expect(status.status).toBe('sent');
  });
});

// ─── Uncovered Branch Tests ──────────────────────────────────────────

describe('DocuSignProvider - callbackUrl branch', () => {
  let provider: DocuSignProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new DocuSignProvider({
      apiKey: 'test-key',
      accountId: 'test-account',
      environment: 'sandbox',
    });
  });

  it('creates envelope without callbackUrl (eventNotification omitted)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_env_2',
        status: 'sent',
        recipients: { signers: [{ embeddedRecipientStartURL: 'https://ds/sign' }] },
      }),
    });

    const req = makeRequest({ callbackUrl: undefined });
    const result = await provider.createEnvelope(req);
    
    expect(result.envelopeId).toBe('ds_env_2');

    // Verify the request body does NOT include eventNotification
    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body as string);
    expect(body.eventNotification).toBeUndefined();
  });

  it('creates envelope with empty signers array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_env_empty',
        status: 'sent',
        recipients: { signers: [] },
      }),
    });

    const req = makeRequest({ signers: [] });
    const result = await provider.createEnvelope(req);
    
    expect(result.envelopeId).toBe('ds_env_empty');
    expect(result.signers).toHaveLength(0);
  });
});

describe('HelloSignProvider - error handling', () => {
  let provider: HelloSignProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new HelloSignProvider({ apiKey: 'hs-key' });
  });

  it('handles .json() parse failure gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: async () => { throw new Error('Failed to parse JSON'); },
    });

    await expect(provider.createEnvelope(makeRequest())).rejects.toThrow(SignatureError);
  });

  it('creates envelope with empty signers array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          signature_request_id: 'hs_empty',
          is_complete: false,
          is_declined: false,
          signatures: [],
          created_at: 1700000000,
        },
      }),
    });

    const req = makeRequest({ signers: [] });
    const result = await provider.createEnvelope(req);
    
    expect(result.envelopeId).toBe('hs_empty');
    expect(result.signers).toHaveLength(0);
  });

  it('maps unknown signer status to sent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          is_complete: false,
          is_declined: false,
          signatures: [
            { signer_email_address: 'a@b.com', signature_id: 's1', status_code: 'unknown_status' },
          ],
        },
      }),
    });

    const status = await provider.getEnvelopeStatus('hs_1');
    expect(status.signers[0].status).toBe('sent');
  });

  it('handles getEnvelopeStatus with .json() parse failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new Error('Parse error'); },
    });

    await expect(provider.getEnvelopeStatus('hs_1')).rejects.toThrow();
  });
});

describe('SignatureProviderFactory - initialization state', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (SignatureProviderFactory as any).providers = new Map();
    SignatureProviderFactory.initialize({});
  });

  it('handles multiple initializations with merging', () => {
    // First init with docusign
    SignatureProviderFactory.initialize({
      docusign: { apiKey: 'k1', accountId: 'a1' },
    });
    expect(SignatureProviderFactory.getProvider('docusign').name).toBe('docusign');

    // Second init with hellosign - should add, not replace
    SignatureProviderFactory.initialize({
      hellosign: { apiKey: 'k2' },
    });
    expect(SignatureProviderFactory.getProvider('docusign').name).toBe('docusign');
    expect(SignatureProviderFactory.getProvider('hellosign').name).toBe('hellosign');
  });

  it('overwrites provider on re-initialization with same type', () => {
    SignatureProviderFactory.initialize({
      docusign: { apiKey: 'old', accountId: 'a' },
    });

    // Re-init with different key
    SignatureProviderFactory.initialize({
      docusign: { apiKey: 'new', accountId: 'b' },
    });

    // Should still return docusign (verifying it initialized)
    expect(SignatureProviderFactory.getProvider('docusign').name).toBe('docusign');
  });
});

// ─── Branch Coverage: DocuSign catch instanceof branches ─────────────

describe('DocuSignProvider - branch coverage', () => {
  let provider: DocuSignProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new DocuSignProvider({
      apiKey: 'test-key',
      accountId: 'test-account',
      environment: 'sandbox',
    });
  });

  it('createEnvelope wraps non-Error throws', async () => {
    mockFetch.mockRejectedValueOnce('string error');
    await expect(provider.createEnvelope(makeRequest())).rejects.toThrow(
      'Failed to create DocuSign envelope: Unknown error'
    );
  });

  it('getEnvelopeStatus wraps non-Error throws', async () => {
    mockFetch.mockRejectedValueOnce({ code: 'net' });
    await expect(provider.getEnvelopeStatus('env-1')).rejects.toThrow(
      'Failed to get DocuSign envelope status: Unknown error'
    );
  });

  it('getEnvelopeStatus handles undefined completedDateTime', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_env_3',
        status: 'Sent',
        recipients: { signers: [] },
        // completedDateTime omitted
      }),
    });
    const status = await provider.getEnvelopeStatus('ds_env_3');
    expect(status.completedAt).toBeUndefined();
  });

  it('getEnvelopeStatus handles signer without signedDateTime/deliveredDateTime', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_env_4',
        status: 'Sent',
        recipients: {
          signers: [
            { recipientId: '1', email: 'a@b.com', status: 'sent' },
          ],
        },
      }),
    });
    const status = await provider.getEnvelopeStatus('ds_env_4');
    expect(status.signers[0].signedAt).toBeUndefined();
    expect(status.signers[0].viewedAt).toBeUndefined();
  });

  it('downloadDocument wraps non-Error throws', async () => {
    mockFetch.mockRejectedValueOnce(42);
    await expect(provider.downloadDocument('env-1')).rejects.toThrow(
      'Failed to download DocuSign document: Unknown error'
    );
  });

  it('voidEnvelope wraps non-Error throws', async () => {
    mockFetch.mockRejectedValueOnce(null);
    await expect(provider.voidEnvelope('env-1', 'test')).rejects.toThrow(
      'Failed to void DocuSign envelope: Unknown error'
    );
  });

  it('sendReminder wraps non-Error throws', async () => {
    mockFetch.mockRejectedValueOnce(undefined);
    await expect(provider.sendReminder('env-1', 's1')).rejects.toThrow(
      'Failed to send DocuSign reminder: Unknown error'
    );
  });

  it('createEnvelope uses signer.order fallback to index+1', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_env_order',
        status: 'sent',
        recipients: { signers: [] },
      }),
    });

    const req = makeRequest({
      signers: [
        { email: 'a@b.com', name: 'Alice' }, // no order property
      ],
    });
    await provider.createEnvelope(req);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    // order fallback: 0 || (0 + 1) = 1
    expect(body.recipients.signers[0].routingOrder).toBe(1);
  });
});

// ─── Branch Coverage: HelloSign failure paths ────────────────────────

describe('HelloSignProvider - failure branches', () => {
  let provider: HelloSignProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new HelloSignProvider({ apiKey: 'hs-key' });
  });

  it('downloadDocument throws on failed response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });
    await expect(provider.downloadDocument('hs_bad')).rejects.toThrow(SignatureError);
  });

  it('downloadDocument wraps network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failure'));
    await expect(provider.downloadDocument('hs_bad')).rejects.toThrow('Network failure');
  });

  it('voidEnvelope throws on failed response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    });
    await expect(provider.voidEnvelope('hs_bad', 'cancel')).rejects.toThrow(SignatureError);
  });

  it('voidEnvelope wraps non-Error throw', async () => {
    mockFetch.mockRejectedValueOnce('oops');
    await expect(provider.voidEnvelope('hs_bad', 'cancel')).rejects.toThrow();
  });

  it('sendReminder throws on failed response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
    });
    await expect(provider.sendReminder('hs_bad', 'a@b.com')).rejects.toThrow(SignatureError);
  });

  it('sendReminder wraps non-Error throw', async () => {
    mockFetch.mockRejectedValueOnce(99);
    await expect(provider.sendReminder('hs_bad', 'a@b.com')).rejects.toThrow();
  });

  it('getEnvelopeStatus wraps non-Error throw', async () => {
    mockFetch.mockRejectedValueOnce('bad');
    await expect(provider.getEnvelopeStatus('hs_bad')).rejects.toThrow();
  });

  it('createEnvelope wraps non-Error throw', async () => {
    mockFetch.mockRejectedValueOnce({ reason: 'timeout' });
    await expect(provider.createEnvelope(makeRequest())).rejects.toThrow();
  });

  it('createEnvelope uses fallback when json parse fails on error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => { throw new Error('not json'); },
    });
    await expect(provider.createEnvelope(makeRequest())).rejects.toThrow(
      'Unknown error'
    );
  });

  it('maps error signer status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          is_complete: false,
          is_declined: false,
          signatures: [
            { signer_email_address: 'a@b.com', signature_id: 's1', status_code: 'error' },
          ],
        },
      }),
    });
    const status = await provider.getEnvelopeStatus('hs_1');
    expect(status.signers[0].status).toBe('error');
  });

  it('maps declined signer status inside createEnvelope response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          signature_request_id: 'hs_dec',
          is_complete: false,
          is_declined: true,
          signatures: [
            { signer_email_address: 'a@b.com', signature_id: 's1', status_code: 'declined' },
          ],
          created_at: 1700000000,
        },
      }),
    });
    const result = await provider.createEnvelope(makeRequest());
    expect(result.status).toBe('declined');
    expect(result.signers[0].status).toBe('declined');
  });
});

// ─── Branch Coverage: DocuSign missing optional fields ───────────────

describe('DocuSignProvider - optional field branches', () => {
  let provider: DocuSignProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new DocuSignProvider({
      apiKey: 'ds-key',
      accountId: 'ds-acct',
    });
  });

  it('createEnvelope with no message uses empty string fallback', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_nomsg',
        status: 'sent',
        recipients: { signers: [] },
      }),
    });

    const req = makeRequest({ message: undefined });
    await provider.createEnvelope(req);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.emailBlurb).toBe('');
  });

  it('getEnvelopeStatus fallbacks for missing status and signers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_no_status',
        // no status field
        // no recipients field
      }),
    });

    const result = await provider.getEnvelopeStatus('ds_no_status');
    expect(result.status).toBe('sent'); // || "sent" fallback
    expect(result.signers).toEqual([]); // || [] fallback
  });

  it('getEnvelopeStatus maps signer without status to sent', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        envelopeId: 'ds_nostatus',
        status: 'InProgress',
        recipients: {
          signers: [
            {
              recipientId: 'r1',
              email: 'a@b.com',
              // no status, no signedDateTime, no deliveredDateTime
            },
          ],
        },
      }),
    });

    const result = await provider.getEnvelopeStatus('ds_nostatus');
    expect(result.signers[0].status).toBe('sent');
    expect(result.signers[0].signedAt).toBeUndefined();
    expect(result.signers[0].viewedAt).toBeUndefined();
  });
});

// ─── Branch Coverage: HelloSign additional branches ──────────────────

describe('HelloSignProvider - additional branches', () => {
  let provider: HelloSignProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new HelloSignProvider({ apiKey: 'hs-key' });
  });

  it('createEnvelope with no message uses empty string', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          signature_request_id: 'hs_nomsg',
          is_complete: false,
          is_declined: false,
          signatures: [],
          created_at: 1700000000,
        },
      }),
    });

    const req = makeRequest({ message: undefined });
    await provider.createEnvelope(req);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('createEnvelope signer without order uses 0 fallback', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signature_request: {
          signature_request_id: 'hs_noord',
          is_complete: false,
          is_declined: false,
          signatures: [
            { signer_email_address: 'a@b.com', signature_id: 's1', status_code: 'awaiting_signature' },
          ],
          created_at: 1700000000,
        },
      }),
    });

    const req = makeRequest({
      signers: [{ email: 'a@b.com', name: 'Alice' }], // no order
    });
    await provider.createEnvelope(req);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('createEnvelope error response with missing error_msg falls back to statusText', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: async () => ({ error: {} }),
    });

    await expect(provider.createEnvelope(makeRequest())).rejects.toThrow('Bad Request');
  });

  it('downloadDocument wraps non-Error throw in logger', async () => {
    mockFetch.mockRejectedValueOnce('not an error');
    await expect(provider.downloadDocument('hs_bad')).rejects.toBe('not an error');
  });
});
