import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveIpGeolocation } from '../ip-geolocation';

/* ------------------------------------------------------------------ */
/*  Mock fetch                                                         */
/* ------------------------------------------------------------------ */
const originalFetch = globalThis.fetch;

const mockFetch = vi.fn();

beforeEach(() => {
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe('resolveIpGeolocation', () => {
  // ---------- normalizeIp edge cases (invoked via resolveIpGeolocation) ------
  it('returns empty object for null IP', async () => {
    expect(await resolveIpGeolocation(null)).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty object for undefined IP', async () => {
    expect(await resolveIpGeolocation(undefined)).toEqual({});
  });

  it('returns empty object for empty string', async () => {
    expect(await resolveIpGeolocation('')).toEqual({});
  });

  it('returns empty object for "unknown"', async () => {
    expect(await resolveIpGeolocation('unknown')).toEqual({});
  });

  it('takes first IP from comma-separated list', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ city: 'Toronto' }),
    });
    await resolveIpGeolocation('8.8.8.8, 1.1.1.1');
    expect(mockFetch).toHaveBeenCalledWith('https://ipapi.co/8.8.8.8/json/');
  });

  it('strips ::ffff: prefix from IPv4-mapped IPv6', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ city: 'London' }),
    });
    await resolveIpGeolocation('::ffff:203.0.113.5');
    expect(mockFetch).toHaveBeenCalledWith('https://ipapi.co/203.0.113.5/json/');
  });

  it('strips port from IP:port format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ city: 'Berlin' }),
    });
    await resolveIpGeolocation('198.51.100.7:8080');
    expect(mockFetch).toHaveBeenCalledWith('https://ipapi.co/198.51.100.7/json/');
  });

  // ---------- private IP detection ----------------------------------------
  it('returns empty for loopback 127.0.0.1', async () => {
    expect(await resolveIpGeolocation('127.0.0.1')).toEqual({});
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns empty for IPv6 loopback ::1', async () => {
    expect(await resolveIpGeolocation('::1')).toEqual({});
  });

  it('returns empty for 10.x.x.x private range', async () => {
    expect(await resolveIpGeolocation('10.0.0.1')).toEqual({});
  });

  it('returns empty for 192.168.x.x private range', async () => {
    expect(await resolveIpGeolocation('192.168.1.1')).toEqual({});
  });

  it('returns empty for 172.16-31.x.x private range', async () => {
    expect(await resolveIpGeolocation('172.16.0.1')).toEqual({});
    expect(await resolveIpGeolocation('172.31.255.255')).toEqual({});
  });

  it('returns empty for 169.254.x.x link-local', async () => {
    expect(await resolveIpGeolocation('169.254.1.1')).toEqual({});
  });

  it('returns empty for fc/fd prefix IPv6 private', async () => {
    expect(await resolveIpGeolocation('fc00::1')).toEqual({});
    expect(await resolveIpGeolocation('fd12::1')).toEqual({});
  });

  it('returns empty for fe80 link-local IPv6', async () => {
    expect(await resolveIpGeolocation('fe80::1')).toEqual({});
  });

  // ---------- successful API response -------------------------------------
  it('returns geolocation data on successful API response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          city: 'Toronto',
          region: 'Ontario',
          country_code: 'CA',
          latitude: 43.6532,
          longitude: -79.3832,
          timezone: 'America/Toronto',
          org: 'Bell Canada',
        }),
    });

    const result = await resolveIpGeolocation('8.8.8.8');
    expect(result).toEqual({
      city: 'Toronto',
      region: 'Ontario',
      country: 'CA',
      latitude: 43.6532,
      longitude: -79.3832,
      timezone: 'America/Toronto',
      isp: 'Bell Canada',
    });
  });

  it('omits undefined fields from response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ city: 'Tokyo' }),
    });

    const result = await resolveIpGeolocation('8.8.4.4');
    expect(result).toEqual({ city: 'Tokyo' });
    expect(result.region).toBeUndefined();
  });

  it('excludes non-number latitude/longitude', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ latitude: 'not-a-number', longitude: null }),
    });

    const result = await resolveIpGeolocation('8.8.4.4');
    expect(result.latitude).toBeUndefined();
    expect(result.longitude).toBeUndefined();
  });

  // ---------- error handling ----------------------------------------------
  it('returns empty object on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    expect(await resolveIpGeolocation('8.8.8.8')).toEqual({});
  });

  it('returns empty object when API returns error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: true }),
    });
    expect(await resolveIpGeolocation('8.8.8.8')).toEqual({});
  });

  it('returns empty object on fetch exception', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    expect(await resolveIpGeolocation('8.8.8.8')).toEqual({});
  });
});
