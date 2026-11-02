import { describe, expect, it, vi } from 'vitest';
import { loadEducationSessionPage } from '../session-catalogue';

const row = (id: string, organizationId = 'org-a') => ({
  id, organizationId, sessionCode: `CODE-${id}`,
  sessionName: `Session ${id}`, startDate: '2026-11-02',
});
const response = (rows: unknown[], page = 1, total = rows.length, limit = 100) => ({
  ok: true,
  json: async () => ({
    data: {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    },
  }),
});
const requestFor = (result: unknown) => vi.fn().mockResolvedValue(result) as unknown as typeof fetch;

describe('tenant-scoped education session catalogue pagination', () => {
  it('loads the first page and exposes a next page without silently truncating 101 sessions', async () => {
    const request = requestFor(response(Array.from({ length: 100 }, (_, i) => row(String(i))), 1, 101));
    const result = await loadEducationSessionPage('org-a', 1, request);
    expect(result.sessions).toHaveLength(100);
    expect(result.totalPages).toBe(2);
    expect(request).toHaveBeenCalledWith('/api/education/sessions?page=1&limit=100',
      { credentials: 'same-origin', cache: 'no-store' });
  });

  it('loads the last page without misrepresenting its record count', async () => {
    const request = requestFor(response([row('last')], 2, 101));
    expect(await loadEducationSessionPage('org-a', 2, request)).toMatchObject({
      page: 2, totalPages: 2, sessions: [expect.objectContaining({ id: 'last' })],
    });
  });

  it('refuses another organization records, even if the HTTP request succeeds', async () => {
    await expect(loadEducationSessionPage('org-a', 1,
      requestFor(response([row('foreign', 'org-b')])))).rejects.toThrow('another organization');
  });

  it('refuses malformed envelopes, incomplete rows, and inconsistent pagination', async () => {
    for (const result of [
      { ok: true, json: async () => ({ data: { data: [row('a')] } }) },
      response([{ id: 'a', organizationId: 'org-a' }]),
      response([row('a')], 2, 1),
      response([row('a')], 1, 1, 99),
      response([row('a')], 1, 0),
      { ok: true, json: async () => ({ data: { data: [row('a')], pagination: { page: 1, limit: 100, total: 1, totalPages: 2 } } }) },
    ]) {
      await expect(loadEducationSessionPage('org-a', 1, requestFor(result))).rejects.toThrow();
    }
  });

  it('does not treat a failed request or invalid page as an empty catalogue', async () => {
    const request = requestFor({ ok: false });
    await expect(loadEducationSessionPage('org-a', 1, request)).rejects.toThrow('unavailable');
    for (const page of [0, -1, 1.5, 10001, Number.NaN]) {
      await expect(loadEducationSessionPage('org-a', page, request)).rejects.toThrow('Invalid');
    }
    expect(request).toHaveBeenCalledTimes(1);
  });
});
