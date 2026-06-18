import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getToken: vi.fn(),
  auth: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: h.auth,
}));

import {
  cancelSignatureRequest,
  completeSignatureRequestStep,
  createSignatureRequest,
  createSignatureService,
  expireOverdueSignatureRequests,
  getDocumentSignatures,
  getSignatureServiceById,
  getSignatureServiceList,
  getUserSignatureRequests,
  hashDocument,
  hashDocumentReference,
  rejectSignature,
  signDocument,
  signDocumentWithKey,
  updateSignatureService,
} from '../signature-service-api';

const fetchMock = vi.fn();

beforeEach(() => {
  h.getToken.mockReset().mockResolvedValue('token-123');
  h.auth.mockReset().mockResolvedValue({ getToken: h.getToken });
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: vi.fn().mockResolvedValue({ ok: 1 }) });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const postActions: Array<[string, (data: unknown) => Promise<unknown>]> = [
  ['createSignatureService', createSignatureService],
  ['hashDocument', hashDocument],
  ['hashDocumentReference', hashDocumentReference],
  ['signDocument', signDocument],
  ['signDocumentWithKey', signDocumentWithKey],
  ['getDocumentSignatures', getDocumentSignatures],
  ['rejectSignature', rejectSignature],
  ['createSignatureRequest', createSignatureRequest],
  ['getUserSignatureRequests', getUserSignatureRequests],
  ['completeSignatureRequestStep', completeSignatureRequestStep],
  ['cancelSignatureRequest', cancelSignatureRequest],
  ['expireOverdueSignatureRequests', expireOverdueSignatureRequests],
];

describe('lib/api/signature-service-api', () => {
  it('getApiClient throws when no token is available', async () => {
    h.getToken.mockResolvedValue(null);
    await expect(getSignatureServiceList()).rejects.toThrow('No authentication token available');
  });

  it('getSignatureServiceList sends auth header and supports filters', async () => {
    await getSignatureServiceList({ status: 'open' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('?status=open');
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer token-123');
  });

  it('getSignatureServiceList works without filters and throws on error', async () => {
    await getSignatureServiceList();
    fetchMock.mockResolvedValue({ ok: false, statusText: 'Boom' });
    await expect(getSignatureServiceList()).rejects.toThrow(/Failed to fetch signature-service/);
  });

  it('getSignatureServiceById fetches and errors', async () => {
    await expect(getSignatureServiceById('1')).resolves.toEqual({ ok: 1 });
    fetchMock.mockResolvedValue({ ok: false, statusText: 'Boom' });
    await expect(getSignatureServiceById('1')).rejects.toThrow(/Failed to fetch/);
  });

  it('updateSignatureService updates and errors', async () => {
    await expect(updateSignatureService('1', { a: 1 })).resolves.toEqual({ ok: 1 });
    fetchMock.mockResolvedValue({ ok: false, statusText: 'Boom' });
    await expect(updateSignatureService('1', {})).rejects.toThrow(/Failed to update/);
  });

  it.each(postActions)('%s posts data and throws on error', async (_name, fn) => {
    await expect(fn({ a: 1 })).resolves.toEqual({ ok: 1 });
    const [, init] = fetchMock.mock.calls[0];
    expect((init as { method: string }).method).toBe('POST');
    expect((init as { body: string }).body).toBe(JSON.stringify({ a: 1 }));

    fetchMock.mockResolvedValue({ ok: false, statusText: 'Boom' });
    await expect(fn({})).rejects.toThrow(/Failed to/);
  });
});
