import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  assertBufferSafeForUpload,
  isMalwareScanError,
  scanBufferWithClamAV,
} from '../clamav';

describe('clamav security scanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.CLAMAV_URL;
    delete process.env.CLAMAV_FAIL_OPEN;
    process.env.NODE_ENV = 'test';
  });

  it('returns unavailable when CLAMAV_URL is missing', async () => {
    const result = await scanBufferWithClamAV(Buffer.from('sample'));
    expect(result.status).toBe('unavailable');
    expect(result.reason).toBe('clamav_url_missing');
  });

  it('maps json clean response', async () => {
    process.env.CLAMAV_URL = 'http://clamav:3310';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ status: 'clean' }),
    }));

    const result = await scanBufferWithClamAV(Buffer.from('sample'));
    expect(result.status).toBe('clean');
  });

  it('maps text infected response', async () => {
    process.env.CLAMAV_URL = 'http://clamav:3310';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/plain' },
      text: async () => 'stream: Eicar-Test-Signature FOUND',
    }));

    const result = await scanBufferWithClamAV(Buffer.from('sample'));
    expect(result.status).toBe('infected');
    expect(result.signature).toBe('Eicar-Test-Signature');
  });

  it('throws MalwareScanError when file is infected', async () => {
    process.env.CLAMAV_URL = 'http://clamav:3310';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ status: 'infected', signature: 'Eicar-Test-Signature' }),
    }));

    await expect(assertBufferSafeForUpload(Buffer.from('sample'), 'file.pdf')).rejects.toMatchObject({
      name: 'MalwareScanError',
    });
  });

  it('fails closed when scanner is unavailable and enforcement is on', async () => {
    process.env.CLAMAV_URL = 'http://clamav:3310';
    process.env.CLAMAV_ENFORCE_IN_TEST = 'true';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));

    try {
      await assertBufferSafeForUpload(Buffer.from('sample'), 'file.pdf');
      expect.fail('Expected scanner failure to throw');
    } catch (error) {
      expect(isMalwareScanError(error)).toBe(true);
      if (isMalwareScanError(error)) {
        expect(error.result.status).toBe('unavailable');
      }
    } finally {
      delete process.env.CLAMAV_ENFORCE_IN_TEST;
    }
  });

  it('allows unavailable scanner only when fail-open is explicitly enabled', async () => {
    process.env.CLAMAV_URL = 'http://clamav:3310';
    process.env.CLAMAV_FAIL_OPEN = 'true';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED')));

    const result = await assertBufferSafeForUpload(Buffer.from('sample'), 'file.pdf');
    expect(result.status).toBe('unavailable');
  });
});
